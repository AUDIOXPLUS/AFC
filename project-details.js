// Funzione per gestire le risposte delle API
window.handleResponse = function(response) {
    if (response.status === 401) {
        window.location.replace('login.html');
        throw new Error('Unauthorized');
    }
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
};

// Funzione di utilità per gestire gli errori di rete
function handleNetworkError(error) {
    console.error('Network error:', error);
    // Se l'errore è di tipo network (offline) o 401 (non autorizzato)
    if (!navigator.onLine || (error.response && error.response.status === 401)) {
        window.location.replace('login.html');
    }
}

// Aggiunta di un listener per l'evento DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    // Verifica lo stato della connessione
    if (!navigator.onLine) {
        window.location.replace('login.html');
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    window.projectId = urlParams.get('id'); // Dichiarato come variabile globale
    // Controllo autorizzazione: se l'ID del progetto non è presente nella lista autorizzata salvata, inibisci l'accesso.
    let allowedProjectIds = JSON.parse(localStorage.getItem('allowedProjectIds') || '[]');
    if (!allowedProjectIds.includes(window.projectId)) {
        console.error('Accesso negato: l\'utente non ha i permessi per visualizzare i dettagli del progetto.');
        window.location.href = 'projects.html';
        return;
    }
    window.currentUserId = null; // Memorizza l'ID utente corrente per le operazioni sui file

    // Recupera e visualizza il nome utente - gestisce entrambi gli endpoint possibili
    try {
        let userData;
        try {
            // Prima prova con /api/session-user
            const response = await fetch('/api/session-user');
            if (response.ok) {
                userData = await response.json();
            } else {
                throw new Error('Endpoint session-user non disponibile');
            }
        } catch (firstError) {
            console.log('Tentativo con secondo endpoint dopo errore:', firstError);
            // Se fallisce, prova con /api/users/current
            const response = await fetch('/api/users/current');
            if (response.ok) {
                userData = await response.json();
            } else {
                throw new Error('Nessun endpoint utente disponibile');
            }
        }

        console.log('userData ottenuto:', userData);

        if (userData && (userData.username || userData.name)) {
            window.currentUserId = String(userData.id);
            window.currentUserName = userData.name || userData.username;
            // Rimosso "Welcome, " dal testo
            document.querySelector('.user-info span').textContent = `${window.currentUserName}`;
        } else {
            console.error('Dati utente non validi:', userData);
            window.location.replace('login.html');
            return;
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        // Non reindirizziamo alla pagina di login per evitare un loop
        // Impostiamo valori predefiniti per consentire l'esecuzione
        window.currentUserId = '1';
        window.currentUserName = 'Guest';
    }

    // Funzione per recuperare i dettagli del progetto
    window.fetchProjectDetails = async function(projectId) {
        try {
            // Recupera i dettagli del progetto
            const response = await fetch(`/api/projects/${projectId}`);
            const project = await window.handleResponse(response);

            // Resetta lo stato "nuovo" per i task di questo progetto per l'utente corrente
            try {
                await fetch(`/api/projects/${projectId}/reset-new-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: window.currentUserId
                    })
                });
            } catch (error) {
                console.error('Error resetting new status:', error);
            }

            // Aggiorna il titolo del progetto
            document.getElementById('project-model-number').textContent = project.modelNumber;
            document.title = `Project Details: ${project.modelNumber}`;

            // Recupera lo status dalla cronologia filtrata
            const historyResponse = await fetch(`/api/projects/${projectId}/history`);
            const history = await window.handleResponse(historyResponse);

            // Determina lo status da mostrare
            let statusToShow = '-';
            let statusVisible = true;

            if (history.length > 0) {
                // La cronologia è già filtrata per mostrare solo entry pubbliche o dell'utente corrente
                const activeEntry = history.find(entry => entry.status !== 'Completed');

                if (!activeEntry) {
                    statusToShow = 'Completed';
                } else if (activeEntry.status === 'On Hold') {
                    statusToShow = 'On Hold';
                } else {
                    statusToShow = activeEntry.status;
                }

                // Verifica se lo status deve essere visibile in base al campo private_by
                if (activeEntry && activeEntry.private_by !== null) {
                    // Se private_by è valorizzato, verifica se l'utente corrente è nella lista
                    const privateBy = String(activeEntry.private_by);
                    const currentUserId = String(window.currentUserId);

                    if (privateBy === currentUserId) {
                        // L'utente corrente è il proprietario, lo status è visibile
                        statusVisible = true;
                    } else if (privateBy.includes(',')) {
                        // Verifica se l'utente corrente è nella lista degli utenti condivisi
                        const userIds = privateBy.split(',');
                        statusVisible = userIds.includes(currentUserId);
                    } else {
                        // L'utente corrente non è il proprietario e non è nella lista, lo status non è visibile
                        statusVisible = false;
                    }
                }
            }

            // Aggiorna il riepilogo del progetto
            const detailsDiv = document.getElementById('project-details');
            let htmlContent = `
                <p><strong>Factory:</strong> ${project.factory || '-'}</p>
                <p><strong>Model Number:</strong> ${project.modelNumber || '-'}</p>
                <p><strong>Factory Model Number:</strong> ${project.factoryModelNumber || '-'}</p>
                <p><strong>Product Kind:</strong> ${project.productKind || '-'}</p>
                <p><strong>Client:</strong> ${project.client || '-'}</p>
                <p><strong>Start Date:</strong> ${project.startDate || '-'}</p>
                <p><strong>End Date:</strong> ${project.endDate || '-'}</p>
            `;

            // Aggiungi lo status solo se è visibile
            if (statusVisible) {
                htmlContent += `<p><strong>Status:</strong> ${statusToShow}</p>`;
            }

            detailsDiv.innerHTML = htmlContent;
        } catch (error) {
            handleNetworkError(error);
        }
    };

    // Funzione per recuperare i membri del team
    window.fetchTeamMembers = async function() {
        try {
            const response = await fetch('/api/team-members');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const members = await response.json();
            window.teamMembers = members;
            console.log('Team members caricati:', members);
            return members;
        } catch (error) {
            console.error('Errore nel caricamento dei membri del team:', error);
            handleNetworkError(error);
            return [];
        }
    };

    // Funzione per recuperare le fasi del progetto
    window.fetchProjectPhases = async function() {
        try {
            const response = await fetch('/api/phases');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const phases = await response.json();
            window.projectPhases = phases;
            window.dispatchEvent(new CustomEvent('phasesLoaded', { detail: phases }));
        } catch (error) {
            handleNetworkError(error);
        }
    };

    if (projectId) {
        await window.fetchTeamMembers(); // Assicura che teamMembers sia popolato prima
        await window.fetchProjectDetails(projectId);
        await window.fetchProjectPhases();
    } else {
        console.error('No project ID provided');
    }

    // Accesso al pulsante con l'ID corretto (add-entry-btn invece di add-history-btn)
    const addEntryBtn = document.getElementById('add-entry-btn');
    if (addEntryBtn) {
        addEntryBtn.addEventListener('click', () => {
            if (window.ProjectHistory && typeof window.ProjectHistory.addHistoryEntry === 'function') {
                window.ProjectHistory.addHistoryEntry(projectId);
            } else {
                console.error("La funzione addHistoryEntry non è disponibile. Verificare che project-history.js sia caricato correttamente.");
            }
        });
    } else {
        console.error("Elemento add-entry-btn non trovato nel DOM");
    }

    // Gestione del pulsante urge tasks
    const urgeTasksBtn = document.getElementById('urge-tasks-btn');
    if (urgeTasksBtn) {
        urgeTasksBtn.addEventListener('click', async () => {
            try {
                // Disabilita il pulsante durante l'operazione
                urgeTasksBtn.disabled = true;
                urgeTasksBtn.textContent = "Processing...";

                // Chiamata API per aggiornare i task
                const response = await fetch(`/api/tasks/urge-project-tasks/${projectId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Errore nella chiamata API: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();

                // Mostra messaggio di conferma in inglese
                alert(`Operation completed successfully! ${result.rowsAffected} tasks have been urged.`);

                console.log('Risultato urge tasks:', result);
            } catch (error) {
                console.error('Errore durante l\'aggiornamento dei task:', error);
                alert(`An error occurred: ${error.message}`);
            } finally {
                // Ripristina il pulsante
                urgeTasksBtn.disabled = false;
                urgeTasksBtn.textContent = "Urge Tasks";
            }
        });
    } else {
        console.error("Elemento urge-tasks-btn non trovato nel DOM");
    }

    // Inizializza le funzionalità della tabella dopo aver caricato la cronologia
    // Verifica le funzioni disponibili prima di chiamarle
    if (window.ProjectHistory && typeof window.ProjectHistory.fetchProjectHistory === 'function') {
        // fetchProjectHistory ora restituisce un oggetto { history, latestEntries }
        const historyData = await window.ProjectHistory.fetchProjectHistory(projectId);
        if (historyData && historyData.latestEntries) {
            // Passa latestEntries direttamente a updatePhaseSummary
            window.updatePhaseSummary(historyData.latestEntries);
        } else {
             console.warn("latestEntries non restituito da fetchProjectHistory. Il riepilogo fasi potrebbe non essere aggiornato.");
             // Prova ad aggiornare in modo legacy se possibile, ma logga un warning
             window.updatePhaseSummary(); // Chiamata legacy con warning interno
        }
    } else {
        console.error("La funzione fetchProjectHistory non è disponibile. Verificare che project-history.js sia caricato correttamente.");
    }

    // Gestione del pulsante di highlighting per record specifici
    const highlightBtn = document.getElementById('highlight-record-btn');
    const highlightInput = document.getElementById('highlight-record-id');

    if (highlightBtn && highlightInput) {
        // Funzione per evidenziare un record specifico basato sull'ID
        // La rendiamo globale così può essere usata anche dall'event listener mouseenter
        window.highlightRecordById = function(recordId) {
            // Rimuovi evidenziazione precedente se presente
            const previousHighlighted = document.querySelectorAll('.record-highlight');
            previousHighlighted.forEach(el => {
                el.classList.remove('record-highlight');
                el.style.backgroundColor = '';
                el.style.boxShadow = '';
                el.style.fontWeight = '';
                el.style.color = '';
                el.style.transform = '';
            });

            // Cerca il record con l'ID specificato
            const row = document.querySelector(`tr[data-entry-id="${recordId}"]`);

            if (row) {
                console.log(`Record con ID ${recordId} trovato, applico highlight`);

                // Salva lo stile originale (se non già memorizzato nell'elemento)
                if (!row._originalStyle) {
                    row._originalStyle = {
                        backgroundColor: row.style.backgroundColor,
                        color: row.style.color,
                        fontWeight: row.style.fontWeight
                    };
                }

                // Applica stile evidente
                row.classList.add('record-highlight');
                row.style.backgroundColor = '#ff0000'; // Rosso acceso
                row.style.color = 'white';
                row.style.fontWeight = 'bold';
                row.style.boxShadow = '0 0 15px 5px red';
                row.style.position = 'relative';
                row.style.zIndex = '1000';
                row.style.transform = 'translateY(-2px)'; // Effetto 3D lieve

                // Scorre alla riga evidenziata
                row.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });

                // Aggiungi un badge con l'ID
                const firstCell = row.cells[0];
                const badge = document.createElement('span');
                badge.textContent = `ID: ${recordId}`;
                badge.style.backgroundColor = 'red';
                badge.style.color = 'white';
                badge.style.padding = '2px 5px';
                badge.style.borderRadius = '3px';
                badge.style.marginRight = '5px';
                badge.style.fontWeight = 'bold';
                badge.style.fontSize = '12px';

                // Inserisci il badge all'inizio della cella
                if (firstCell.firstChild) {
                    firstCell.insertBefore(badge, firstCell.firstChild);
                } else {
                    firstCell.appendChild(badge);
                }

                return true;
            } else {
                console.error(`Record con ID ${recordId} non trovato nella tabella`);

                // Se i filtri sono attivi, suggerisci di disabilitarli
                const filteringActive = document.querySelector('.filter-active');
                if (filteringActive) {
                    alert(`Record con ID ${recordId} non trovato. Potrebbero essere attivi dei filtri che nascondono il record. Prova a disattivare i filtri.`);
                } else {
                    alert(`Record con ID ${recordId} non trovato nella tabella.`);
                }

                return false;
            }
        }

        // Event listener per il pulsante di highlight
        highlightBtn.addEventListener('click', () => {
            const recordId = highlightInput.value.trim();
            if (recordId) {
                highlightRecordById(recordId);
            } else {
                alert('Inserisci un ID valido.');
                highlightInput.focus();
            }
        });

        // Event listener per il tasto Enter nel campo input
        highlightInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                highlightBtn.click();
            }
        });
    }

    // Verifica se le funzioni di gestione delle colonne sono disponibili
    if (typeof window.restoreColumnWidths === 'function') {
        window.restoreColumnWidths();
    }
    if (typeof window.enableColumnResizing === 'function') {
        window.enableColumnResizing();
    }
    if (typeof window.enableColumnSorting === 'function') {
        window.enableColumnSorting();
    }

    // Inizializza il filtraggio
    window.filteringApi = enableLiveFiltering();
});

// Funzione per aggiornare la phase summary usando i dati precalcolati
window.updatePhaseSummary = function(latestEntries) {
    // Se latestEntries non viene passato, prova a calcolarlo in modo legacy (con warning)
    if (!latestEntries) {
        console.warn("updatePhaseSummary chiamata senza latestEntries. Tentativo di calcolo legacy dal DOM (inefficiente).");
        const historyTable = document.getElementById('history-table');
        if (!historyTable) return;
        const rows = historyTable.getElementsByTagName('tbody')[0].rows;
        if (rows.length === 0) return;
        latestEntries = {};
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].style.display !== 'none') {
                const date = new Date(rows[i].cells[0].textContent.trim());
                const phase = rows[i].cells[1].textContent.trim();
                const description = rows[i].cells[2].textContent.trim();
                if (!latestEntries[phase] || date > latestEntries[phase].date) {
                    latestEntries[phase] = { date: date, description: description };
                }
            }
        }
    }

    // Crea il contenuto HTML per tutte le fasi usando DocumentFragment per efficienza
    const phaseSummaryDiv = document.getElementById('phase-summary');
    if (phaseSummaryDiv) {
        const fragment = document.createDocumentFragment();
        const phases = Object.keys(latestEntries); // Ottieni le chiavi (nomi delle fasi)

        phases.forEach((phase, index) => {
            const entry = latestEntries[phase];
            const phaseEntryDiv = document.createElement('div');
            phaseEntryDiv.className = 'phase-entry';

            const phaseTitleDiv = document.createElement('div');
            const strong = document.createElement('strong');
            strong.textContent = phase;
            phaseTitleDiv.appendChild(strong);

            const descriptionDiv = document.createElement('div');
            // Pulisci la descrizione come viene fatto nella tabella principale
            let cleanDescription = entry.description;
            cleanDescription = cleanDescription.replace(/(forward-|reply-)/gi, '');
            cleanDescription = cleanDescription.replace(/\s*\[Parent:\s*\d+\]/g, '');
            descriptionDiv.textContent = cleanDescription;
            descriptionDiv.title = entry.description; // Tooltip con descrizione completa

            phaseEntryDiv.appendChild(phaseTitleDiv);
            phaseEntryDiv.appendChild(descriptionDiv);
            fragment.appendChild(phaseEntryDiv);

            // Aggiungi <hr> tranne che dopo l'ultimo elemento
            if (index < phases.length - 1) {
                const hr = document.createElement('hr');
                fragment.appendChild(hr);
            }
        });

        // Sostituisci il contenuto del div in una sola operazione DOM
        phaseSummaryDiv.innerHTML = ''; // Pulisci il contenuto precedente
        phaseSummaryDiv.appendChild(fragment); // Aggiungi il nuovo contenuto
    }
};

// Function to enable live filtering
function enableLiveFiltering() {
    console.log('Initializing live filtering...');

    // Oggetto per esporre funzioni pubbliche
    const publicApi = {};

    // Gestione dropdown status
    const statusDropdownBtn = document.getElementById('status-dropdown-btn');
    const statusDropdown = document.getElementById('status-filter');

    if (!statusDropdownBtn || !statusDropdown) {
        console.error('Dropdown elements not found in DOM');
        return;
    }

    console.log('Dropdown elements found:', {
        statusDropdownBtn: statusDropdownBtn,
        statusDropdown: statusDropdown
    });

    const statusCheckboxes = statusDropdown.querySelectorAll('input[type="checkbox"]');

    // Gestione apertura/chiusura dropdown con miglior controllo degli eventi
    statusDropdownBtn.addEventListener('click', function(event) {
        event.stopPropagation();
        statusDropdown.style.display = statusDropdown.style.display === 'block' ? 'none' : 'block';
        statusDropdownBtn.classList.toggle('active');
    });

    // Previene la chiusura quando si clicca dentro il dropdown
    statusDropdown.addEventListener('click', function(event) {
        event.stopPropagation();
    });

    // Chiudi dropdown quando si clicca fuori
    document.addEventListener('click', function() {
        statusDropdown.style.display = 'none';
        statusDropdownBtn.classList.remove('active');
    });

    // Gestione delle checkbox del filtro status
    statusCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            applyFilters();
            // Aggiorna immediatamente il display degli stati selezionati
            updateStatusDisplay();
        });
    });

    // Gestione filtri testo
    const textFilterInputs = document.querySelectorAll('.filters input[type="text"]');
    const tableRows = document.getElementById('history-table').getElementsByTagName('tbody')[0].rows;
    const filterIndices = [1, 3]; // Indici delle colonne da filtrare

    // Funzione per aggiornare il display degli stati selezionati
    function updateStatusDisplay() {
        const selectedCheckboxes = Array.from(statusCheckboxes).filter(cb => cb.checked);

        if (selectedCheckboxes.length === 0) {
            statusDropdownBtn.textContent = 'Status';
            statusDropdownBtn.classList.remove('filter-active');
        } else {
            const selectedStatuses = selectedCheckboxes.map(cb => cb.getAttribute('data-abbr'));
            statusDropdownBtn.textContent = selectedStatuses.join(', ');
            statusDropdownBtn.classList.add('filter-active');
        }
    }

    // Funzione per salvare i filtri nel localStorage
    function saveFilters(textFilterValues, selectedStatuses) {
        const filters = {
            text: textFilterValues,
            status: selectedStatuses
        };
        localStorage.setItem('historyFilters', JSON.stringify(filters));
    }

    // Funzione per applicare i filtri
    function applyFilters() {
        const textFilterValues = Array.from(textFilterInputs).map(input => input.value.toLowerCase().trim());
        const selectedStatuses = Array.from(statusCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        // Aggiorna lo stile dei filtri attivi
        textFilterInputs.forEach(input => {
            input.classList.toggle('filter-active', input.value.trim() !== '');
        });

        statusDropdownBtn.classList.toggle('filter-active', selectedStatuses.length > 0);

        // Salva i filtri nel localStorage
        saveFilters(textFilterValues, selectedStatuses);

        updateStatusDisplay();

        Array.from(tableRows).forEach(row => {
            let isMatch = true;

            // Controllo filtri testo
            for (let i = 0; i < textFilterValues.length; i++) {
                const filterValue = textFilterValues[i];
                const cellIndex = filterIndices[i];
                const cell = row.cells[cellIndex];

                if (cell && filterValue) {
                    const cellText = cell.textContent.toLowerCase().trim();
                    if (!cellText.includes(filterValue)) {
                        isMatch = false;
                        break;
                    }
                }
            }

            // Controllo filtro status
            if (isMatch && selectedStatuses.length > 0) {
                const statusCell = row.cells[4];
                const statusText = statusCell.textContent.trim();
                if (!selectedStatuses.includes(statusText)) {
                    isMatch = false;
                }
            }

            row.style.display = isMatch ? '' : 'none';
        });
    }

    // Funzione per caricare e applicare i filtri salvati
    function loadSavedFilters() {
        const savedFilters = localStorage.getItem('historyFilters');
        if (savedFilters) {
            const filters = JSON.parse(savedFilters);

            // Applica i filtri di testo
            textFilterInputs.forEach((input, index) => {
                input.value = filters.text[index] || '';
            });

            // Applica i filtri di stato
            statusCheckboxes.forEach(checkbox => {
                checkbox.checked = filters.status.includes(checkbox.value);
            });

            // Applica i filtri
            applyFilters();
        }
    }

    // Event listeners per i filtri
    textFilterInputs.forEach(input => {
        input.addEventListener('input', applyFilters);
    });

    statusCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });

    // Carica i filtri salvati e inizializza il display degli stati
    loadSavedFilters();
    updateStatusDisplay();

    // Espone le funzioni necessarie
    publicApi.applyFilters = applyFilters;

    // Salva il riferimento globale
    filteringApi = publicApi;

    return publicApi;
}
