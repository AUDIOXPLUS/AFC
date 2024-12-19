document.addEventListener('DOMContentLoaded', function() {
    const roleGrid = document.getElementById('role-grid');
    const saveRoleBtn = document.getElementById('save-role-btn');
    const userNameDisplay = document.getElementById('user-name-display');

    // Definizione delle pagine e delle loro azioni
    const pages = [
        { name: 'Dashboard', actions: ['View Stats', 'Edit Settings'] },
        { name: 'Projects', actions: ['Create Project', 'Edit Project', 'Delete Project'] },
        { name: 'Clients', actions: ['Add Client', 'Edit Client', 'Remove Client'] },
        // Aggiungi altre pagine e azioni qui
    ];

    // Ottieni l'ID dell'utente dalla query string
    const urlParams = new URLSearchParams(window.location.search);
    const memberId = urlParams.get('memberId');

    console.log('Member ID:', memberId); // Log per verificare l'ID

    if (!memberId) {
        alert('Nessun utente selezionato.');
        window.location.href = 'users.html';
        return;
    }

    // Funzione per recuperare i dettagli dell'utente
    async function getUserDetails(id) {
        try {
            const response = await fetch(`/api/team-members/${id}`);
            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }
            const userData = await response.json();

            // Recupera i privilegi
            const privilegesResponse = await fetch(`/api/team-members/${id}/privileges`);
            if (!privilegesResponse.ok) {
                throw new Error(`Errore nel recupero dei privilegi: ${privilegesResponse.status}`);
            }
            const userPrivileges = await privilegesResponse.json();

            return {
                ...userData,
                privileges: userPrivileges
            };
        } catch (error) {
            console.error('Errore nel recupero dei dettagli dell\'utente:', error);
            alert('Impossibile recuperare i dati dell\'utente.');
            window.location.href = 'users.html';
        }
    }

    // Funzione per costruire la griglia dei privilegi
    function buildPrivilegeGrid(userPrivileges) {
        const table = document.createElement('table');
        table.classList.add('privilege-table');

        // Creazione dell'intestazione
        const headerRow = table.insertRow();
        headerRow.insertCell().textContent = 'Azioni / Pagine';
        pages.forEach(page => {
            const th = document.createElement('th');
            th.textContent = page.name;
            headerRow.appendChild(th);
        });

        // Creazione delle righe per ogni azione
        pages.forEach(page => {
            page.actions.forEach(action => {
                const row = table.insertRow();
                const actionCell = row.insertCell();
                actionCell.textContent = action;

                pages.forEach(currentPage => {
                    const cell = row.insertCell();
                    if (currentPage.name === page.name) { // Associa l'azione alla pagina corretta
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.dataset.page = page.name;
                        checkbox.dataset.action = action;
                        // Imposta lo stato della checkbox in base ai privilegi dell'utente
                        if (userPrivileges[currentPage.name] && userPrivileges[currentPage.name].includes(action)) {
                            checkbox.checked = true;
                        }
                        cell.appendChild(checkbox);
                    } else {
                        cell.textContent = '—';
                    }
                });
            });
        });

        roleGrid.appendChild(table);
    }

    // Funzione per salvare i privilegi
    async function savePrivileges() {
        const checkboxes = roleGrid.querySelectorAll('input[type="checkbox"]');
        const updatedPrivileges = [];
    
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                updatedPrivileges.push({
                    page: checkbox.dataset.page,
                    action: checkbox.dataset.action
                });
            }
        });
    
        // Aggiungi questo log
        console.log('Dati inviati al server:', JSON.stringify({ privileges: updatedPrivileges }, null, 2));
    
        try {
            const response = await fetch(`/api/team-members/${memberId}/privileges`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ privileges: updatedPrivileges }),
            });
    
            if (response.ok) {
                alert('Roles and privileges saved successfully!');
                window.location.href = 'users.html';
            } else {
                const errorText = await response.text();
                console.error('Error saving privileges:', response.status, errorText);
                alert('Error saving privileges.');
            }
        } catch (error) {
            console.error('Error during saving privileges:', error);
            alert('Error during saving privileges.');
        }
    }
    

    // Inizializzazione della pagina
    (async function initializePage() {
        const userData = await getUserDetails(memberId);
        if (userData) {
            userNameDisplay.textContent = userData.name;
            document.title = `Selezione Ruoli - ${userData.name}`; // Aggiorna il titolo della pagina
            buildPrivilegeGrid(userData.privileges || {});
        }
    })();

    // Gestisci il click sul pulsante Salva
    saveRoleBtn.addEventListener('click', savePrivileges);
});
