document.addEventListener('DOMContentLoaded', function() {
    // Struttura dati per memorizzare gli utenti selezionati e gli scope
    let selectedUsers = {};

    // Funzione per inizializzare selectedUsers per una pagina
    function initializeSelectedUsers(pageName) {
        if (!selectedUsers[pageName]) {
            selectedUsers[pageName] = {
                read: [], // Array di oggetti {id, name}
                scope: 'all'
            };
        }
    }

    // Funzione per aprire il modal di selezione utenti
    async function openUserSelectionModal(pageName) {
        // Inizializza selectedUsers per questa pagina se non esiste
        initializeSelectedUsers(pageName);

        // Crea il modal
        const modal = document.createElement('div');
        modal.className = 'user-modal';
        modal.innerHTML = `
            <h3>Seleziona gli utenti</h3>
            <div class="user-list"></div>
            <button class="user-select-btn">Conferma</button>
        `;

        // Recupera la lista degli utenti dal server
        try {
            const response = await fetch('/api/team-members');
            const users = await response.json();
            
            // Popola la lista degli utenti
            const userList = modal.querySelector('.user-list');
            users.forEach(user => {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = user.id;
                checkbox.checked = selectedUsers[pageName].read.some(u => u.id === user.id);
                
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(user.name));
                userList.appendChild(label);
            });
        } catch (error) {
            console.error('Errore nel recupero degli utenti:', error);
            alert('Impossibile recuperare la lista degli utenti');
            return;
        }

        // Gestisci il click sul pulsante conferma
        const confirmBtn = modal.querySelector('.user-select-btn');
        confirmBtn.addEventListener('click', () => {
            const checkedBoxes = modal.querySelectorAll('input[type="checkbox"]:checked');
            selectedUsers[pageName].read = Array.from(checkedBoxes).map(cb => ({
                id: cb.value,
                name: cb.parentElement.textContent.trim()
            }));
            
            // Aggiorna il testo della select
            const select = document.querySelector(`select[data-page="${pageName}"]`);
            if (selectedUsers[pageName].read.length > 0) {
                const option = select.querySelector('option[value="specific-users"]');
                option.textContent = `Only these specific users: ${selectedUsers[pageName].read.map(u => u.name).join(', ')}`;
            }
            
            document.body.removeChild(modal);
        });

        document.body.appendChild(modal);
    }

    // Funzione per mostrare/nascondere dropdown e gestire stato
    const toggleDropdownVisibility = (checkbox) => {
        const dropdown = checkbox.parentElement.querySelector('.read-scope-select');
        
        // Aggiorna solo lo stato disabled mantenendo visibile
        dropdown.disabled = !checkbox.checked;
        dropdown.style.opacity = checkbox.checked ? '1' : '0.5';
        dropdown.style.cursor = checkbox.checked ? 'pointer' : 'not-allowed';
        
        // Se la dropdown è nascosta, resetta il suo valore
        if (!checkbox.checked) {
            dropdown.value = 'all';
        }
    };

    const roleGrid = document.getElementById('role-grid');
    const saveRoleBtn = document.getElementById('save-role-btn');
    const userNameDisplay = document.getElementById('user-name-display');

    // Inizializza e gestisce le dropdown
    // Event delegation per gestire checkbox dinamici
    // Gestione eventi per checkbox Read
    roleGrid.addEventListener('change', (event) => {
        const checkbox = event.target.closest('.crud-read-checkbox');
        const select = event.target.closest('.read-scope-select');
        
        if (checkbox) {
            toggleDropdownVisibility(checkbox);
        } else if (select && select.value === 'specific-users') {
            const pageName = select.dataset.page;
            openUserSelectionModal(pageName);
        }
    });

    // Ottieni l'ID dell'utente dalla query string
    const urlParams = new URLSearchParams(window.location.search);
    const memberId = urlParams.get('memberId');

    console.log('Member ID:', memberId);

    if (!memberId) {
        alert('Nessun utente selezionato.');
        window.location.href = 'users.html';
        return;
    }

    // Funzione per recuperare i dettagli dell'utente e le sue azioni CRUD
    async function getUserDetails(id) {
        try {
            const [userData, userCrud] = await Promise.all([
                fetch(`/api/team-members/${id}`).then(res => {
                    if (!res.ok) throw new Error(`Errore HTTP: ${res.status}`);
                    return res.json();
                }),
                fetch(`/api/team-members/${id}/crud-permissions`).then(res => {
                    if (!res.ok) throw new Error(`Errore nel recupero delle azioni CRUD: ${res.status}`);
                    return res.json();
                })
            ]);

            return {
                ...userData,
                crud: userCrud
            };
        } catch (error) {
            console.error('Errore nel recupero dei dettagli dell\'utente:', error);
            alert('Impossibile recuperare i dati dell\'utente.');
            window.location.href = 'users.html';
        }
    }

    // Funzione per recuperare tutte le azioni CRUD disponibili
    async function getCrudActions() {
        try {
            const response = await fetch('/api/team-members/crud-actions');
            if (!response.ok) {
                throw new Error(`Errore nel recupero delle azioni CRUD: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Errore nel recupero delle azioni CRUD:', error);
            alert('Impossibile recuperare le azioni CRUD.');
            return {};
        }
    }

    // Funzione per costruire la griglia CRUD
    function buildCrudGrid(pages, userCrud) {
        const table = document.createElement('table');
        table.classList.add('crud-table');

        // Creazione dell'intestazione
        const headerRow = table.insertRow();
        headerRow.insertCell().textContent = 'Page / Action';  // Traduzione della scritta "Pagina/Azione" in inglese
        const actionTypes = ['Create', 'Read', 'Update', 'Delete'];
        actionTypes.forEach(action => {
            const th = document.createElement('th');
            th.textContent = action;
            headerRow.appendChild(th);
        });

        // Creazione delle righe per ogni pagina
        const pageNames = Object.keys(pages);
        // Aggiungi 'Configuration' se non è già presente dalle API (improbabile ma sicuro)
        if (!pageNames.includes('Configuration')) {
            pageNames.push('Configuration');
            // Assicurati che esista un placeholder per le azioni di Configuration se non fornito dall'API
            if (!pages['Configuration']) {
                pages['Configuration'] = ['Read']; // Definiamo che Configuration ha solo l'azione 'Read' (accesso)
            }
        }

        pageNames.forEach(pageName => {
            const row = table.insertRow();
            const pageCell = row.insertCell();
            pageCell.textContent = pageName;

            // Crea checkbox e selettori per ogni tipo di azione CRUD
            actionTypes.forEach(actionType => {
                const cell = row.insertCell();
                
                // Per l'azione Read, aggiungi sia checkbox che selettore
                if (actionType === 'Read' && pages[pageName].includes(actionType)) {
                    const readPermissionDiv = document.createElement('div');
                    readPermissionDiv.className = 'read-permission-container';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'crud-checkbox crud-read-checkbox';
                    checkbox.dataset.page = pageName;
                    checkbox.dataset.action = actionType;

                    const select = document.createElement('select');
                    select.className = 'read-scope-select';
                    select.dataset.page = pageName;

                    // Opzioni specifiche per ogni pagina
                    if (pageName === 'Projects') {
                        select.innerHTML = `
                            <option value="all">All projects</option>
                            <option value="own">Own projects</option>
                            <option value="own-factory">Own factory projects</option>
                            <option value="all-factories">All factories projects</option>
                            <option value="own-client">Own client company projects</option>
                            <option value="all-clients">All client companies projects</option>
                            <option value="user-projects">Only selected user's projects</option>
                        `;
                    } else if (pageName === 'Users') {
                        select.innerHTML = `
                            <option value="all">All users</option>
                            <option value="own-factory">Own factory users</option>
                            <option value="all-factories">All factories users</option>
                            <option value="own-client">Own client company users</option>
                            <option value="all-clients">All client companies users</option>
                            <option value="specific-users">Only these specific users</option>
                        `;
                    } else if (pageName === 'Tasks') {
                        select.innerHTML = `
                            <option value="all">All tasks</option>
                            <option value="own">Own tasks</option>
                            <option value="own-factory">Own factory tasks (all users)</option>
                            <option value="all-factories">All factories tasks</option>
                            <option value="own-client">Own client company tasks (all users)</option>
                            <option value="all-clients">All client companies tasks</option>
                            <option value="user-tasks">Only selected user's tasks</option>
                        `;
                    }

                    // Inizializza selectedUsers per questa pagina
                    initializeSelectedUsers(pageName);

                    // Verifica se l'utente ha questa azione CRUD e imposta i valori
                    if (pageName === 'Configuration') {
                        // Gestione specifica per Configuration: solo Read (accesso)
                        if (actionType === 'Read') {
                            checkbox.checked = userCrud['Configuration']?.read === true; // Controlla il permesso specifico
                        } else {
                            // Nascondi le altre azioni per Configuration
                            cell.textContent = '—';
                            return; // Salta il resto del codice per questa cella
                        }
                    } else if (userCrud[pageName]) { // Gestione per le altre pagine
                        const pagePermissions = userCrud[pageName];
                        if (typeof pagePermissions === 'object' && pagePermissions.read) {
                            checkbox.checked = true;

                            // Imposta lo scope corretto basato sulla factory e client_company
                            const scope = pagePermissions.read.scope;
                            select.value = scope;
                            selectedUsers[pageName].scope = scope;
                            
                            // Gestisci gli utenti specifici se necessario
                            if (scope === 'specific-users' && pagePermissions.read.userIds) {
                                // Recupera i dettagli degli utenti dal server
                                fetch('/api/team-members')
                                    .then(res => res.json())
                                    .then(users => {
                                        const selectedUserDetails = users
                                            .filter(user => pagePermissions.read.userIds.includes(user.id.toString()))
                                            .map(user => ({
                                                id: user.id,
                                                name: user.name
                                            }));
                                        
                                        selectedUsers[pageName].read = selectedUserDetails;
                                    })
                                    .catch(error => {
                                        console.error('Errore nel recupero dei dettagli utenti:', error);
                                    });
                            }

                            // Disabilita opzioni non valide basate sulla factory e client_company
                            if (pagePermissions.read.factory) {
                                Array.from(select.options).forEach(option => {
                                    if ((option.value.includes('client') && !pagePermissions.read.client_company_name) ||
                                        (option.value.includes('factory') && !pagePermissions.read.factory)) {
                                        option.disabled = true;
                                    }
                                });
                            }
                        } else if (Array.isArray(pagePermissions) && pagePermissions.includes(actionType)) {
                            checkbox.checked = true;
                            select.value = 'all';
                        }
                    }

                    readPermissionDiv.appendChild(checkbox);
                    readPermissionDiv.appendChild(select);
                    cell.appendChild(readPermissionDiv);
                    
                    // Aggiorna lo stato iniziale del dropdown
                    toggleDropdownVisibility(checkbox);
                } else {
                    // Per le altre azioni (non Read) o per pagine diverse da Configuration
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'crud-checkbox';
                    checkbox.dataset.page = pageName;
                    checkbox.dataset.action = actionType;

                    // Verifica se l'utente ha questa azione CRUD
                    if (pageName === 'CRUD' && actionType === 'Read') {
                        // Verifica se l'utente ha il permesso CRUD
                        checkbox.checked = userCrud['CRUD']?.read?.enabled === true;
                    } else if (pageName === 'Configuration' && actionType === 'Read') {
                        // Gestione specifica per Configuration (già gestita sopra, ma ri-verifichiamo per sicurezza)
                        checkbox.checked = userCrud['Configuration']?.read === true;
                    } else if (userCrud[pageName] &&
                        ((Array.isArray(userCrud[pageName]) && userCrud[pageName].includes(actionType)) ||
                         (typeof userCrud[pageName] === 'object' && userCrud[pageName][actionType.toLowerCase()]))) {
                        checkbox.checked = true;
                    }

                    // Verifica se questa azione è disponibile per questa pagina
                    if (pages[pageName].includes(actionType) || (pageName === 'CRUD' && actionType === 'Read')) {
                        cell.appendChild(checkbox);
                    } else {
                        cell.textContent = '—';
                    }
                }
            });
        });

        roleGrid.innerHTML = '';
        roleGrid.appendChild(table);

        // Aggiorna i testi delle dropdown dopo un breve timeout per assicurarsi che siano state create
        setTimeout(() => {
            if (userCrud['Users']?.read?.userIds) {
                fetch('/api/team-members')
                    .then(res => res.json())
                    .then(users => {
                        const selectedUserDetails = users
                            .filter(user => userCrud['Users'].read.userIds.includes(user.id.toString()))
                            .map(user => ({
                                id: user.id,
                                name: user.name
                            }));

                        if (selectedUserDetails.length > 0) {
                            const userNames = selectedUserDetails.map(u => u.name).join(', ');
                            
                            // Aggiorna il testo per Users
                            const usersSelect = document.querySelector('select[data-page="Users"]');
                            if (usersSelect) {
                                const usersOption = usersSelect.querySelector('option[value="specific-users"]');
                                if (usersOption) {
                                    usersOption.textContent = `Only these specific users: ${userNames}`;
                                }
                            }

                            // Aggiorna il testo per Tasks
                            const tasksSelect = document.querySelector('select[data-page="Tasks"]');
                            if (tasksSelect) {
                                const taskOption = tasksSelect.querySelector('option[value="user-tasks"]');
                                if (taskOption) {
                                    taskOption.textContent = `Only selected user's tasks: ${userNames}`;
                                }
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Errore nel recupero dei dettagli utenti:', error);
                    });
            }
        }, 100);
    }

    // Funzione per salvare le azioni CRUD
    async function saveCrudPermissions() {
        try {
            const updatedCrud = {};
            const rows = roleGrid.querySelectorAll('.crud-table tr:not(:first-child)');
            
            rows.forEach(row => {
                const pageName = row.cells[0].textContent;
                updatedCrud[pageName] = {}; // Inizializza l'oggetto per la pagina

                // Gestisci tutte le azioni CRUD
                const actions = ['Create', 'Read', 'Update', 'Delete'];
                actions.forEach((action, index) => {
                    const cell = row.cells[index + 1];
                    const checkbox = cell.querySelector(`input[type="checkbox"][data-action="${action}"]`); // Selettore più specifico

                    if (!checkbox) return; // Salta se non c'è checkbox (es. azioni non disponibili)

                    const actionLower = action.toLowerCase();

                    if (pageName === 'Configuration') {
                        // Gestione specifica per Configuration
                        if (action === 'Read') {
                            updatedCrud[pageName].read = checkbox.checked; // Salva solo true/false per l'accesso
                        }
                        // Ignora le altre azioni per Configuration
                    } else if (action === 'Read') {
                        // Gestione Read per le altre pagine (CRUD, Projects, Users, Tasks)
                        if (pageName === 'CRUD') {
                             // Gestione speciale per la riga CRUD - usa direttamente l'ID 17
                             if (checkbox && checkbox.checked) {
                                 // Aggiungi il permesso CRUD visible (ID 17)
                                 updatedCrud['crud_visible'] = {
                                     id: 17,
                                     enabled: true
                                 };
                             }
                        } else { // Projects, Users, Tasks
                            const readSelect = cell.querySelector('select.read-scope-select');
                            if (checkbox.checked) {
                                const scope = readSelect ? readSelect.value : 'all';
                                
                                // Struttura corretta per i permessi di lettura
                                updatedCrud[pageName].read = {
                                    enabled: true,
                                    scope: scope,
                                    properties: JSON.stringify({
                                        enabled: true,
                                        scope: scope
                                    })
                                };

                                // Aggiungi userIds solo se necessario
                                if (scope === 'specific-users' && selectedUsers[pageName]?.read?.length > 0) {
                                    updatedCrud[pageName].read.userIds = selectedUsers[pageName].read.map(u => u.id);
                                    // Aggiorna properties per includere userIds
                                    updatedCrud[pageName].read.properties = JSON.stringify({
                                        enabled: true,
                                        scope: scope,
                                        userIds: selectedUsers[pageName].read.map(u => u.id)
                                    });
                                }
                            } else {
                                // Se la checkbox non è selezionata
                                updatedCrud[pageName].read = {
                                    enabled: false,
                                    scope: 'none',
                                    properties: JSON.stringify({
                                        enabled: false,
                                        scope: 'none'
                                    })
                                };
                            }
                        }
                    } else { // Create, Update, Delete per Projects, Users, Tasks
                        if (checkbox.checked) {
                            // Assicurati che updatedCrud[pageName] sia un oggetto
                            if (typeof updatedCrud[pageName] !== 'object' || updatedCrud[pageName] === null) {
                                updatedCrud[pageName] = {};
                            }
                            updatedCrud[pageName][actionLower] = true;
                        }
                    }
                });

                // Pulisci l'oggetto se è vuoto per una pagina (tranne Configuration che può essere solo {read: false})
                if (pageName !== 'Configuration' && Object.keys(updatedCrud[pageName]).length === 0) {
                    delete updatedCrud[pageName];
                } else if (pageName === 'Configuration' && !updatedCrud[pageName].read) {
                     // Se Configuration read è false, assicurati che venga inviato
                     updatedCrud[pageName] = { read: false };
                }

            });

        // Log dei dati prima dell'invio
        console.log('Dati inviati al server:', JSON.stringify({ crud: updatedCrud }, null, 2));

        // Invio dei dati al server
            const response = await fetch(`/api/team-members/${memberId}/crud-permissions`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ crud: updatedCrud }),
            });
    
            if (response.ok) {
                alert('Azioni CRUD salvate con successo!');
                window.location.href = 'users.html';
            } else {
                const errorText = await response.text();
                console.error('Errore nel salvataggio delle azioni CRUD:', response.status, errorText);
                alert('Errore nel salvataggio delle azioni CRUD.');
            }
        } catch (error) {
            console.error('Errore durante il salvataggio delle azioni CRUD:', error);
            alert('Errore durante il salvataggio delle azioni CRUD.');
        }
    }

    // Inizializzazione della pagina
    (async function initializePage() {
        const [userData, pages] = await Promise.all([
            getUserDetails(memberId),
            getCrudActions()
        ]);

        if (userData) {
            userNameDisplay.textContent = userData.name;
            document.title = `Permessi CRUD - ${userData.name}`;
            buildCrudGrid(pages, userData.crud || {});
        }
    })();

    // Gestisci il click sul pulsante Salva
    saveRoleBtn.addEventListener('click', saveCrudPermissions);
});
