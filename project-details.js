// Aggiunta di un listener per l'evento DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    window.projectId = urlParams.get('id'); // Dichiarato come variabile globale
    window.currentUserId = null; // Memorizza l'ID utente corrente per le operazioni sui file

    // Recupera e visualizza il nome utente
    try {
        const response = await fetch('/api/session-user');
        const userData = await window.handleResponse(response);
        console.log('userData:', userData);
        if (userData && userData.username) {
            window.currentUserId = String(userData.id);
            if (userData.name) {
                document.querySelector('.user-info span').textContent = `Welcome, ${userData.name}`;
            }
        } else {
            console.error('userData.username is missing or null');
            window.location.href = '/login.html';
            return;
        }
    } catch (error) {
        console.error('Error fetching session user:', error);
        window.location.href = '/login.html';
        return;
    }

    // Funzione per recuperare i dettagli del progetto
    window.fetchProjectDetails = async function(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}`);
            const project = await window.handleResponse(response);
            
            // Aggiorna il titolo del progetto
            document.getElementById('project-model-number').textContent = project.modelNumber;
            document.title = `Project Details: ${project.modelNumber}`;
            
            // Aggiorna il riepilogo del progetto
            const detailsDiv = document.getElementById('project-details');
            detailsDiv.innerHTML = `
                <p><strong>Factory:</strong> ${project.factory || 'N/A'}</p>
                <p><strong>Model Number:</strong> ${project.modelNumber}</p>
                <p><strong>Factory Model Number:</strong> ${project.factoryModelNumber || 'N/A'}</p>
                <p><strong>Product Kind:</strong> ${project.productKind || 'N/A'}</p>
                <p><strong>Client:</strong> ${project.client || 'N/A'}</p>
                <p><strong>Start Date:</strong> ${project.startDate || 'N/A'}</p>
                <p><strong>End Date:</strong> ${project.endDate || 'N/A'}</p>
                <p><strong>Status:</strong> ${project.status || 'N/A'}</p>
            `;
        } catch (error) {
            console.error('Error fetching project details:', error);
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
            console.error('Error fetching phases:', error);
        }
    };

    if (projectId) {
        await window.fetchTeamMembers(); // Assicura che teamMembers sia popolato prima
        await window.fetchProjectDetails(projectId);
        await window.fetchProjectPhases();
    } else {
        console.error('No project ID provided');
    }

    document.getElementById('add-history-btn').addEventListener('click', () => window.addHistoryEntry(projectId));
    
    // Inizializza le funzionalità della tabella dopo aver caricato la cronologia
    await window.fetchProjectHistory(projectId);
    window.updatePhaseSummary(); // Aggiungi questa linea
    window.restoreColumnWidths();
    window.enableColumnResizing();
    window.enableColumnSorting();
    enableLiveFiltering();
});

// Funzione per aggiornare la phase summary con l'ultima entry di ogni fase
window.updatePhaseSummary = function() {
    const historyTable = document.getElementById('history-table');
    if (!historyTable) return;

    const rows = historyTable.getElementsByTagName('tbody')[0].rows;
    if (rows.length === 0) return;

    // Oggetto per memorizzare l'ultima entry di ogni fase
    const latestEntries = {};

    // Itera su tutte le righe della tabella
    for (let i = 0; i < rows.length; i++) {
        const date = new Date(rows[i].cells[0].textContent.trim());
        const phase = rows[i].cells[1].textContent.trim();
        const description = rows[i].cells[2].textContent.trim();

        // Se la fase non esiste o se questa entry è più recente
        if (!latestEntries[phase] || date > latestEntries[phase].date) {
            latestEntries[phase] = {
                date: date,
                description: description
            };
        }
    }

    // Crea il contenuto HTML per tutte le fasi
    const phaseSummaryDiv = document.getElementById('phase-summary');
    if (phaseSummaryDiv) {
        let htmlContent = '';
        for (const [phase, entry] of Object.entries(latestEntries)) {
            htmlContent += `
                <div class="phase-entry">
                    <div><strong>${phase}</strong></div>
                    <div>${entry.description}</div>
                </div>
                <hr>
            `;
        }
        
        // Rimuovi l'ultimo <hr>
        htmlContent = htmlContent.replace(/<hr>[^<]*$/, '');
        
        phaseSummaryDiv.innerHTML = htmlContent;
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
    
    // Apertura/chiusura dropdown
    statusDropdownBtn.addEventListener('click', function(event) {
        console.log('Status dropdown button clicked');
        console.log('Current dropdown state:', statusDropdown.classList.contains('show'));
        event.stopPropagation(); // Previene la propagazione dell'evento
        statusDropdown.classList.toggle('show');
        console.log('New dropdown state:', statusDropdown.classList.contains('show'));
        
        // Forza il repaint del dropdown
        statusDropdown.style.display = 'none';
        statusDropdown.offsetHeight; // Trigger reflow
        statusDropdown.style.display = '';
    });

    // Chiudi dropdown quando si clicca fuori
    document.addEventListener('click', function(event) {
        console.log('Document clicked, target:', event.target);
        const dropdown = document.getElementById('status-filter');
        const isClickOutside = !event.target.matches('#status-dropdown-btn') && 
                             !event.target.closest('.dropdown-content');
        
        console.log('Is click outside:', isClickOutside);
        console.log('Dropdown state:', dropdown?.classList.contains('show'));
        
        if (dropdown && dropdown.classList.contains('show') && isClickOutside) {
            console.log('Closing dropdown');
            dropdown.classList.remove('show');
        }
    });

    // Gestione filtri testo
    const textFilterInputs = document.querySelectorAll('.filters input[type="text"]');
    const tableRows = document.getElementById('history-table').getElementsByTagName('tbody')[0].rows;
    const filterIndices = [1, 3]; // Indici delle colonne da filtrare

    // Funzione per aggiornare il display degli stati selezionati
    function updateStatusDisplay() {
        const selectedCheckboxes = Array.from(statusCheckboxes).filter(cb => cb.checked);
        const statusDropdownBtn = document.getElementById('status-dropdown-btn');
        
        if (selectedCheckboxes.length === 0) {
            statusDropdownBtn.textContent = 'Status';
            return;
        }

        const selectedStatuses = selectedCheckboxes.map(cb => cb.getAttribute('data-abbr'));
        statusDropdownBtn.textContent = selectedStatuses.join(', ');
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
