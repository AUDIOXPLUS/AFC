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

// Variabile globale per mantenere il riferimento alle funzioni di filtering
let filteringApi = null;

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

        // Carica i dati
        await fetchTeamMembers();
        await fetchTasks();

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
    try {
        console.log('Fetching tasks from API...');
        const response = await fetch('/api/tasks');
        console.log('Response status:', response.status);
        const tasks = await handleResponse(response);
        console.log('Fetched tasks:', tasks);
        await displayTasks(tasks);

        // Riapplica i filtri dopo aver caricato i task
        if (filteringApi && typeof filteringApi.applyFilters === 'function') {
            filteringApi.applyFilters();
        }
    } catch (error) {
        handleNetworkError(error);
    }
}

async function displayTasks(tasks) {
    if (!currentUser) {
        console.error('Utente non disponibile per la visualizzazione dei task');
        return;
    }

    const tableBody = document.getElementById('task-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear existing rows

    // Usiamo Promise.all per attendere che tutte le righe siano create
    await Promise.all(tasks.map(async task => {
        // Non mostrare i task con assigned_to "completed"
        if (task.assignedTo === 'Completed') {
            return;
        }

        const row = tableBody.insertRow();
        row.setAttribute('data-task-id', task.id);
        row.insertCell(0).textContent = task.factory;
        row.insertCell(1).innerHTML = `<a href="project-details.html?id=${task.projectId}">${task.modelNumber}</a>`;
        row.insertCell(2).textContent = task.date;
        row.insertCell(3).textContent = task.description;
        row.insertCell(4).textContent = task.assignedTo;
        row.insertCell(5).textContent = task.priority || '-';
        row.insertCell(6).textContent = task.status;

        // Applica il colore di sfondo e del font in base all'utente assegnato
        const assignedMember = teamMembers.find(member => member.name === task.assignedTo);
        if (assignedMember) {
            row.style.backgroundColor = assignedMember.color;
            row.style.color = assignedMember.fontColor || '#000000';
        }

        // Evidenzia i nuovi task assegnati all'utente corrente
        if (task.is_new && task.assignedTo === currentUser.name) {
            const assignedToCell = row.cells[4]; // Indice della colonna "Assigned To"
            assignedToCell.classList.add('new-task-cell');
        }
    }));

    // Riapplica i filtri dopo aver caricato i task
    if (filteringApi && typeof filteringApi.applyFilters === 'function') {
        filteringApi.applyFilters();
    }
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
    const filterIndices = [4, 0, 1, 5]; // Indici delle colonne da filtrare: [Assigned To, Factory, Model Number, Priority]

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
                const statusCell = row.cells[6]; // Aggiornato l'indice per la colonna status
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
                    modelNumber: ''
                };
            }

            // Estrai i valori unici permessi
            const allowedValues = {
                assignedTo: new Set(tasks.map(t => t.assignedTo)),
                factory: new Set(tasks.map(t => t.factory)),
                modelNumber: new Set(tasks.map(t => t.modelNumber))
            };

            // Verifica la compatibilità dei filtri
            const newFilters = {
                assignedTo: filters.text[0],
                factory: filters.text[1],
                modelNumber: filters.text[2]
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
                modelNumber: ''
            };
        }
    }

    // Funzione per caricare e applicare i filtri salvati
    async function loadSavedFilters() {
        const savedFilters = localStorage.getItem('taskFilters');
        if (savedFilters) {
            const filters = JSON.parse(savedFilters);
            
            // Verifica la compatibilità dei filtri con i permessi
            const validatedFilters = await checkFilterPermissions(filters);
            
            // Applica i filtri di testo validati
            textFilterInputs[0].value = validatedFilters.assignedTo;
            textFilterInputs[1].value = validatedFilters.factory;
            textFilterInputs[2].value = validatedFilters.modelNumber;
            
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

            // Gestione speciale per la colonna priority (indice 5)
            if (columnIndex === 5) {
                // Converti in numeri, se non è un numero sarà NaN
                const aNum = parseInt(aText);
                const bNum = parseInt(bText);
                
                // Se entrambi sono numeri, confronta numericamente
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAscending ? aNum - bNum : bNum - aNum;
                }
                
                // Se solo uno è numero, quello va prima
                if (!isNaN(aNum)) return isAscending ? -1 : 1;
                if (!isNaN(bNum)) return isAscending ? 1 : -1;
                
                // Se nessuno è numero, confronta come testo
                return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
            }

            // Per tutte le altre colonne, usa il confronto normale
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
