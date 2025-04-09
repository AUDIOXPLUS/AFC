// Funzione di utilità per gestire gli errori di rete
function handleNetworkError(error) {
    console.error('Network error:', error);
    // Se l'errore è di tipo network (offline)
    if (!navigator.onLine) {
        window.location.href = 'login.html';
        return;
    }

    // Se la risposta contiene uno status 401 (non autorizzato)
    if (error instanceof Error && error.message.includes('status: 401')) {
        window.location.href = 'login.html';
        return;
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM content loaded, initializing dashboard...');
    await initializeDashboard();
});

// Variabili globali per memorizzare factory e client
window.factories = [];
window.clients = [];

async function initializeDashboard() {
    console.log(`initializeDashboard called. Timestamp: ${Date.now()}`); // Log start of initialization
    document.getElementById('logout').addEventListener('click', function() {
        window.location.href = 'login.html';
    });

    // Carica le factory disponibili
    try {
        const factoryResponse = await fetch('/api/team-members/factories');
        if (!factoryResponse.ok) {
            throw new Error(`HTTP error! status: ${factoryResponse.status}`);
        }
        window.factories = await factoryResponse.json();
        console.log('Factories caricate:', window.factories); // Log in italiano
    } catch (error) {
        console.error('Errore nel caricamento delle factory:', error); // Log in italiano
        handleNetworkError(error); // Gestione errore generica
    }

    // Carica i client disponibili
    try {
        const clientResponse = await fetch('/api/team-members/clients');
        if (!clientResponse.ok) {
            throw new Error(`HTTP error! status: ${clientResponse.status}`);
        }
        window.clients = await clientResponse.json();
        console.log('Client caricati:', window.clients); // Log in italiano
    } catch (error) {
        console.error('Errore nel caricamento dei client:', error); // Log in italiano
        handleNetworkError(error); // Gestione errore generica
    }


    // Add event listener for the "Add Project" button
    document.getElementById('add-project-btn').addEventListener('click', addProject);

    // Carica i product kinds
    try {
        const response = await fetch('/api/product-kinds');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const productKinds = await response.json();
        window.productKinds = productKinds;
        window.dispatchEvent(new CustomEvent('productKindsLoaded', { detail: productKinds }));
    } catch (error) {
        handleNetworkError(error);
    }

    // Enable column resizing
    enableColumnResizing();

    // Enable column sorting
    enableColumnSorting();

    // Enable live filtering
    enableLiveFiltering();

    // Inizializza la gestione della visibilità delle colonne
    initializeColumnVisibility();

    // Add event listener for the "Clone/Merge Project" button
    document.getElementById('clone-merge-project-btn').addEventListener('click', openCloneMergeModal);

    // Initial fetch of projects (includerà il sorting e l'aggiornamento dei conteggi)
    await fetchProjects();

    // Restituisce l'API di filtraggio per poterla usare esternamente se necessario
    return filteringApi;
}

// --- Funzione per recuperare i conteggi totali dei progetti ---
async function fetchProjectCounts() {
    console.log('Fetching project counts...'); // Log in italiano: Recupero conteggi progetti...
    try {
        // Chiama l'endpoint principale con il parametro countOnly=true
        const response = await fetch('/api/projects?countOnly=true'); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const counts = await response.json();
        console.log('Project counts received:', counts); // Log in italiano: Conteggi ricevuti:

        // Aggiorna i conteggi nell'HTML
        const archivedCountSpan = document.getElementById('archived-count');
        const onHoldCountSpan = document.getElementById('on-hold-count');
        const activeProjectCountSpan = document.getElementById('active-project-count');

        if (archivedCountSpan) archivedCountSpan.textContent = (counts.archived || 0);
        if (onHoldCountSpan) onHoldCountSpan.textContent = (counts.onHold || 0);
        if (activeProjectCountSpan) activeProjectCountSpan.textContent = counts.active || 0;

    } catch (error) {
        console.error('Errore nel recupero dei conteggi dei progetti:', error); // Log in italiano
        // Non bloccante, ma logga l'errore. Potremmo mostrare 'N/A' o '-' nei conteggi.
        const archivedCountSpan = document.getElementById('archived-count');
        const onHoldCountSpan = document.getElementById('on-hold-count');
        const activeProjectCountSpan = document.getElementById('active-project-count');
        if (archivedCountSpan) archivedCountSpan.textContent = '-';
        if (onHoldCountSpan) onHoldCountSpan.textContent = '-';
        if (activeProjectCountSpan) activeProjectCountSpan.textContent = '-';
        handleNetworkError(error); // Gestione errore generica se necessario
    }
}

// --- Funzioni per Clone/Merge ---

// Funzione per aprire la modale Clone/Merge
function openCloneMergeModal() {
    const modal = document.getElementById('clone-merge-modal');
    if (modal) {
        populateCloneMergeModal(); // Popola la lista prima di mostrarla
        modal.style.display = 'block';
        // Aggiungi l'event listener per il pulsante Confirm *solo* quando la modale è aperta
        const confirmBtn = document.getElementById('confirm-clone-merge-btn');
        if (confirmBtn) {
            // Rimuovi eventuali listener precedenti per evitare duplicati
             confirmBtn.removeEventListener('click', handleCloneMergeConfirm);
             confirmBtn.addEventListener('click', handleCloneMergeConfirm);
         }
         // Aggiungi event listener per i NUOVI filtri
         const clientFilterInput = document.getElementById('modal-client-filter');
         const modelFilterInput = document.getElementById('modal-model-filter');
         
         if (clientFilterInput) {
             clientFilterInput.removeEventListener('input', filterModalProjects); // Rimuovi listener precedenti
             clientFilterInput.addEventListener('input', filterModalProjects);
             clientFilterInput.value = ''; // Pulisci il filtro all'apertura
         }
          if (modelFilterInput) {
             modelFilterInput.removeEventListener('input', filterModalProjects); // Rimuovi listener precedenti
             modelFilterInput.addEventListener('input', filterModalProjects);
             modelFilterInput.value = ''; // Pulisci il filtro all'apertura
         }
         filterModalProjects(); // Applica filtro iniziale (mostra tutto)
         
     } else {
         console.error('Clone/Merge modal element not found.');
     }
 }

 // Funzione per chiudere la modale Clone/Merge
 function closeCloneMergeModal() {
     // Pulisci anche i NUOVI filtri quando si chiude
     const clientFilterInput = document.getElementById('modal-client-filter');
     const modelFilterInput = document.getElementById('modal-model-filter');
     if (clientFilterInput) {
         clientFilterInput.value = '';
     }
      if (modelFilterInput) {
         modelFilterInput.value = '';
     }
     const modal = document.getElementById('clone-merge-modal');
     if (modal) {
         modal.style.display = 'none';
        // Opzionale: pulire la lista dei progetti nella modale
        const projectListContainer = document.getElementById('modal-project-list');
        if (projectListContainer) {
            projectListContainer.innerHTML = 'Loading projects...'; // Reset content
        }
        // Rimuovi l'event listener dal pulsante Confirm quando la modale si chiude
        const confirmBtn = document.getElementById('confirm-clone-merge-btn');
         if (confirmBtn) {
             confirmBtn.removeEventListener('click', handleCloneMergeConfirm);
         }
    }
}

// Funzione per popolare la modale con i progetti attivi
async function populateCloneMergeModal() {
    const projectListContainer = document.getElementById('modal-project-list');
    if (!projectListContainer) {
        console.error('Modal project list container not found.');
        return;
    }
    projectListContainer.innerHTML = 'Loading active projects...'; // Messaggio di caricamento

    try {
        // Fetch solo progetti attivi (non archiviati, non completati - assumendo che l'API lo supporti)
        // Potremmo aggiungere parametri tipo ?status=active o filtrare lato client
        const response = await fetch('/api/projects?showArchived=false&showOnHold=false'); // Filtra archiviati e on hold
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let projects = await response.json();

        // Filtra ulteriormente per escludere i progetti completati (se non già fatto dall'API)
        projects = projects.filter(p => p.latest_status !== 'Completed');

        projectListContainer.innerHTML = ''; // Pulisci il container

        if (projects.length === 0) {
            projectListContainer.innerHTML = 'No active projects found to clone or merge.';
            return;
        }

        projects.forEach(project => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = project.id;
             checkbox.dataset.projectName = `${project.client} - ${project.modelNumber}`; // Salva nome per riferimento

             label.appendChild(checkbox);
             // Rimosso (ID: ${project.id}) dal testo visualizzato
             label.appendChild(document.createTextNode(` ${project.client} - ${project.modelNumber}`)); 
             projectListContainer.appendChild(label);
         });

    } catch (error) {
        handleNetworkError(error);
        projectListContainer.innerHTML = 'Error loading projects. Please try again.';
    }
}

// Funzione per gestire la conferma del Clone/Merge
async function handleCloneMergeConfirm() {
    const selectedCheckboxes = document.querySelectorAll('#modal-project-list input[type="checkbox"]:checked');
    const selectedProjectIds = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (selectedProjectIds.length === 0) {
        alert('Please select at least one project.');
        return;
    }

    closeCloneMergeModal(); // Chiudi la modale prima di iniziare l'operazione

    // Mostra popup di caricamento generico
    const loadingPopup = document.getElementById('loading-popup');
    if (loadingPopup) {
        loadingPopup.querySelector('h2').textContent = 'Processing...';
        loadingPopup.querySelector('p').textContent = 'Please wait while the operation is being completed.';
        // Nascondi la barra di progresso se presente, o impostala a indeterminato
        const progressContainer = loadingPopup.querySelector('.loading-progress-container');
        if (progressContainer) progressContainer.style.display = 'none';
        loadingPopup.style.display = 'flex';
    }


    try {
        let response;
        if (selectedProjectIds.length === 1) {
            // --- CLONE ---
            const projectIdToClone = selectedProjectIds[0];
            console.log(`Cloning project ID: ${projectIdToClone}`); // Log operazione
            response = await fetch(`/api/projects/${projectIdToClone}/clone`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Non serve body per il clone semplice
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to clone project.' }));
                throw new Error(errorData.error || `Clone failed with status: ${response.status}`);
            }
            console.log('Project cloned successfully.'); // Log successo

        } else {
            // --- MERGE ---
            console.log(`Merging projects IDs: ${selectedProjectIds.join(', ')}`); // Log operazione
            response = await fetch('/api/projects/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectIds: selectedProjectIds }),
            });
             if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ error: 'Failed to merge projects.' }));
                 throw new Error(errorData.error || `Merge failed with status: ${response.status}`);
             }
             console.log('Projects merged successfully.'); // Log successo
        }

        // Operazione completata con successo
        await fetchProjects(); // Aggiorna la tabella

    } catch (error) {
        console.error('Error during clone/merge:', error);
        alert(`An error occurred: ${error.message}`);
        // Nascondi popup in caso di errore
        if (loadingPopup) loadingPopup.style.display = 'none';
    } finally {
         // Assicurati che il popup di caricamento sia nascosto alla fine,
         // fetchProjects() lo nasconderà se ha successo, ma lo nascondiamo qui
         // per sicurezza in caso di errori non gestiti da fetchProjects
         if (loadingPopup && loadingPopup.style.display !== 'none') {
             // Ripristina testo e barra di progresso originali per usi futuri
             loadingPopup.querySelector('h2').textContent = 'Loading...';
             loadingPopup.querySelector('p').textContent = 'Please wait while the projects are being loaded.';
             const progressContainer = loadingPopup.querySelector('.loading-progress-container');
             if (progressContainer) progressContainer.style.display = 'flex'; // Mostra di nuovo
             updateLoadingProgress(0); // Resetta progresso
             loadingPopup.style.display = 'none';
         }
     }
 }
 
 // Funzione per filtrare i progetti nella modale (aggiornata per due filtri)
 function filterModalProjects() {
     const clientFilterInput = document.getElementById('modal-client-filter');
     const modelFilterInput = document.getElementById('modal-model-filter');
     const clientFilterText = clientFilterInput ? clientFilterInput.value.toLowerCase().trim() : '';
     const modelFilterText = modelFilterInput ? modelFilterInput.value.toLowerCase().trim() : '';
     
     const projectListContainer = document.getElementById('modal-project-list');
     const projectLabels = projectListContainer.getElementsByTagName('label');
 
     Array.from(projectLabels).forEach(label => {
         const checkbox = label.querySelector('input[type="checkbox"]');
         // Usa il dataset che contiene "Client - ModelNumber"
         const projectDataText = checkbox && checkbox.dataset.projectName ? checkbox.dataset.projectName.toLowerCase() : ''; 
 
         // Verifica la corrispondenza con entrambi i filtri
         const clientMatch = clientFilterText === '' || projectDataText.includes(clientFilterText);
          const modelMatch = modelFilterText === '' || projectDataText.includes(modelFilterText);
  
          // Mostra l'elemento solo se corrisponde ad ALMENO UNO dei filtri (o se entrambi i filtri sono vuoti)
          if (clientMatch || modelMatch) {
              label.style.display = 'block'; // Usa block per coerenza con CSS
          } else {
              label.style.display = 'none'; // Nascondi l'elemento
         }
     });
 }
 
 // --- Fine Funzioni per Clone/Merge ---

// Funzione per inizializzare la gestione della visibilità delle colonne
function initializeColumnVisibility() {
    const table = document.getElementById('projects-table');
    const checkboxes = document.querySelectorAll('.column-visibility input[type="checkbox"]');

    // Carica le preferenze salvate
    const savedVisibility = JSON.parse(localStorage.getItem('columnVisibility')) || {};

    // Inizializza i checkbox e applica la visibilità iniziale
    checkboxes.forEach(checkbox => {
        const columnIndex = parseInt(checkbox.dataset.column);
        checkbox.checked = savedVisibility[columnIndex] !== false; // Default a true se non salvato

        // Applica la visibilità iniziale
        if (!checkbox.checked) {
            hideColumn(table, columnIndex);
        }

        // Aggiungi event listener per i cambiamenti
        checkbox.addEventListener('change', (e) => {
            const columnIndex = parseInt(e.target.dataset.column);
            if (e.target.checked) {
                showColumn(table, columnIndex);
            } else {
                hideColumn(table, columnIndex);
            }
            saveColumnVisibility();
        });
    });
}

// Funzione per nascondere una colonna
function hideColumn(table, columnIndex) {
    const cells = table.getElementsByTagName('tr');
    Array.from(cells).forEach(row => {
        const cell = row.cells[columnIndex];
        if (cell) {
            cell.style.display = 'none';
        }
    });
}

// Funzione per mostrare una colonna
function showColumn(table, columnIndex) {
    const cells = table.getElementsByTagName('tr');
    Array.from(cells).forEach(row => {
        const cell = row.cells[columnIndex];
        if (cell) {
            cell.style.display = '';
        }
    });
}

// Funzione per salvare le preferenze di visibilità
function saveColumnVisibility() {
    const checkboxes = document.querySelectorAll('.column-visibility input[type="checkbox"]');
    const visibility = {};
    checkboxes.forEach(checkbox => {
        visibility[checkbox.dataset.column] = checkbox.checked;
    });
    localStorage.setItem('columnVisibility', JSON.stringify(visibility));
}

// Variabile globale per mantenere il riferimento alle funzioni di filtering
let filteringApi = null;

// Funzione per archiviare/disarchiviare un progetto
async function toggleArchiveProject(projectId, archive) {
    try {
        const response = await fetch(`/api/projects/${projectId}/archive`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ archive }),
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Error updating project archive status');
            return false;
        }

        return true;
    } catch (error) {
        handleNetworkError(error);
        return false;
    }
}

// Funzione helper per applicare l'ultimo sorting
function applyLastSorting() {
    const table = document.getElementById('projects-table');
    const lastSorting = JSON.parse(localStorage.getItem('lastSorting'));
    if (lastSorting) {
        const headers = table.getElementsByTagName('th');
        if (headers[lastSorting.columnIndex]) {
            // Se la direzione salvata è false (discendente), clicca due volte per ottenere l'ordine discendente
            headers[lastSorting.columnIndex].click();
            if (!lastSorting.direction) {
                headers[lastSorting.columnIndex].click();
            }
        }
    } else {
        // Se non c'è un sorting salvato, usa product kind come default
        const productKindHeader = table.getElementsByTagName('th')[1];
        if (productKindHeader) {
            productKindHeader.click();
        }
    }
}

// Funzione helper per aggiornare la progress bar e la percentuale
function updateLoadingProgress(percentage) {
    const progressBar = document.getElementById('loading-progress'); // ID corretto della barra interna
    const percentageText = document.getElementById('loading-percentage'); // ID corretto dello span percentuale
    if (progressBar && percentageText) {
        const clampedPercentage = Math.max(0, Math.min(100, percentage)); // Assicura che sia tra 0 e 100
        // Usa setTimeout per dare al browser il tempo di aggiornare la UI
        setTimeout(() => {
            progressBar.style.width = `${clampedPercentage}%`; // Imposta la larghezza della barra interna
            percentageText.textContent = `${Math.round(clampedPercentage)}%`; // Aggiorna il testo della percentuale
            console.log(`Loading progress updated to ${clampedPercentage}%`); // Log progresso
        }, 0); // Ritardo minimo per mettere in coda l'aggiornamento
    } else {
        console.warn('Progress bar or percentage element not found in the DOM.');
    }
}

// Function to fetch project data from the backend
async function fetchProjects() {
    console.log(`fetchProjects called. Timestamp: ${Date.now()}`); // Add timestamp log
    console.log('Fetching projects...');
    const loadingPopup = document.getElementById('loading-popup');

    // Mostra il popup e imposta progresso a 0%
    if (loadingPopup) {
        loadingPopup.style.display = 'flex'; // Usa flex per centrare il contenuto
        updateLoadingProgress(0); // Inizia da 0%
    }

    // Aggiorna sempre i conteggi totali prima di caricare i progetti filtrati
    await fetchProjectCounts();

    try {
        // Fase 1: Fetch elenco progetti
        const showArchived = document.getElementById('show-archived').checked;
        const showOnHold = document.getElementById('show-on-hold').checked;
        const response = await fetch(`/api/projects?showArchived=${showArchived}&showOnHold=${showOnHold}`);
        if (!response.ok) {
            // Nascondi popup in caso di errore fetch iniziale
            if (loadingPopup) loadingPopup.style.display = 'none';
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const projects = await response.json();
        console.log('Projects fetched from API:', projects); // Log the raw data

        // Aggiorna progresso dopo fetch elenco progetti (es. 20%)
        updateLoadingProgress(20);

        // Check for duplicates based on ID right here
        const projectIds = projects.map(p => p.id);
        const uniqueProjectIds = new Set(projectIds);
        if (projectIds.length !== uniqueProjectIds.size) {
            console.warn('Duplicate project IDs received from API!');
            // Log the duplicate IDs
            const duplicateCounts = {};
            projectIds.forEach(id => { duplicateCounts[id] = (duplicateCounts[id] || 0) + 1; });
            const duplicates = Object.entries(duplicateCounts).filter(([id, count]) => count > 1);
            console.warn('Duplicate IDs and counts:', duplicates);
        } else {
            console.log('No duplicate project IDs received from API.'); // Confirm no duplicates
        }

        // Aggiorna progresso prima della visualizzazione (es. 90%)
        updateLoadingProgress(90);

        // Fase 2: Visualizzazione (le cronologie sono ora incluse nei dati dei progetti)
        await displayProjects(projects); // Non serve più passare 'histories'

        // Riapplica i filtri dopo aver caricato i progetti
        if (filteringApi && typeof filteringApi.applyFilters === 'function') {
            filteringApi.applyFilters();
        }

        // Applica l'ultimo sorting dopo che i dati sono stati caricati e filtrati
        applyLastSorting();
    } catch (error) {
        handleNetworkError(error);
        // Assicura che il popup sia nascosto in caso di errore
        if (loadingPopup) {
            loadingPopup.style.display = 'none';
        }
    }
    // Il finally block non è più necessario qui, il popup viene nascosto da displayProjects o dal catch
} // <-- Aggiunta parentesi graffa mancante per chiudere fetchProjects

// Rimossa funzione fetchAllHistories - non più necessaria
// Rimossa funzione getProjectStatus - non più necessaria

/**
 * Crea la progress bar per visualizzare lo stato delle fasi del progetto.
 * @param {Array} projectHistory - Array di oggetti che rappresentano la cronologia del progetto.
 * @param {Array} phases - Array di oggetti che rappresentano le fasi del progetto.
 * @param {number} projectId - L'ID del progetto a cui appartiene la progress bar.
 * @returns {HTMLElement} - Elemento DOM che rappresenta la progress bar.
 */
function createPhaseProgressBar(projectHistory, phases, projectId) {
    // Ordina le fasi per order_num
    const sortedPhases = [...phases].sort((a, b) => a.order_num - b.order_num);

    // Crea un container per la progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'phase-progress-bar';

    // Per ogni fase, determina il colore in base alla logica richiesta
    sortedPhases.forEach((phase, index) => {
        const phaseItem = document.createElement('div');
        phaseItem.className = 'phase-progress-item';

        // Filtra i record della cronologia per questa fase (convertendo l'ID fase in stringa per il confronto)
        const phaseRecords = projectHistory.filter(record => String(record.phase) === String(phase.id));

        // Verifica se ci sono record "in progress" per questa fase
        const hasInProgress = phaseRecords.some(record => record.status === 'In Progress');

        // Verifica se ci sono record "completed" per questa fase
        const hasCompleted = phaseRecords.some(record => record.status === 'Completed');

        // Verifica se ci sono fasi successive con record "in progress" o "completed"
        const hasLaterPhaseActive = sortedPhases.slice(index + 1).some(laterPhase => {
            const laterPhaseRecords = projectHistory.filter(record => String(record.phase) === String(laterPhase.id));
            return laterPhaseRecords.some(record =>
                record.status === 'In Progress' || record.status === 'Completed'
            );
        });

        // Trova l'ultimo record per questa fase (ordinato per data)
        let latestRecord = null;
        if (phaseRecords.length > 0) {
            latestRecord = phaseRecords.sort((a, b) =>
                new Date(b.date) - new Date(a.date)
            )[0];
        }

        // Prepara il testo del tooltip
        let tooltipText = `${phase.name}: `;

        // Debug esteso - ispeziona i dati effettivi per capire il problema
        console.log(`Fase ${phase.name} (ID: ${phase.id}):`, {
            hasInProgress,
            hasCompleted,
            hasLaterPhaseActive,
            recordsCount: phaseRecords.length
        });

        // Verifica la corrispondenza degli ID
        const phaseId = phase.id;
        console.log('Record filtrati per questa fase:', phaseRecords);
        console.log('Tutti i record nella history:', projectHistory.map(h => ({
            phase: h.phase,
            status: h.status,
            phaseIdMatch: h.phase === phaseId, // Verifica corrispondenza
            phaseIdTypeA: typeof h.phase,
            phaseIdTypeB: typeof phaseId
        })));

        // Applica la logica dei colori secondo le specifiche:
        // - Giallo: se c'è almeno un task "in progress" per quella fase
        // - Verde: se non ci sono record con stato "in progress" per quella fase e c'è almeno un record con status "completed"
        // - Rosso: se NON ci sono task "completed" ED esiste una fase successiva con tasks "in progress" o "completed"

        if (hasInProgress) {
            // GIALLO: se c'è almeno un task "in progress" per quella fase
            phaseItem.classList.add('phase-progress-yellow');
            tooltipText += 'In Progress';
        } else if (hasCompleted) {
            // VERDE: se non ci sono record con stato "in progress" per quella fase e c'è almeno un record con status "completed"
            phaseItem.classList.add('phase-progress-green');
            tooltipText += 'Completed';
        } else if (hasLaterPhaseActive) {
            // ROSSO: se NON ci sono task "completed" ED esiste una fase successiva con tasks "in progress" o "completed"
            phaseItem.classList.add('phase-progress-red');
            tooltipText += 'Not Started (subsequent phases active)';
        } else {
            // Grigio: nessuna attività in questa fase e nelle fasi successive
            phaseItem.classList.add('phase-progress-none');
            tooltipText += 'Not Started';
        }

        // Verifica se ci sono voci nuove/aggiornate (is_new = true) per questa fase
        const hasNewEntries = phaseRecords.some(record => record.is_new === true || record.is_new === 1);
        
        // Se ci sono voci nuove, aggiungi la classe per l'animazione di pulsazione
        if (hasNewEntries) {
            phaseItem.classList.add('new-project-item');
            console.log(`[Evidenziazione] Fase ${phase.name} (ID: ${phase.id}) del progetto ${projectId}: Trovata voce aggiornata, applica evidenziazione al quadratino.`);
            tooltipText += '\n(UPDATED)';
        }

        // Aggiungi dettagli dell'ultimo record al tooltip se disponibile
        if (latestRecord) {
            tooltipText += `\nLast update: ${latestRecord.date}`;
            tooltipText += `\nDescription: ${latestRecord.description || 'No description'}`;
            tooltipText += `\nStatus: ${latestRecord.status}`;
            tooltipText += `\nAssigned to: ${latestRecord.assigned_to || 'Not assigned'}`;
        }
        phaseItem.title = tooltipText;

        // Aggiungi l'event listener per il click
        phaseItem.addEventListener('click', () => {
            // Se è una voce aggiornata (lampeggiante), aggiunge SOLO il parametro highlightPhase
            if (hasNewEntries) {
                window.location.href = `project-details.html?id=${projectId}&highlightPhase=${phase.id}`;
            } else {
                // Se NON è una voce aggiornata, aggiunge SOLO il parametro filterPhase
                window.location.href = `project-details.html?id=${projectId}&filterPhase=${phase.id}`;
            }
        });
        // Aggiungi uno stile per indicare che è cliccabile
        phaseItem.style.cursor = 'pointer';

        progressBar.appendChild(phaseItem);
    });

    return progressBar;
}

// Function to display projects in the table
// Modificata per usare la cronologia inclusa nell'oggetto project
async function displayProjects(projects) {
    // Aggiorna progresso a 100% prima di iniziare il rendering pesante
    updateLoadingProgress(100);

    console.log(`displayProjects called with ${projects.length} projects. Timestamp: ${Date.now()}`);
    
    // Aggiorna il conteggio dei progetti *visibili* (filtrati)
    const activeProjectCountSpan = document.getElementById('active-project-count');
    if (activeProjectCountSpan) activeProjectCountSpan.textContent = projects.length;

    const tableBody = document.getElementById('projects-table').getElementsByTagName('tbody')[0];
    const loadingPopup = document.getElementById('loading-popup'); // Riferimento al popup

    if (!tableBody) {
        console.error('Table body not found!');
        // Nascondi comunque il popup se la tabella non viene trovata
        if (loadingPopup) loadingPopup.style.display = 'none';
        return;
    }

    // Rimosso: non c'è più #loading-indicator nella tabella
    // const loadingIndicator = document.getElementById('loading-indicator');
    // if (loadingIndicator) {
    //     loadingIndicator.style.display = 'none';
    // }

    tableBody.innerHTML = ''; // Clear existing rows

    // Carica le fasi del progetto se non sono già disponibili
    if (!window.projectPhases) {
        try {
            const phasesResponse = await fetch('/api/phases');
            if (phasesResponse.ok) {
                window.projectPhases = await phasesResponse.json();
            } else {
                console.error('Errore nel caricamento delle fasi:', phasesResponse.status);
                window.projectPhases = [];
            }
        } catch (error) {
            console.error('Errore nel caricamento delle fasi:', error);
            window.projectPhases = [];
        }
    }

    // Funzione per creare una riga della tabella
    // Accetta il progetto che ora include la sua cronologia
    const createTableRow = (project) => {
        console.log(`Creating row for project ID: ${project.id}`);
        const row = tableBody.insertRow();
        row.style.height = 'auto'; // Ensure consistent row height
        const projectHistory = project.history || []; // Estrai la cronologia dall'oggetto progetto

        // Nota: la logica di evidenziazione è stata spostata nella funzione createPhaseProgressBar
        // e ora viene applicata solo ai singoli quadratini della progress bar invece che all'intera riga

        // Funzione helper per gestire i valori vuoti
        const getValueOrDash = (value) => value || '-';

        // Client
        const clientCell = row.insertCell(0);
        clientCell.textContent = getValueOrDash(project.client);
        clientCell.title = clientCell.textContent;

        // Product kind
        const productKindCell = row.insertCell(1);
        productKindCell.textContent = getValueOrDash(project.productKind);
        productKindCell.title = productKindCell.textContent;
        // Factory
        const factoryCell = row.insertCell(2);
        factoryCell.textContent = getValueOrDash(project.factory);
        factoryCell.title = factoryCell.textContent;

        // Brand
        const brandCell = row.insertCell(3);
        brandCell.textContent = getValueOrDash(project.brand);
        brandCell.title = brandCell.textContent;

        // Range
        const rangeCell = row.insertCell(4);
        rangeCell.textContent = getValueOrDash(project.range);
        rangeCell.title = rangeCell.textContent;

        // Line
        const lineCell = row.insertCell(5);
        lineCell.textContent = getValueOrDash(project.line);
        lineCell.title = lineCell.textContent;

        // Model number
        const modelNumberCell = row.insertCell(6);
        const modelNumberLink = document.createElement('a');
        modelNumberLink.href = `project-details.html?id=${project.id}`;
        modelNumberLink.textContent = project.modelNumber;
        modelNumberCell.appendChild(modelNumberLink);
        modelNumberCell.title = project.modelNumber;

        // Factory model number
        const factoryModelCell = row.insertCell(7);
        factoryModelCell.textContent = getValueOrDash(project.factoryModelNumber);
        factoryModelCell.title = factoryModelCell.textContent;
        // Start date
        const startDateCell = row.insertCell(8);
        startDateCell.textContent = getValueOrDash(project.startDate);
        startDateCell.title = startDateCell.textContent;

        // End date
        const endDateCell = row.insertCell(9);
        endDateCell.textContent = getValueOrDash(project.endDate);
        endDateCell.title = endDateCell.textContent;

        // Determina lo status del progetto dalle informazioni incluse nella risposta API
        let statusText = 'No History';
        let assignedToText = 'Not Assigned';

        if (project.latest_status) {
            // Se tutte le entry pubbliche sono completate, mostra "Completed"
            if (project.latest_status === 'Completed') {
                statusText = 'Completed';
            } else if (project.latest_status === 'On Hold') {
                statusText = 'On Hold';
            } else if (project.latest_description) {
                statusText = `${project.latest_description} (${project.latest_status})`;
            } else {
                statusText = project.latest_status;
            }

            // Aggiorna l'utente assegnato
            assignedToText = project.latest_assigned_to || 'Not Assigned';
        }

        // Status - Aggiungi la progress bar
        const statusCell = row.insertCell(10);

        // Usa la cronologia pre-caricata per creare la progress bar
        if (window.projectPhases && window.projectPhases.length > 0 && projectHistory && projectHistory.length > 0) {
            // Rimuovi eventuale contenuto precedente (anche se la riga è nuova, per sicurezza)
            statusCell.innerHTML = '';

            // Crea e aggiungi la progress bar, passando anche l'ID del progetto
            const progressBar = createPhaseProgressBar(projectHistory, window.projectPhases, project.id);
            if (progressBar) { // createPhaseProgressBar potrebbe restituire null
                 statusCell.appendChild(progressBar);
            } else {
                 // Fallback se la progress bar non può essere creata
                 statusCell.textContent = statusText;
            }
        } else {
            // Fallback al testo originale se non ci sono dati sufficienti
            statusCell.textContent = statusText;
        }

        // Mantieni il testo originale come title per il tooltip
        statusCell.title = statusText;

        // Assigned to
        const assignedToCell = row.insertCell(11);
        assignedToCell.textContent = assignedToText;
        assignedToCell.title = assignedToText;

        // Priority
        const priorityCell = row.insertCell(12);
        priorityCell.textContent = project.priority;
        priorityCell.title = priorityCell.textContent;

        const actionsCell = row.insertCell(13);

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editProject(row, project.id));

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => confirmDelete(project.id));

        // Archive/Unarchive button
        if (project.archived || project.latest_status === 'Completed') {
            const archiveBtn = document.createElement('button');
            archiveBtn.className = project.archived ? 'unarchive-btn' : 'archive-btn';
            archiveBtn.textContent = project.archived ? 'Unarchive' : 'Archive';
            archiveBtn.addEventListener('click', async () => {
                const success = await toggleArchiveProject(project.id, !project.archived);
                if (success) {
                    fetchProjects();
                }
            });
            actionsCell.appendChild(archiveBtn);
        }

        // Non è necessario evidenziare visivamente i progetti "On Hold" - il filtro viene gestito lato backend

        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
    };

    // Crea tutte le righe (la cronologia è già dentro 'project')
    projects.forEach(project => {
        createTableRow(project); // Passa l'intero oggetto progetto
    });

    console.log('Projects displayed successfully');
    // Memorizza gli ID dei progetti autorizzati per il controllo in project-details.html
    const allowedIds = projects.map(project => String(project.id));
    localStorage.setItem('allowedProjectIds', JSON.stringify(allowedIds));

    // Ripristina le larghezze delle colonne dopo aver caricato i dati
    restoreColumnWidths();

    // Nascondi il popup di caricamento DOPO che i dati sono stati visualizzati
    // Usiamo un piccolo timeout per permettere al browser di aggiornare la UI prima di nascondere
    setTimeout(() => {
        if (loadingPopup) {
            loadingPopup.style.display = 'none';
        }
    }, 50); // Breve ritardo
}

// Function to handle adding a new project
function addProject() {
    // Rendi visibili temporaneamente tutte le colonne nascoste
    const table = document.getElementById('projects-table');
    const savedVisibility = JSON.parse(localStorage.getItem('columnVisibility')) || {};
    const hiddenColumns = [];

    // Salva quali colonne erano nascoste
    Object.keys(savedVisibility).forEach(columnIndex => {
        if (savedVisibility[columnIndex] === false) {
            hiddenColumns.push(parseInt(columnIndex));
            showColumn(table, parseInt(columnIndex));
        }
    });

    const tableBody = table.getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0); // Insert at the beginning
    newRow.classList.add('new-entry-row'); // Aggiungi una classe per lo styling

    // Definisci i campi con le loro proprietà
    const fields = [
        { name: 'client', type: 'select', editable: true, columnIndex: 0 }, // Modificato tipo in 'select'
        { name: 'productKind', type: 'text', editable: true, columnIndex: 1 }, // Usa datalist
        { name: 'factory', type: 'select', editable: true, columnIndex: 2 }, // Modificato tipo in 'select'
        { name: 'brand', type: 'text', editable: true, columnIndex: 3 },
        { name: 'range', type: 'text', editable: true, columnIndex: 4 },
        { name: 'line', type: 'text', editable: true, columnIndex: 5 },
        { name: 'modelNumber', type: 'text', editable: true, columnIndex: 6 },
        { name: 'factoryModelNumber', type: 'text', editable: true, columnIndex: 7 },
        { name: 'startDate', type: 'date', editable: true, columnIndex: 8 },
        { name: 'endDate', type: 'date', editable: true, columnIndex: 9 },
        { name: 'status', type: 'text', editable: false, defaultValue: '-', columnIndex: 10 },
        { name: 'assignedTo', type: 'text', editable: false, defaultValue: '-', columnIndex: 11 },
        { name: 'priority', type: 'text', editable: true, columnIndex: 12 }
    ];

    // Non usiamo le preferenze di visibilità per il nuovo progetto
    // Tutte le colonne devono essere visibili durante l'inserimento

    // Crea le celle con gli input
    fields.forEach((field) => {
        const cell = newRow.insertCell(field.columnIndex);
        cell.classList.add('input-cell'); // Aggiungi una classe per lo styling

        // In fase di inserimento, tutte le colonne sono visibili
        // indipendentemente dalle impostazioni di visibilità

        if (!field.editable) {
            cell.textContent = field.defaultValue;
        } else {
             if (field.name === 'client') {
                 // Crea un dropdown per i client
                 const select = document.createElement('select');
                 select.name = field.name;
                 select.classList.add('new-entry-input');

                 const defaultOption = document.createElement('option');
                 defaultOption.value = '';
                 defaultOption.textContent = 'Select Client'; // Testo in inglese
                 select.appendChild(defaultOption);

                 if (window.clients && window.clients.length > 0) {
                     window.clients.forEach(clientName => {
                         const option = document.createElement('option');
                         option.value = clientName;
                         option.textContent = clientName;
                         select.appendChild(option);
                     });
                 } else {
                     console.warn('Nessun client disponibile per popolare il dropdown.'); // Log in italiano
                 }
                 
                 // Aggiungi l'opzione "add new client"
                 const addNewClientOption = document.createElement('option');
                 addNewClientOption.value = "__add_new_client__"; // Valore speciale per identificare questa opzione
                 addNewClientOption.textContent = "Add new client";
                 select.appendChild(addNewClientOption);
                 
                 // Aggiungi evento change per gestire la selezione di "add new client"
                 select.addEventListener('change', function(e) {
                     if (e.target.value === "__add_new_client__") {
                         // Chiedi all'utente di inserire il nome del nuovo cliente
                         const newClientName = prompt("Enter new client name:");
                         if (newClientName && newClientName.trim() !== '') {
                             // Aggiungi il nuovo cliente alla lista client globale se non esiste già
                             if (!window.clients.includes(newClientName)) {
                                 window.clients.push(newClientName);
                                 console.log(`Nuovo cliente "${newClientName}" aggiunto alla lista.`); // Log in italiano
                             }
                             
                             // Aggiungi il nuovo cliente come opzione della dropdown
                             const newOption = document.createElement('option');
                             newOption.value = newClientName;
                             newOption.textContent = newClientName;
                             
                             // Inserisci prima dell'opzione "add new client"
                             select.insertBefore(newOption, addNewClientOption);
                             
                             // Seleziona il nuovo cliente
                             select.value = newClientName;
                         } else {
                             // Se l'utente annulla, ripristina la selezione di default
                             select.value = '';
                         }
                     }
                 });
                 cell.appendChild(select);
            } else if (field.name === 'productKind') {
                // Crea un ID unico per il datalist
                const datalistId = 'product-kinds-list-' + Math.random().toString(36).substr(2, 9);

                // Crea il datalist per product kinds
                const datalist = document.createElement('datalist');
                datalist.id = datalistId;

                // Crea l'input collegato al datalist
                const input = document.createElement('input');
                input.type = 'text';
                input.name = field.name;
                input.classList.add('new-entry-input');
                input.setAttribute('list', datalistId);

                // Popola il datalist immediatamente se i product kinds sono già disponibili
                if (window.productKinds) {
                    window.productKinds.forEach(pk => {
                        const option = document.createElement('option');
                        option.value = pk.name;
                        datalist.appendChild(option);
                    });
                }

                // Aggiorna il datalist quando vengono caricati nuovi product kinds
                const updateDatalist = (event) => {
                    const productKinds = event.detail;
                    datalist.innerHTML = '';
                    productKinds.forEach(pk => {
                        const option = document.createElement('option');
                        option.value = pk.name;
                        datalist.appendChild(option);
                    });
                };

                window.addEventListener('productKindsLoaded', updateDatalist);

                // Rimuovi l'event listener quando l'elemento viene rimosso
                const cleanup = () => {
                    window.removeEventListener('productKindsLoaded', updateDatalist);
                };
                window.addEventListener('beforeunload', cleanup);

                cell.appendChild(datalist);
                cell.appendChild(input);
            } else if (field.name === 'factory') {
                // Crea un dropdown per le factory
                const select = document.createElement('select');
                select.name = field.name;
                select.classList.add('new-entry-input'); // Usa la stessa classe per stile

                // Aggiungi un'opzione vuota di default
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select Factory'; // Testo in inglese
                select.appendChild(defaultOption);

                // Popola il dropdown con le factory caricate
                if (window.factories && window.factories.length > 0) {
                    window.factories.forEach(factoryName => {
                        const option = document.createElement('option');
                        option.value = factoryName;
                        option.textContent = factoryName;
                        select.appendChild(option);
                    });
                } else {
                    console.warn('Nessuna factory disponibile per popolare il dropdown.'); // Log in italiano
                }
                cell.appendChild(select);
            } else {
                // Gestione standard per altri input di testo/data
                const input = document.createElement('input');
                input.type = field.type;
                input.name = field.name;
                input.classList.add('new-entry-input');
                cell.appendChild(input);
            }
        }
    });

    // Aggiungi anche una cella per le azioni alla fine (rispettando l'indice corretto)
    const actionsCell = newRow.insertCell(13);
    actionsCell.classList.add('actions-cell');
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.classList.add('save-btn');
    saveBtn.addEventListener('click', async function() {
        // Costruisci l'oggetto progetto estraendo i valori dalle celle
        const newProject = {};

        // Trova l'input della startDate
        const startDateInput = newRow.querySelector('input[name="startDate"]');

        // Se la startDate è vuota, impostala alla data odierna
        if (startDateInput && !startDateInput.value) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0'); // Mesi da 0 a 11
            const day = String(today.getDate()).padStart(2, '0');
            const todayString = `${year}-${month}-${day}`;
            startDateInput.value = todayString; // Aggiorna anche l'input visualizzato
            console.log(`StartDate non inserita, impostata automaticamente a: ${todayString}`); // Log in italiano
        }

        // Costruisci l'oggetto progetto estraendo i valori dalle celle (inclusa la startDate eventualmente aggiornata)
        fields.forEach(field => {
            if (field.editable) {
                const cell = newRow.cells[field.columnIndex];
                const inputElement = cell.querySelector('input, select'); // Seleziona input o select
                if (inputElement) {
                    newProject[field.name] = inputElement.value;
                }
            }
        });


        try {
            console.log('Invio nuovo progetto al backend:', newProject); // Log in italiano
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newProject),
            });

            if (response.ok) {
                console.log('Project added successfully');
                const savedWidths = localStorage.getItem('projectsColumnWidths');
                await fetchProjects(); // Refresh the project list and apply sorting

                // Riapplica le impostazioni di visibilità originali dopo il salvataggio
                hiddenColumns.forEach(columnIndex => {
                    hideColumn(table, columnIndex);
                });

                if (savedWidths) {
                    restoreColumnWidths(); // Ripristina le larghezze dopo l'aggiunta
                }
            } else {
                console.error('Failed to add project');
            }
        } catch (error) {
            handleNetworkError(error);
        }
    });
    actionsCell.appendChild(saveBtn);

    // Aggiungi il pulsante Cancel
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('cancel-btn'); // Aggiungi una classe per lo stile se necessario
    cancelBtn.addEventListener('click', function() {
        // Rimuovi la riga di inserimento
        newRow.remove();
        // Ripristina la visibilità delle colonne nascoste
        hiddenColumns.forEach(columnIndex => {
            hideColumn(table, columnIndex);
        });
        console.log('Inserimento progetto annullato.'); // Log in italiano
    });
    actionsCell.appendChild(cancelBtn); // Aggiungi il pulsante Cancel alla cella delle azioni
}

// Function to edit a project
function editProject(row, projectId) {
    const cells = row.getElementsByTagName('td');
    const projectData = {
        client: cells[0].textContent,
        productKind: cells[1].textContent,
        factory: cells[2].textContent,
        brand: cells[3].textContent,
        range: cells[4].textContent,
        line: cells[5].textContent,
        modelNumber: cells[6].textContent,
        factoryModelNumber: cells[7].textContent,
        startDate: cells[8].textContent,
        endDate: cells[9].textContent,
        status: cells[10].textContent,
        assignedTo: cells[11].textContent,
        priority: cells[12].textContent
    };

    // Convert cells to input fields
    for (let i = 0; i < 13; i++) {
        if (i === 10 || i === 11) { // Campi 'status' e 'assignedTo' - non modificabili
            continue; // Salta le celle dello status e assignedTo
        }
        cells[i].innerHTML = '';
        if (i === 0) { // Campo client (indice 0)
            const select = document.createElement('select');
            select.style.backgroundColor = '#ffff99';
            select.classList.add('new-entry-input');

            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select Client';
            select.appendChild(defaultOption);

            if (window.clients && window.clients.length > 0) {
                window.clients.forEach(clientName => {
                    const option = document.createElement('option');
                    option.value = clientName;
                    option.textContent = clientName;
                    if (clientName === projectData.client) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
            
            // Aggiungi l'opzione "add new client"
            const addNewClientOption = document.createElement('option');
            addNewClientOption.value = "__add_new_client__"; // Valore speciale per identificare questa opzione
            addNewClientOption.textContent = "Add new client";
            select.appendChild(addNewClientOption);
            
            // Aggiungi evento change per gestire la selezione di "add new client"
            select.addEventListener('change', function(e) {
                if (e.target.value === "__add_new_client__") {
                    // Chiedi all'utente di inserire il nome del nuovo cliente
                    const newClientName = prompt("Enter new client name:");
                    if (newClientName && newClientName.trim() !== '') {
                        // Aggiungi il nuovo cliente alla lista client globale se non esiste già
                        if (!window.clients.includes(newClientName)) {
                            window.clients.push(newClientName);
                            console.log(`Nuovo cliente "${newClientName}" aggiunto alla lista.`); // Log in italiano
                        }
                        
                        // Aggiungi il nuovo cliente come opzione della dropdown
                        const newOption = document.createElement('option');
                        newOption.value = newClientName;
                        newOption.textContent = newClientName;
                        
                        // Inserisci prima dell'opzione "add new client"
                        select.insertBefore(newOption, addNewClientOption);
                        
                        // Seleziona il nuovo cliente
                        select.value = newClientName;
                    } else {
                        // Se l'utente annulla o inserisce un valore vuoto, torna al cliente originale se disponibile
                        if (projectData.client) {
                            select.value = projectData.client;
                        } else {
                            // Altrimenti imposta il valore a vuoto
                            select.value = '';
                        }
                    }
                }
            });
            cells[i].appendChild(select);
        } else if (i === 1) { // Campo productKind
            // Crea un ID unico per il datalist
            const datalistId = 'product-kinds-list-edit-' + Math.random().toString(36).substr(2, 9);

            // Crea il datalist per product kinds
            const datalist = document.createElement('datalist');
            datalist.id = datalistId;

            // Crea l'input collegato al datalist
            const input = document.createElement('input');
            input.type = 'text';
            input.value = projectData[Object.keys(projectData)[i]];
            input.style.backgroundColor = '#ffff99';
            input.setAttribute('list', datalistId);

            // Popola il datalist immediatamente se i product kinds sono già disponibili
            if (window.productKinds) {
                window.productKinds.forEach(pk => {
                    const option = document.createElement('option');
                    option.value = pk.name;
                    datalist.appendChild(option);
                });
            }

            // Aggiorna il datalist quando vengono caricati nuovi product kinds
            const updateDatalist = (event) => {
                const productKinds = event.detail;
                datalist.innerHTML = '';
                productKinds.forEach(pk => {
                    const option = document.createElement('option');
                    option.value = pk.name;
                    datalist.appendChild(option);
                });
            };

            window.addEventListener('productKindsLoaded', updateDatalist);

            // Rimuovi l'event listener quando l'elemento viene rimosso
            const cleanup = () => {
                window.removeEventListener('productKindsLoaded', updateDatalist);
            };
            window.addEventListener('beforeunload', cleanup);

            cells[i].appendChild(datalist);
            cells[i].appendChild(input);
        } else if (i === 2) { // Campo factory (indice 2)
            const select = document.createElement('select');
            select.style.backgroundColor = '#ffff99';
            select.classList.add('new-entry-input'); // Usa la stessa classe per stile

            // Aggiungi un'opzione vuota
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select Factory';
            select.appendChild(defaultOption);

            // Popola con le factory disponibili
            if (window.factories && window.factories.length > 0) {
                window.factories.forEach(factoryName => {
                    const option = document.createElement('option');
                    option.value = factoryName;
                    option.textContent = factoryName;
                    // Seleziona il valore corrente del progetto
                    if (factoryName === projectData.factory) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
            cells[i].appendChild(select);
        } else {
            // Gestione standard per altri input
            const input = document.createElement('input');
            input.type = (i === 8 || i === 9) ? 'date' : 'text'; // Indici per startDate e endDate
            // Usa Object.keys per ottenere il nome del campo corrispondente all'indice i
            const fieldName = Object.keys(projectData)[i];
            input.value = projectData[fieldName] || ''; // Usa valore dal projectData o stringa vuota
            input.style.backgroundColor = '#ffff99';
            cells[i].appendChild(input);
        }
    }

    // Change edit button to save button
    const actionsCell = cells[13];
    actionsCell.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
        // Estrai i valori aggiornati dagli input/select nelle celle
        const updatedProject = {};
        const fieldNames = Object.keys(projectData); // Ottieni i nomi dei campi dall'oggetto originale

        for (let i = 0; i < 13; i++) { // Itera fino all'indice della priorità
            const fieldName = fieldNames[i];
            if (i === 10 || i === 11) { // Salta status e assignedTo (non modificabili)
                updatedProject[fieldName] = projectData[fieldName]; // Mantieni il valore originale
                continue;
            }
            const cell = cells[i];
            const inputElement = cell.querySelector('input, select'); // Trova l'input o il select
            if (inputElement) {
                updatedProject[fieldName] = inputElement.value;
            } else {
                // Fallback se non trova l'elemento (non dovrebbe succedere)
                updatedProject[fieldName] = projectData[fieldName];
            }
        }

        // Logica di salvataggio (ora usa il loop sopra)
        // Vecchio codice commentato correttamente:
        // const updatedProject_OLD = {
        //    client: cells[0].firstChild.value,
        //    productKind: cells[1].querySelector('input').value, // Gestisce il datalist
        //    factory: cells[2].querySelector('select').value, // Ottieni valore dal select
        //    brand: cells[3].firstChild.value,
        //    range: cells[4].firstChild.value,
        //    line: cells[5].firstChild.value,
        //    modelNumber: cells[6].firstChild.value,
        //    factoryModelNumber: cells[7].firstChild.value,
        //    startDate: cells[8].firstChild.value,
        //    endDate: cells[9].firstChild.value,
        //    status: cells[10].textContent, // Mantiene lo status corrente
        //    assignedTo: cells[11].textContent, // Mantiene l'utente assegnato corrente
        //    priority: cells[12].firstChild.value
        // };

        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedProject),
            });

            if (response.ok) {
                console.log('Project updated successfully');
                const savedWidths = localStorage.getItem('projectsColumnWidths');
                await fetchProjects(); // Refresh the project list and apply sorting
                if (savedWidths) {
                    restoreColumnWidths(); // Ripristina le larghezze dopo l'aggiornamento
                }
            } else {
                console.error('Failed to update project');
            }
        } catch (error) {
            handleNetworkError(error);
        }
    });
    actionsCell.appendChild(saveBtn);

    // Aggiungi il pulsante Cancel per la modifica
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('cancel-btn'); // Usa la stessa classe o una specifica se necessario
    cancelBtn.addEventListener('click', async function() {
        // Ricarica semplicemente i progetti per annullare le modifiche e ripristinare la riga
        console.log(`Modifica progetto ID ${projectId} annullata.`); // Log in italiano
        const savedWidths = localStorage.getItem('projectsColumnWidths');
        await fetchProjects(); // Ricarica la tabella per ripristinare lo stato originale
        if (savedWidths) {
            restoreColumnWidths(); // Ripristina le larghezze dopo il refresh
        }
    });
    actionsCell.appendChild(cancelBtn); // Aggiungi il pulsante Cancel
}

// Function to handle project deletion
async function confirmDelete(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE',
        });

        if (response.status === 409) {
            // Se il progetto ha voci di cronologia
            const data = await response.json();
            if (confirm(data.message)) {
                // Se l'utente conferma, riprova con force=true
                const forceResponse = await fetch(`/api/projects/${projectId}?force=true`, {
                    method: 'DELETE',
                });

                if (forceResponse.ok) {
                    console.log('Project and history successfully deleted');
                    await fetchProjects(); // Refresh the project list and apply sorting
                }
            }
        } else if (response.ok) {
            // Se il progetto è vuoto, viene eliminato direttamente
            console.log('Project deleted successfully');
            await fetchProjects(); // Refresh the project list and apply sorting
        } else {
            console.error('Failed to delete project');
        }
    } catch (error) {
        handleNetworkError(error);
    }
}

// Function to enable column resizing
// Funzione per salvare le larghezze delle colonne
function saveColumnWidths() {
    const table = document.getElementById('projects-table');
    const headerCells = table.getElementsByTagName('th');
    const widths = Array.from(headerCells).map(cell => cell.style.width);
    localStorage.setItem('projectsColumnWidths', JSON.stringify(widths));
}

// Funzione per ripristinare le larghezze delle colonne
function restoreColumnWidths() {
    const savedWidths = localStorage.getItem('projectsColumnWidths');
    if (savedWidths) {
        const widths = JSON.parse(savedWidths);
        const table = document.getElementById('projects-table');
        const headerCells = table.getElementsByTagName('th');

        widths.forEach((width, index) => {
            if (headerCells[index] && width) {
                headerCells[index].style.width = width;
                // Aggiorna anche le celle del corpo della tabella
                const tableRows = table.getElementsByTagName('tr');
                for (let row of tableRows) {
                    if (row.cells[index]) {
                        row.cells[index].style.width = width;
                    }
                }
            }
        });
    }
}

function enableColumnResizing() {
    const table = document.getElementById('projects-table');
    const headerCells = table.getElementsByTagName('th');
    const tableWrapper = table.closest('.table-wrapper');
    const maxTableWidth = tableWrapper.offsetWidth;

    // Ripristina le larghezze salvate
    restoreColumnWidths();

    for (let i = 0; i < headerCells.length; i++) {
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        headerCells[i].style.position = 'relative';
        headerCells[i].appendChild(resizer);

        let startX, startWidth, totalWidth;

        resizer.addEventListener('mousedown', function(e) {
            startX = e.pageX;
            startWidth = headerCells[i].offsetWidth;
            totalWidth = Array.from(headerCells).reduce((sum, cell) => sum + cell.offsetWidth, 0);

            document.addEventListener('mousemove', resizeColumn);
            document.addEventListener('mouseup', stopResize);
            resizer.classList.add('resizing');
        });

        function resizeColumn(e) {
            const widthChange = e.pageX - startX;
            const newWidth = Math.max(50, startWidth + widthChange); // Minimo 50px
            const newTotalWidth = totalWidth + (newWidth - startWidth);

            // Verifica che la nuova larghezza totale non superi la larghezza del wrapper
            if (newTotalWidth <= maxTableWidth) {
                headerCells[i].style.width = newWidth + 'px';

                // Aggiorna anche le celle del corpo della tabella
                const tableRows = table.getElementsByTagName('tr');
                for (let row of tableRows) {
                    if (row.cells[i]) {
                        row.cells[i].style.width = newWidth + 'px';
                    }
                }

                // Salva le nuove larghezze
                saveColumnWidths();
            }
        }

        function stopResize() {
            document.removeEventListener('mousemove', resizeColumn);
            document.removeEventListener('mouseup', stopResize);
            resizer.classList.remove('resizing');
        }
    }
}

// Function to enable column sorting
function enableColumnSorting() {
    const table = document.getElementById('projects-table');
    const headers = table.getElementsByTagName('th');
    let sortDirection = Array(headers.length).fill(true); // true for ascending, false for descending

    // Carica l'ultimo stato di sorting dal localStorage
    const lastSorting = JSON.parse(localStorage.getItem('lastSorting'));
    if (lastSorting) {
        sortDirection[lastSorting.columnIndex] = lastSorting.direction;
    }

    for (let i = 0; i < headers.length - 1; i++) { // Exclude the last column (Actions)
        headers[i].addEventListener('click', function() {
            const columnIndex = i;
            const rows = Array.from(table.getElementsByTagName('tbody')[0].rows);
            const isAscending = sortDirection[columnIndex];

            // Salva l'ultimo sorting nel localStorage
            localStorage.setItem('lastSorting', JSON.stringify({
                columnIndex: columnIndex,
                direction: !isAscending // Salva la prossima direzione
            }));

            // Rimuovi le classi di sorting da tutte le righe
            rows.forEach(row => {
                row.classList.remove('sorted-asc-1', 'sorted-asc-2', 'sorted-desc-1', 'sorted-desc-2');
            });

            // Rimuovi la classe sorted da tutti gli header
            Array.from(headers).forEach(header => header.classList.remove('sorted'));
            // Aggiungi la classe sorted all'header corrente
            headers[columnIndex].classList.add('sorted');

            rows.sort((a, b) => {
                const aText = a.cells[columnIndex].textContent.trim();
                const bText = b.cells[columnIndex].textContent.trim();

                // Gestione speciale per la colonna priority (indice 12)
                if (columnIndex === 12) {
                    // Converti in numeri se possibile
                    const aNum = parseFloat(aText);
                    const bNum = parseFloat(bText);

                    // Se entrambi sono numeri, confronta numericamente
                    if (!isNaN(aNum) && !isNaN(bNum)) {
                        return isAscending ? aNum - bNum : bNum - aNum;
                    }

                    // Se solo uno è numero, il numero va prima
                    if (!isNaN(aNum)) return isAscending ? -1 : 1;
                    if (!isNaN(bNum)) return isAscending ? 1 : -1;

                    // Se nessuno è numero, confronta come testo
                    return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
                }

                // Per tutte le altre colonne, mantieni il comportamento originale
                return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
            });

            // Raggruppa le righe con lo stesso valore
            let currentValue = '';
            let colorGroup = 1;

            rows.forEach(row => {
                const cellValue = row.cells[columnIndex].textContent.trim();
                if (cellValue !== currentValue) {
                    currentValue = cellValue;
                    colorGroup = colorGroup === 1 ? 2 : 1;
                }
                row.classList.add(isAscending ? `sorted-asc-${colorGroup}` : `sorted-desc-${colorGroup}`);
            });

            sortDirection[columnIndex] = !isAscending; // Toggle sort direction
            rows.forEach(row => table.getElementsByTagName('tbody')[0].appendChild(row)); // Reorder rows

            // Ripristina le larghezze delle colonne dopo il sorting
            restoreColumnWidths();
        });
    }
}

// Function to enable live filtering
function enableLiveFiltering() {
    // Oggetto per esporre funzioni pubbliche
    const publicApi = {};

    // Gestione checkbox progetti archiviati e on hold
    const showArchivedCheckbox = document.getElementById('show-archived');
    showArchivedCheckbox.addEventListener('change', () => {
        fetchProjects();
    });

    // Gestione checkbox progetti on hold
    const showOnHoldCheckbox = document.getElementById('show-on-hold');
    showOnHoldCheckbox.addEventListener('change', () => {
        fetchProjects();
    });

    // Gestione filtri testo
    const textFilterInputs = document.querySelectorAll('.filters input[type="text"]');
    const dateFilterInputs = document.querySelectorAll('.filters input[type="date"]');
    const tableRows = document.getElementById('projects-table').getElementsByTagName('tbody')[0].rows;
    const filterIndices = [0, 1, 2, 3, 4, 5, 6, 7, 11, 12]; // Indici delle colonne da filtrare, aggiunto 11 per Assigned to

    // Funzione per salvare i filtri nel localStorage
    function saveFilters(textFilterValues, dateFilterValues) {
        const filters = {
            text: textFilterValues,
            dates: dateFilterValues
        };
        localStorage.setItem('projectFilters', JSON.stringify(filters));
    }

    // Funzione per applicare i filtri
    function applyFilters() {
        const textFilterValues = Array.from(textFilterInputs).map(input => input.value.toLowerCase().trim());
        const dateFilterValues = {
            startDate: document.getElementById('start-date-filter').value,
            endDate: document.getElementById('end-date-filter').value
        };

        // Aggiorna lo stile dei filtri attivi
        textFilterInputs.forEach(input => {
            input.classList.toggle('filter-active', input.value.trim() !== '');
        });

        const dateInputs = document.querySelectorAll('.filters input[type="date"]');
        dateInputs.forEach(input => {
            input.classList.toggle('filter-active', input.value !== '');
        });

        // Salva i filtri nel localStorage
        saveFilters(textFilterValues, dateFilterValues);

        Array.from(tableRows).forEach(row => {
            let isMatch = true;

            // Controllo filtri testo
            for (let i = 0; i < textFilterValues.length - 1; i++) { // -1 perché escludiamo l'ultimo che era per lo status
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

            // Controllo filtri date
            if (isMatch) {
                const startDateFilter = dateFilterValues.startDate;
                const endDateFilter = dateFilterValues.endDate;

                if (startDateFilter || endDateFilter) {
                    const rowStartDate = row.cells[8].textContent.trim();
                    const rowEndDate = row.cells[9].textContent.trim();

                    if (startDateFilter && rowStartDate) {
                        if (new Date(rowStartDate) < new Date(startDateFilter)) {
                            isMatch = false;
                        }
                    }

                    if (endDateFilter && rowEndDate) {
                        if (new Date(rowEndDate) > new Date(endDateFilter)) {
                            isMatch = false;
                        }
                    }
                }
            }


            row.style.display = isMatch ? '' : 'none';
        });

        // Ripristina le larghezze delle colonne dopo il filtering
        restoreColumnWidths();
    }

    // Funzione per verificare la compatibilità dei filtri con i permessi CRUD
    async function checkFilterPermissions(filters) {
        try {
            // Ottieni i permessi dell'utente
            const response = await fetch('/api/projects');
            const projects = await response.json();

            // Se non ci sono progetti, significa che l'utente non ha permessi
            if (!Array.isArray(projects)) {
                console.error('Nessun permesso di visualizzazione progetti');
                return {
                    client: '',
                    productKind: '',
                    factory: '',
                    brand: '',
                    range: '',
                    line: '',
                    modelNumber: '',
                    factoryModelNumber: '',
                    assignedTo: '',
                    priority: ''
                };
            }

            // Estrai i valori unici permessi
            const allowedValues = {
                client: new Set(projects.map(p => p.client)),
                productKind: new Set(projects.map(p => p.productKind)),
                factory: new Set(projects.map(p => p.factory)),
                brand: new Set(projects.map(p => p.brand)),
                range: new Set(projects.map(p => p.range)),
                line: new Set(projects.map(p => p.line)),
                modelNumber: new Set(projects.map(p => p.modelNumber)),
                factoryModelNumber: new Set(projects.map(p => p.factoryModelNumber)),
                priority: new Set(projects.map(p => p.priority))
            };

            // Verifica la compatibilità dei filtri
            const newFilters = {
                client: filters.text[0],
                productKind: filters.text[1],
                factory: filters.text[2],
                brand: filters.text[3],
                range: filters.text[4],
                line: filters.text[5],
                modelNumber: filters.text[6],
                factoryModelNumber: filters.text[7],
                assignedTo: filters.text[8],
                priority: filters.text[9]
            };

            // Resetta i filtri non compatibili
            Object.keys(newFilters).forEach(key => {
                if (newFilters[key] && !allowedValues[key]?.has(newFilters[key])) {
                    console.log(`Filtro ${key} non compatibile con i permessi, reset`);
                    newFilters[key] = '';
                }
            });

            return newFilters;
        } catch (error) {
            console.error('Errore nella verifica dei permessi:', error);
            return {
                client: '',
                productKind: '',
                factory: '',
                brand: '',
                range: '',
                line: '',
                modelNumber: '',
                factoryModelNumber: '',
                assignedTo: '',
                priority: ''
            };
        }
    }

    // Funzione per caricare e applicare i filtri salvati
    async function loadSavedFilters() {
        const savedFilters = localStorage.getItem('projectFilters');
        if (savedFilters) {
            const filters = JSON.parse(savedFilters);

            // Verifica la compatibilità dei filtri con i permessi
            const validatedFilters = await checkFilterPermissions(filters);

            // Applica i filtri di testo validati
            textFilterInputs.forEach((input, index) => {
                const filterValue = Object.values(validatedFilters)[index];
                input.value = filterValue || '';
            });

            // Applica i filtri delle date
            if (filters.dates) {
                document.getElementById('start-date-filter').value = filters.dates.startDate || '';
                document.getElementById('end-date-filter').value = filters.dates.endDate || '';
            }

            // Applica i filtri
            applyFilters();
        }
    }

    // Event listeners per i filtri
    textFilterInputs.forEach(input => {
        input.addEventListener('input', applyFilters);
    });

    // Event listeners per i filtri date
    dateFilterInputs.forEach(input => {
        input.addEventListener('change', applyFilters);
    });

    // Carica i filtri salvati
    loadSavedFilters();

    // Espone le funzioni necessarie
    publicApi.applyFilters = applyFilters;

    // Salva il riferimento globale
    filteringApi = publicApi;

    return publicApi;
}
