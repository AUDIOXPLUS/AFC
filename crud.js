document.addEventListener('DOMContentLoaded', function() {
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
        if (checkbox) {
            toggleDropdownVisibility(checkbox);
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
        headerRow.insertCell().textContent = 'Pagina / Azione';
        const actionTypes = ['Create', 'Read', 'Update', 'Delete'];
        actionTypes.forEach(action => {
            const th = document.createElement('th');
            th.textContent = action;
            headerRow.appendChild(th);
        });

        // Creazione delle righe per ogni pagina
        Object.keys(pages).forEach(pageName => {
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
                            <option value="all">All Projects</option>
                            <option value="own-factory">Projects from Own Factories</option>
                            <option value="all-factories">Projects from All Factories</option>
                            <option value="own-clients">Projects from Own Client Companies</option>
                            <option value="all-clients">Projects from All Client Companies</option>
                        `;
                    } else if (pageName === 'Users') {
                        select.innerHTML = `
                            <option value="all">All Users</option>
                            <option value="own-factory">Users from Own Factories</option>
                            <option value="all-factories">Users from All Factories</option>
                            <option value="own-clients">Users from Own Client Companies</option>
                            <option value="all-clients">Users from All Client Companies</option>
                        `;
                    } else if (pageName === 'Tasks') {
                        select.innerHTML = `
                            <option value="all">All Tasks</option>
                            <option value="own-factory-users">Tasks from Own Factory Users</option>
                            <option value="all-factory-users">Tasks from All Factory Users</option>
                            <option value="own-client-users">Tasks from Own Client Company Users</option>
                            <option value="all-client-users">Tasks from All Client Company Users</option>
                            <option value="own-tasks">Only Own Tasks</option>
                        `;
                    }

                    // Verifica se l'utente ha questa azione CRUD e imposta i valori
                    if (userCrud[pageName]) {
                        const pagePermissions = userCrud[pageName];
                        if (typeof pagePermissions === 'object' && pagePermissions.read) {
                            checkbox.checked = true;
                            select.value = pagePermissions.read.scope || 'all';
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
                    // Per le altre azioni, crea solo la checkbox
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'crud-checkbox';
                    checkbox.dataset.page = pageName;
                    checkbox.dataset.action = actionType;

                    // Verifica se l'utente ha questa azione CRUD
                    if (userCrud[pageName] && 
                        ((Array.isArray(userCrud[pageName]) && userCrud[pageName].includes(actionType)) ||
                         (typeof userCrud[pageName] === 'object' && userCrud[pageName][actionType.toLowerCase()]))) {
                        checkbox.checked = true;
                    }

                    // Verifica se questa azione è disponibile per questa pagina
                    if (pages[pageName].includes(actionType)) {
                        cell.appendChild(checkbox);
                    } else {
                        cell.textContent = '—';
                    }
                }
            });
        });

        roleGrid.innerHTML = '';
        roleGrid.appendChild(table);
    }

    // Funzione per salvare le azioni CRUD
    async function saveCrudPermissions() {
        const updatedCrud = {};
        const rows = roleGrid.querySelectorAll('.crud-table tr:not(:first-child)');
        
        rows.forEach(row => {
            const pageName = row.cells[0].textContent;
            updatedCrud[pageName] = {};
            
            // Gestisci le azioni CRUD standard
            ['Create', 'Update', 'Delete'].forEach((action, index) => {
                const checkbox = row.cells[index + 1].querySelector('input[type="checkbox"]');
                if (checkbox && checkbox.checked) {
                    updatedCrud[pageName][action.toLowerCase()] = true;
                }
            });
            
            // Gestisci l'azione Read con il suo scope
            const readCell = row.cells[2];
            const readCheckbox = readCell.querySelector('input[type="checkbox"]');
            const readSelect = readCell.querySelector('select');
            
            if (readCheckbox && readCheckbox.checked) {
                updatedCrud[pageName].read = {
                    enabled: true,
                    scope: readSelect.value
                };
            }
        });
    
        console.log('Dati inviati al server:', JSON.stringify({ crud: updatedCrud }, null, 2));
    
        try {
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
