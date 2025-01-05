let teamMembers = [];

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
    // Verifica lo stato della connessione
    if (!navigator.onLine) {
        window.location.href = 'login.html';
        return;
    }
    await fetchTeamMembers();
    await fetchTasks();

    // Enable column resizing
    enableColumnResizing();

    // Restore column widths on page load
    restoreColumnWidths();

    // Enable column sorting
    enableColumnSorting();

    // Enable live filtering
    enableLiveFiltering();
});

async function fetchTeamMembers() {
    try {
        const response = await fetch('/api/team-members');
        teamMembers = await handleResponse(response);
    } catch (error) {
        handleNetworkError(error);
    }
}

async function fetchTasks() {
    try {
        console.log('Fetching tasks from API...');
        const response = await fetch('/api/tasks');
        console.log('Response status:', response.status);
        const tasks = await handleResponse(response);
        console.log('Fetched tasks:', tasks);
        displayTasks(tasks);
    } catch (error) {
        handleNetworkError(error);
    }
}

function displayTasks(tasks) {
    const tableBody = document.getElementById('task-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear existing rows

    tasks.forEach(task => {
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
        row.insertCell(5).textContent = task.status;

        // Applica il colore di sfondo in base all'utente assegnato
        const assignedMember = teamMembers.find(member => member.name === task.assignedTo);
        if (assignedMember) {
            row.style.backgroundColor = assignedMember.color;
        }
    });

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
    const filterIndices = [4, 0, 1]; // Indici delle colonne da filtrare: [Assigned To, Factory, Model Number]

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

    // Funzione per caricare e applicare i filtri salvati
    function loadSavedFilters() {
        const savedFilters = localStorage.getItem('taskFilters');
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

    for (let i = 0; i < headers.length; i++) {
        headers[i].addEventListener('click', function() {
            const columnIndex = i;
            const rows = Array.from(table.getElementsByTagName('tbody')[0].rows);
            const isAscending = sortDirection[columnIndex];
            rows.sort((a, b) => {
                const aText = a.cells[columnIndex].textContent.trim();
                const bText = b.cells[columnIndex].textContent.trim();
                return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
            });
            sortDirection[columnIndex] = !isAscending; // Toggle sort direction
            rows.forEach(row => table.getElementsByTagName('tbody')[0].appendChild(row)); // Reorder rows
        });
    }
}
