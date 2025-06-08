let teamMembers = [];
let currentUser = null;

// Funzione di utilità per gestire gli errori di rete
function handleNetworkError(error) {
    console.error('Network error:', error);
    // Se l'errore è di tipo network (offline) o 401 (non autorizzato)
    if (!navigator.onLine || (error.response && error.response.status === 401)) {
        window.location.href = 'login.html';
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

// Variabile globale per mantenere il riferimento alle funzioni di filtering
let filteringApi = null;

// Variabile globale per il toggle "Priority Only"
let priorityOnlyEnabled = false;

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Verifica lo stato della connessione
        if (!navigator.onLine) {
            window.location.href = 'login.html';
            return;
        }

        // Verifica l'autenticazione
        const isAuthenticated = await checkAuthStatus();
        if (!isAuthenticated) {
            window.location.href = 'login.html';
            return;
        }

        // Ottieni l'utente corrente
        currentUser = await getCurrentUser();
        if (!currentUser) {
            console.error('Impossibile ottenere l\'utente corrente');
            window.location.href = 'login.html';
            return;
        }
        
        // Enable column resizing
        enableColumnResizing();

        // Restore column widths on page load
        restoreColumnWidths();

        // Enable live filtering
        enableLiveFiltering();

        // Inizializza la gestione delle notifiche
        initializeNotifications();

        // Inizializza il toggle "Priority Only"
        initializePriorityToggle();

        // Carica i dati
        await fetchTeamMembers();
        await fetchTasks();
        await calculateGroupings();

        // Inizializza i click sui gruppi
        initializeGroupClicks();

        // Enable column sorting dopo che i dati sono stati caricati
        enableColumnSorting();

        // Controlla se dobbiamo simulare il click sulla campanella
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('openNotifications') === 'true') {
            // Rimuovi il parametro dall'URL senza ricaricare la pagina
            const newUrl = window.location.pathname;
            window.history.pushState({}, '', newUrl);
            
            // Simula il click sulla campanella
            const bell = document.getElementById('notification-bell');
            if (bell) {
                bell.click();
            }
        }
    } catch (error) {
        console.error('Errore durante l\'inizializzazione:', error);
        window.location.href = 'login.html';
    }
});

// Funzione per ottenere l'utente corrente
async function getCurrentUser() {
    try {
        const response = await fetch('/api/current-user');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const user = await response.json();
        if (!user || !user.name) {
            throw new Error('Dati utente non validi');
        }
        return user;
    } catch (error) {
        console.error('Errore nel recupero dell\'utente corrente:', error);
        return null;
    }
}

// Funzione per inizializzare le notifiche
function initializeNotifications() {
    const bell = document.getElementById('notification-bell');
    const notificationCount = bell.querySelector('.notification-count');

    // Click sulla campanella
    bell.addEventListener('click', () => {
        // Filtra automaticamente per mostrare solo i task dell'utente corrente
        const userFilter = document.getElementById('filter-input');
        userFilter.value = currentUser.name;
        filteringApi.applyFilters();

        // Aggiorna l'URL per indicare che siamo nella vista dei task dell'utente
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'my-tasks');
        window.history.pushState({}, '', url);
    });

    // Controlla se ci sono nuovi task all'avvio
    updateNotificationCount();
}

// Funzione per ottenere il conteggio dei task nuovi
async function fetchNewTasksCount() {
    try {
        const response = await fetch('/api/tasks/new-count');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.count;
    } catch (error) {
        console.error('Error fetching new tasks count:', error);
        return 0;
    }
}

// Funzione per aggiornare il contatore delle notifiche
async function updateNotificationCount() {
    const bell = document.getElementById('notification-bell');
    if (!bell) return;

    const notificationCount = bell.querySelector('.notification-count');
    if (!notificationCount) return;

    const count = await fetchNewTasksCount();
    if (count > 0) {
        notificationCount.textContent = count;
        notificationCount.style.display = 'block';
        bell.classList.add('has-notifications');
    } else {
        notificationCount.style.display = 'none';
        bell.classList.remove('has-notifications');
    }
}

async function fetchTeamMembers() {
    try {
        const response = await fetch('/api/team-members');
        teamMembers = await handleResponse(response);
    } catch (error) {
        handleNetworkError(error);
    }
}

// Funzione helper per applicare l'ultimo sorting
function applyLastSorting() {
    const table = document.getElementById('task-table');
    const lastSorting = JSON.parse(localStorage.getItem('taskLastSorting'));
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
        // Se non c'è un sorting salvato, usa la data come default
        const dateHeader = table.getElementsByTagName('th')[2]; // 2 è l'indice della colonna Date
        if (dateHeader) {
            dateHeader.click();
        }
    }
}

async function fetchTasks() {
    console.log(`fetchTasks called. Timestamp: ${Date.now()}`); // Add timestamp log
    const loadingPopup = document.getElementById('loading-popup');

    // Mostra il popup e imposta progresso a 0%
    if (loadingPopup) {
        loadingPopup.style.display = 'flex'; // Usa flex per centrare il contenuto
        updateLoadingProgress(0); // Inizia da 0%
    }

    try {
        console.log('Fetching tasks from API...');
        const statusCheckboxes = document.querySelectorAll('#status-filter input[type="checkbox"]');
        const includeCompleted = Array.from(statusCheckboxes).some(cb => cb.value === 'Completed' && cb.checked);
        const apiUrl = `/api/tasks${includeCompleted ? '?includeCompleted=true' : ''}`;

        const response = await fetch(apiUrl);
        console.log(`Response status from ${apiUrl}:`, response.status);
        const tasks = await handleResponse(response);
        console.log('Fetched tasks:', tasks);

        // Aggiorna progresso dopo fetch (es. 50%)
        updateLoadingProgress(50);

        await displayTasks(tasks);

        // Riapplica i filtri dopo aver caricato i task
        if (filteringApi && typeof filteringApi.applyFilters === 'function') {
            filteringApi.applyFilters();
        }
    } catch (error) {
        handleNetworkError(error);
        // Assicura che il popup sia nascosto in caso di errore
        if (loadingPopup) {
            loadingPopup.style.display = 'none';
        }
    }
    // Il popup viene nascosto da displayTasks o dal catch
}

async function displayTasks(tasks) {
    // NON aggiornare a 100% qui, ma alla fine

    console.log(`displayTasks called with ${tasks.length} tasks. Timestamp: ${Date.now()}`);
    const tableBody = document.getElementById('task-table').getElementsByTagName('tbody')[0];
    const loadingPopup = document.getElementById('loading-popup'); // Riferimento al popup

    if (!currentUser) {
        console.error('Utente non disponibile per la visualizzazione dei task');
        // Nascondi comunque il popup se l'utente non è disponibile
        if (loadingPopup) loadingPopup.style.display = 'none';
        return;
    }

    if (!tableBody) {
        console.error('Table body not found!');
        // Nascondi comunque il popup se la tabella non viene trovata
        if (loadingPopup) loadingPopup.style.display = 'none';
        return;
    }

    tableBody.innerHTML = ''; // Clear existing rows

    // Usiamo Promise.all per attendere che tutte le righe siano create
    await Promise.all(tasks.map(async task => {
        // Il filtraggio dei task completati ora viene gestito dal backend,
        // quindi questa verifica non è più necessaria e viene rimossa per permettere
        // la visualizzazione quando il filtro "Completed" è attivo.

        const row = tableBody.insertRow();
        row.setAttribute('data-task-id', task.id);
        // Aggiungi createdBy come attributo per identificare i task auto-assegnati
        if (task.createdBy) {
            row.setAttribute('data-created-by', task.createdBy);
        }
        row.insertCell(0).textContent = task.factory;
        row.insertCell(1).innerHTML = `<a href="project-details.html?id=${task.projectId}">${task.modelNumber}</a>`;
        row.insertCell(2).textContent = task.date;
        row.insertCell(3).textContent = task.description;
        row.insertCell(4).textContent = task.assignedTo;
        row.insertCell(5).textContent = task.status;
        row.insertCell(6).textContent = task.priority || '-';

        // Applica il colore di sfondo e del font in base all'utente assegnato
        const assignedMember = teamMembers.find(member => member.name === task.assignedTo);
        if (assignedMember) {
            row.style.backgroundColor = assignedMember.color;
            row.style.color = assignedMember.fontColor || '#000000';
        }

        // Evidenzia i nuovi task assegnati all'utente corrente 
        // Estensione: evidenzia l'intera riga invece che solo la cella "assigned to"
        if (task.is_new && task.assignedTo === currentUser.name) {
            row.classList.add('new-task-cell');
        }
    }));

    // Riapplica i filtri dopo aver caricato i task
    if (filteringApi && typeof filteringApi.applyFilters === 'function') {
        filteringApi.applyFilters();
    }

    console.log('Tasks displayed successfully');

    // Nascondi il popup di caricamento DOPO che i dati sono stati visualizzati
    // Aggiorna a 100% PRIMA di nascondere il popup
    updateLoadingProgress(100);
    // Usiamo un piccolo timeout per permettere al browser di aggiornare la UI prima di nascondere
    setTimeout(() => {
        if (loadingPopup) {
            loadingPopup.style.display = 'none';
        }
    }, 50); // Breve ritardo
}

// Function to enable live filtering
function enableLiveFiltering() {
    // Oggetto per esporre funzioni pubbliche
    const publicApi = {};
    
    // Gestione dropdown status
    const statusDropdownBtn = document.getElementById('status-dropdown-btn');
    const statusDropdown = document.getElementById('status-filter');
    const statusCheckboxes = statusDropdown.querySelectorAll('input[type="checkbox"]');
    
    // Apertura/chiusura dropdown
    statusDropdownBtn.addEventListener('click', function() {
        statusDropdown.classList.toggle('show');
    });

    // Chiudi dropdown quando si clicca fuori
    document.addEventListener('click', function(event) {
        if (!event.target.matches('#status-dropdown-btn') && !event.target.closest('.dropdown-content')) {
            statusDropdown.classList.remove('show');
        }
    });

    // Gestione filtri testo
    const textFilterInputs = document.querySelectorAll('.filters input[type="text"]');
    const tableRows = document.getElementById('task-table').getElementsByTagName('tbody')[0].rows;
    const filterIndices = [4, 0, 1, 6]; // Indici delle colonne da filtrare: [Assigned To, Factory, Model Number, Priority]

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
        localStorage.setItem('taskFilters', JSON.stringify(filters));
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

        const statusBtn = document.getElementById('status-dropdown-btn');
        statusBtn.classList.toggle('filter-active', selectedStatuses.length > 0);

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
                const statusCell = row.cells[5];
                const statusText = statusCell.textContent.trim();
                if (!selectedStatuses.includes(statusText)) {
                    isMatch = false;
                }
            }

            row.style.display = isMatch ? '' : 'none';
        });
    }

    // Funzione per verificare la compatibilità dei filtri con i permessi CRUD
    async function checkFilterPermissions(filters) {
        try {
            // Ottieni i permessi dell'utente
            const response = await fetch('/api/tasks');
            const tasks = await response.json();

            // Se non ci sono task, significa che l'utente non ha permessi
            if (!Array.isArray(tasks)) {
                console.error('Nessun permesso di visualizzazione task');
                return {
                    assignedTo: '',
                    factory: '',
                    modelNumber: '',
                    priority: ''
                };
            }

            // Estrai i valori unici permessi
            const allowedValues = {
                assignedTo: new Set(tasks.map(t => t.assignedTo)),
                factory: new Set(tasks.map(t => t.factory)),
                modelNumber: new Set(tasks.map(t => t.modelNumber)),
                priority: new Set(tasks.map(t => t.priority))
            };

            // Verifica la compatibilità dei filtri
            const newFilters = {
                assignedTo: filters.text[0],
                factory: filters.text[1],
                modelNumber: filters.text[2],
                priority: filters.text[3]
            };

            // Resetta i filtri non compatibili
            if (newFilters.assignedTo && !allowedValues.assignedTo.has(newFilters.assignedTo)) {
                console.log('Filtro utente non compatibile con i permessi, reset');
                newFilters.assignedTo = '';
            }
            if (newFilters.factory && !allowedValues.factory.has(newFilters.factory)) {
                console.log('Filtro factory non compatibile con i permessi, reset');
                newFilters.factory = '';
            }
            if (newFilters.modelNumber && !allowedValues.modelNumber.has(newFilters.modelNumber)) {
                console.log('Filtro model number non compatibile con i permessi, reset');
                newFilters.modelNumber = '';
            }

            return newFilters;
        } catch (error) {
            console.error('Errore nella verifica dei permessi:', error);
            return {
                assignedTo: '',
                factory: '',
                modelNumber: '',
                priority: ''
            };
        }
    }

    // Funzione per caricare e applicare i filtri salvati
    async function loadSavedFilters() {
        const savedFilters = localStorage.getItem('taskFilters');
        let filters;
        if (savedFilters) {
            filters = JSON.parse(savedFilters);
            if (!filters.text) {
                filters.text = ['', '', '', '']; // Initialize empty filters for all text inputs
            }
        } else {
            filters = {
                text: ['', '', '', ''],
                status: []
            };
        }
        
        // Verifica la compatibilità dei filtri con i permessi
        const validatedFilters = await checkFilterPermissions(filters);
        
        // Applica i filtri di testo validati
        textFilterInputs[0].value = validatedFilters.assignedTo || '';
        textFilterInputs[1].value = validatedFilters.factory || '';
        textFilterInputs[2].value = validatedFilters.modelNumber || '';
        textFilterInputs[3].value = validatedFilters.priority || '';
        
        // Applica i filtri di stato
        statusCheckboxes.forEach(checkbox => {
            checkbox.checked = filters.status.includes(checkbox.value);
        });
        
        // Applica i filtri
        applyFilters();
    }

    // Event listeners per i filtri
    textFilterInputs.forEach(input => {
        input.addEventListener('input', applyFilters);
    });

    statusCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // Quando un filtro di stato cambia, ricarichiamo i task dal backend
            fetchTasks(); 
            // applyFilters verrà chiamato da fetchTasks dopo aver ricevuto e visualizzato i nuovi dati
        });
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

function handleResponse(response) {
    if (response.status === 401) {
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
    }
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Function to enable column resizing
function enableColumnResizing() {
    const table = document.getElementById('task-table');
    const headerCells = table.getElementsByTagName('th');

    for (let i = 0; i < headerCells.length; i++) {
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        resizer.style.width = '5px';
        resizer.style.height = '100%';
        resizer.style.position = 'absolute';
        resizer.style.right = '0';
        resizer.style.top = '0';
        resizer.style.cursor = 'col-resize';
        resizer.style.userSelect = 'none';

        headerCells[i].style.position = 'relative';
        headerCells[i].appendChild(resizer);

        let startX, startWidth;

        resizer.addEventListener('mousedown', function(e) {
            startX = e.pageX;
            startWidth = headerCells[i].offsetWidth;
            document.addEventListener('mousemove', resizeColumn);
            document.addEventListener('mouseup', stopResize);
        });

        function resizeColumn(e) {
            const newWidth = startWidth + (e.pageX - startX);
            headerCells[i].style.width = newWidth + 'px';
            saveColumnWidths();
        }

        function stopResize() {
            document.removeEventListener('mousemove', resizeColumn);
            document.removeEventListener('mouseup', stopResize);
        }
    }
}

// Function to save column widths to local storage
function saveColumnWidths() {
    const table = document.getElementById('task-table');
    const headerCells = table.getElementsByTagName('th');
    const columnWidths = Array.from(headerCells).map(cell => cell.style.width);
    console.log('Saving column widths:', columnWidths);
    localStorage.setItem('taskColumnWidths', JSON.stringify(columnWidths));
}

// Function to restore column widths from local storage
function restoreColumnWidths() {
    const columnWidths = JSON.parse(localStorage.getItem('taskColumnWidths'));
    if (columnWidths) {
        const table = document.getElementById('task-table');
        const headerCells = table.getElementsByTagName('th');
        columnWidths.forEach((width, index) => {
            if (headerCells[index]) {
                headerCells[index].style.width = width;
            }
        });
        console.log('Restored column widths:', columnWidths);
    } else {
        console.log('No column widths found in local storage.');
    }
}

// Function to enable column sorting
function enableColumnSorting() {
    const table = document.getElementById('task-table');
    const headers = table.getElementsByTagName('th');
    let sortDirection = Array(headers.length).fill(true); // true for ascending, false for descending

    // Funzione per applicare il sorting
    function applySorting(columnIndex, direction) {
        const rows = Array.from(table.getElementsByTagName('tbody')[0].rows);
        const isAscending = direction;

        // Rimuovi la classe sorted da tutti gli header
        Array.from(headers).forEach(header => header.classList.remove('sorted'));
        // Aggiungi la classe sorted all'header corrente
        headers[columnIndex].classList.add('sorted');

        rows.sort((a, b) => {
            const aText = a.cells[columnIndex].textContent.trim();
            const bText = b.cells[columnIndex].textContent.trim();

            // Gestione speciale per la colonna priority (indice 6)
            if (columnIndex === 6) {
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
            row.setAttribute('data-sort-group', `${isAscending ? 'asc' : 'desc'}-${colorGroup}`);
        });

        rows.forEach(row => table.getElementsByTagName('tbody')[0].appendChild(row));
        sortDirection[columnIndex] = direction;
    }

    // Carica e applica l'ultimo sorting
    const lastSorting = JSON.parse(localStorage.getItem('taskLastSorting'));
    if (lastSorting) {
        applySorting(lastSorting.columnIndex, lastSorting.direction);
    } else {
        // Default sorting sulla data
        applySorting(2, true); // 2 è l'indice della colonna Date
    }

    // Aggiungi event listeners per il sorting
    for (let i = 0; i < headers.length; i++) {
        headers[i].addEventListener('click', function() {
            const newDirection = !sortDirection[i];
            applySorting(i, newDirection);
            
            // Salva il nuovo stato di sorting
            localStorage.setItem('taskLastSorting', JSON.stringify({
                columnIndex: i,
                direction: newDirection
            }));
        });
    }
}

// Funzione per inizializzare i click sui gruppi
function initializeGroupClicks() {
    const groupLabels = document.querySelectorAll('#groupings .group-label');
    
    groupLabels.forEach(label => {
        label.addEventListener('click', function() {
            const role = this.getAttribute('data-role');
            console.log(`Cliccato sul gruppo: ${role}`);
            
            // Filtra i task per mostrare solo quelli del ruolo selezionato
            filterTasksByRole(role);
            
            // Aggiorna l'aspetto visivo per indicare quale gruppo è selezionato
            groupLabels.forEach(l => l.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
}

// Funzione per mostrare i dettagli del gruppo in una tendina
function filterTasksByRole(role) {
    // Rimuovi eventuali tendine esistenti
    const existingDropdown = document.querySelector('.group-details-dropdown');
    if (existingDropdown) {
        existingDropdown.remove();
    }
    
    // Ottieni tutti i membri del team con il ruolo specificato
    // Gestisci il caso speciale di "Factories" che corrisponde a "Factory" nel database
    const roleToFilter = role === 'Factories' ? 'Factory' : role;
    const membersWithRole = teamMembers.filter(member => member.role === roleToFilter);
    
    // Se non ci sono membri con questo ruolo, non fare nulla
    if (membersWithRole.length === 0) {
        console.log(`Nessun membro trovato con ruolo ${role}`);
        return;
    }
    
    console.log(`Membri con ruolo ${role}:`, membersWithRole);
    
    // Calcola il numero di task per ciascun membro
    const memberTaskCounts = {};
    // Aggiungi contatori per i task auto-assegnati
    const selfAssignedMemberCounts = {};
    
    // Inizializza i conteggi a 0
    membersWithRole.forEach(member => {
        memberTaskCounts[member.name] = 0;
        selfAssignedMemberCounts[member.name] = 0;
    });
    
    // Verifica se currentUser è disponibile
    const currentUserName = currentUser ? currentUser.name : null;
    
    // Conta solo i task "In Progress" per ciascun membro (come fa calculateGroupings)
    const tableRows = document.getElementById('task-table').getElementsByTagName('tbody')[0].rows;
    Array.from(tableRows).forEach(row => {
        const assignedTo = row.cells[4].textContent.trim(); // Indice della colonna "Assigned To"
        const status = row.cells[5].textContent.trim(); // Indice della colonna "Status"
        const priority = row.cells[6].textContent.trim(); // Indice della colonna "Priority"
        
        // Verifica se il task soddisfa i criteri
        const hasPriority = priority && priority !== '-';
        const isPriorityMatch = !priorityOnlyEnabled || hasPriority;
        
        if (memberTaskCounts.hasOwnProperty(assignedTo) && status === 'In Progress' && isPriorityMatch) {
            memberTaskCounts[assignedTo]++;
            
            // Controlla se questo task è auto-assegnato dall'utente corrente
            // Un task è auto-assegnato quando è stato creato e assegnato dalla stessa persona
            if (currentUserName && 
                assignedTo === currentUserName && 
                row.hasAttribute('data-created-by') && 
                row.getAttribute('data-created-by').toString() === currentUser.id.toString()) {
                selfAssignedMemberCounts[assignedTo]++;
            }
        }
    });
    
    // Crea la tendina
    const dropdown = document.createElement('div');
    dropdown.className = 'group-details-dropdown';
    
    // Aggiungi il titolo
    const title = document.createElement('div');
    title.className = 'group-details-title';
    title.textContent = `Gruppo: ${role}`;
    dropdown.appendChild(title);
    
    // Aggiungi i dettagli di ciascun membro
    const membersList = document.createElement('ul');
    membersList.className = 'group-members-list';
    
    membersWithRole.forEach(member => {
        const memberItem = document.createElement('li');
        let countText = `${memberTaskCounts[member.name]}`;
        
        // Aggiungi il conteggio dei task auto-assegnati tra parentesi
        if (selfAssignedMemberCounts[member.name] > 0) {
            countText += ` (${selfAssignedMemberCounts[member.name]})`;
        }
        
        memberItem.innerHTML = `<span class="member-name">${member.name}</span> : <span class="task-count">${countText}</span>`;
        memberItem.classList.add('clickable-member');
        memberItem.setAttribute('data-member-name', member.name);
        membersList.appendChild(memberItem);
    });
    
    dropdown.appendChild(membersList);
    
    // Posiziona la tendina sotto l'etichetta del gruppo cliccata
    const clickedLabel = document.querySelector(`#groupings .group-label[data-role="${role}"]`);
    const labelRect = clickedLabel.getBoundingClientRect();
    
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${labelRect.bottom + window.scrollY}px`;
    dropdown.style.left = `${labelRect.left + window.scrollX}px`;
    
    // Aggiungi la tendina al documento
    document.body.appendChild(dropdown);
    
    // Aggiungi event listener per il clic sugli elementi della lista
    const memberItems = dropdown.querySelectorAll('.clickable-member');
    memberItems.forEach(item => {
        item.addEventListener('click', function() {
            const memberName = this.getAttribute('data-member-name');
            console.log(`Cliccato sull'utente: ${memberName}`);
            
            // Imposta il valore del campo di filtro "User" al nome dell'utente selezionato
            const userFilter = document.getElementById('filter-input');
            userFilter.value = memberName;
            
            // Applica i filtri per mostrare solo i task di quell'utente
            if (filteringApi && typeof filteringApi.applyFilters === 'function') {
                filteringApi.applyFilters();
            }
            
            // Chiudi la tendina e rimuovi la selezione dal gruppo
            dropdown.remove();
            
            // Rimuovi la classe selected da tutte le etichette dei gruppi
            document.querySelectorAll('#groupings .group-label').forEach(label => {
                label.classList.remove('selected');
            });
        });
    });
    
    // Aggiungi un event listener per chiudere la tendina quando si clicca altrove
    document.addEventListener('click', function closeDropdown(event) {
        if (!dropdown.contains(event.target) && !clickedLabel.contains(event.target)) {
            dropdown.remove();
            document.removeEventListener('click', closeDropdown);
            
            // Rimuovi la classe selected da tutte le etichette dei gruppi
            document.querySelectorAll('#groupings .group-label').forEach(label => {
                label.classList.remove('selected');
            });
        }
    });
}

// Funzione per inizializzare il toggle "Priority Only"
function initializePriorityToggle() {
    const priorityToggle = document.getElementById('priority-only-toggle');
    
    // Carica lo stato salvato del toggle
    const savedState = localStorage.getItem('priorityOnlyEnabled');
    if (savedState !== null) {
        priorityOnlyEnabled = savedState === 'true';
        priorityToggle.checked = priorityOnlyEnabled;
    }
    
    // Aggiungi event listener per il cambio di stato del toggle
    priorityToggle.addEventListener('change', function() {
        priorityOnlyEnabled = this.checked;
        
        // Salva lo stato nel localStorage
        localStorage.setItem('priorityOnlyEnabled', priorityOnlyEnabled);
        
        // Ricalcola i gruppi con il nuovo filtro
        calculateGroupings();
    });
}

async function calculateGroupings() {
    try {
        const tasksResponse = await fetch('/api/tasks');
        const tasks = await handleResponse(tasksResponse);

        const teamMembersResponse = await fetch('/api/team-members');
        const teamMembers = await handleResponse(teamMembersResponse);

        console.log('Team members:', teamMembers);
        
        // Log dei ruoli disponibili
        const roles = [...new Set(teamMembers.map(member => member.role))];
        console.log('Ruoli disponibili:', roles);

        const groupings = {
            'R&D China': 0,
            'Client': 0,
            'Factories': 0,
            'Factory': 0  // Aggiungiamo anche la versione singolare
        };
        // Aggiungi contatori per i task auto-assegnati
        const selfAssignedGroupings = {
            'R&D China': 0,
            'Client': 0,
            'Factories': 0,
            'Factory': 0
        };
        console.log('Gruppi inizializzati:', groupings);
        console.log('Gruppi auto-assegnati inizializzati:', selfAssignedGroupings);

        // Verifica se currentUser è disponibile prima di procedere
        if (!currentUser || !currentUser.name) {
            console.error('Utente corrente non disponibile per il calcolo dei task auto-assegnati.');
            return; // Esci se l'utente non è definito
        }
        const currentUserName = currentUser.name;
        console.log(`Calcolo raggruppamenti per utente: ${currentUserName}`);

        // Filtra i task "In Progress"
        let inProgressTasks = tasks.filter(task => task.status === 'In Progress');
        
        // Se il toggle "Priority Only" è attivo, filtra ulteriormente per mostrare solo i task con priorità
        if (priorityOnlyEnabled) {
            inProgressTasks = inProgressTasks.filter(task => task.priority && task.priority !== '-');
            console.log('Task in progress con priorità:', inProgressTasks);
        } else {
            console.log('Task in progress (tutti):', inProgressTasks);
        }

        inProgressTasks.forEach(task => {
            console.log(`Elaborazione task: ${task.id}, assignedTo: ${task.assignedTo}, priority: ${task.priority || 'nessuna'}`);
            
            // Prova prima con name
            let user = teamMembers.find(member => member.name === task.assignedTo);
            if (!user) {
                // Se non trova con name, prova con username
                user = teamMembers.find(member => member.username === task.assignedTo);
            }
            
            if (user) {
                console.log(`Utente trovato: ${user.name}, ruolo: ${user.role}`);
                
                switch (user.role) {
                    case 'R&D China':
                        groupings['R&D China']++;
                        // Controlla se è auto-assegnato (creato e assegnato dalla stessa persona)
                        if (task.assignedTo === currentUserName && 
                            task.createdBy && 
                            task.createdBy.toString() === currentUser.id.toString()) {
                            selfAssignedGroupings['R&D China']++;
                        }
                        break;
                    case 'Client': // Il DB è stato uniformato, ma gestiamo entrambi per sicurezza
                    case 'client':
                        groupings['Client']++;
                        if (task.assignedTo === currentUserName && 
                            task.createdBy && 
                            task.createdBy.toString() === currentUser.id.toString()) {
                            selfAssignedGroupings['Client']++;
                        }
                        break;
                    case 'Factories':
                        groupings['Factories']++;
                        if (task.assignedTo === currentUserName && 
                            task.createdBy && 
                            task.createdBy.toString() === currentUser.id.toString()) {
                            selfAssignedGroupings['Factories']++;
                        }
                        break;
                    case 'Factory':
                        groupings['Factory']++;
                        if (task.assignedTo === currentUserName && 
                            task.createdBy && 
                            task.createdBy.toString() === currentUser.id.toString()) {
                            selfAssignedGroupings['Factory']++;
                        }
                        break;
                    default:
                        console.log(`Ruolo non riconosciuto: ${user.role}`);
                }
            } else {
                console.log(`Nessun utente trovato per task.assignedTo: ${task.assignedTo}`);
            }
        });
        
        console.log('Conteggi totali (prima della combinazione):', groupings);
        console.log('Conteggi auto-assegnati (prima della combinazione):', selfAssignedGroupings);

        // Combina i conteggi di Factory e Factories per totali e auto-assegnati
        if (groupings['Factory'] > 0 || selfAssignedGroupings['Factory'] > 0) {
            groupings['Factories'] += groupings['Factory'];
            selfAssignedGroupings['Factories'] += selfAssignedGroupings['Factory'];
        }
        // Rimuovi i conteggi singolari non più necessari
        delete groupings['Factory'];
        delete selfAssignedGroupings['Factory'];

        console.log('Conteggi totali finali (combinati):', groupings);
        console.log('Conteggi auto-assegnati finali (combinati):', selfAssignedGroupings);

        // Aggiorna i conteggi nell'UI, aggiungendo i task auto-assegnati tra parentesi
        const rdChinaElement = document.getElementById('grouping-rd-china');
        const clientElement = document.getElementById('grouping-client');
        const factoriesElement = document.getElementById('grouping-factories');

        rdChinaElement.textContent = groupings['R&D China'];
        if (selfAssignedGroupings['R&D China'] > 0) {
            rdChinaElement.textContent += ` (${selfAssignedGroupings['R&D China']})`;
        }

        clientElement.textContent = groupings['Client'];
        if (selfAssignedGroupings['Client'] > 0) {
            clientElement.textContent += ` (${selfAssignedGroupings['Client']})`;
        }

        factoriesElement.textContent = groupings['Factories'];
        if (selfAssignedGroupings['Factories'] > 0) {
            factoriesElement.textContent += ` (${selfAssignedGroupings['Factories']})`;
        }
        
        // Trova il gruppo con il maggior numero di task (collo di bottiglia)
        let maxCount = Math.max(groupings['R&D China'], groupings['Client'], groupings['Factories']);
        
        // Rimuovi prima tutte le classi bottleneck
        document.querySelectorAll('#groupings span').forEach(span => {
            span.classList.remove('bottleneck');
        });
        
        // Applica la classe bottleneck solo ai gruppi con il conteggio massimo
        if (groupings['Client'] === maxCount && maxCount > 0) {
            document.querySelector('.group-label[data-role="Client"]').classList.add('bottleneck');
        }
        if (groupings['R&D China'] === maxCount && maxCount > 0) {
            document.querySelector('.group-label[data-role="R&D China"]').classList.add('bottleneck');
        }
        if (groupings['Factories'] === maxCount && maxCount > 0) {
            document.querySelector('.group-label[data-role="Factories"]').classList.add('bottleneck');
        }

    } catch (error) {
        console.error('Errore nel calcolo dei raggruppamenti:', error);
    }
}
