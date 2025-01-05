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

async function initializeDashboard() {
    document.getElementById('logout').addEventListener('click', function() {
        window.location.href = 'login.html';
    });

    // Add event listener for the "Add Project" button
    document.getElementById('add-project-btn').addEventListener('click', addProject);

    // Initial fetch of projects
    await fetchProjects();

    // Enable column resizing
    enableColumnResizing();

    // Enable column sorting
    enableColumnSorting();

    // Enable live filtering
    enableLiveFiltering();

    // Inizializza la gestione della visibilità delle colonne
    initializeColumnVisibility();
}

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
        visibility[checkbox.datas7et.column] = checkbox.checked;
    });
    localStorage.setItem('columnVisibility', JSON.stringify(visibility));
}

// Variabile globale per mantenere il riferimento alle funzioni di filtering
let filteringApi = null;

// Function to fetch project data from the backend
async function fetchProjects() {
    console.log('Fetching projects...');
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const projects = await response.json();
        console.log('Projects fetched:', projects);
        await displayProjects(projects);
        
        // Riapplica i filtri dopo aver caricato i progetti
        if (filteringApi && typeof filteringApi.applyFilters === 'function') {
            filteringApi.applyFilters();
        }
    } catch (error) {
        handleNetworkError(error);
    }
}

// Funzione per recuperare lo status dalla cronologia del progetto
async function getProjectStatus(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history?includeUserName=true`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const history = await response.json();
        
        // Ordina la cronologia per data in ordine decrescente
        history.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Se non ci sono entry nella cronologia, ritorna 'No History'
        if (history.length === 0) {
            return 'No History';
        }
        
        // Cerca la prima entry non completata
        const activeEntry = history.find(entry => entry.status !== 'Completed');
        
        // Se tutte le entry sono completate, ritorna solo 'Completed'
        if (!activeEntry) {
            return 'Completed';
        }
        
        // Se l'entry non completata è "On Hold", ritorna solo "On Hold"
        if (activeEntry.status === 'On Hold') {
            return 'On Hold';
        }
        
        // Altrimenti ritorna la descrizione dell'entry non completata
        return `${activeEntry.description} (${activeEntry.status})`;
    } catch (error) {
        console.error('Error fetching project history:', error);
        return 'Error fetching history'; // Status di default in caso di errore
    }
}

// Function to display projects in the table
async function displayProjects(projects) {
    console.log('Displaying projects:', projects);
    const tableBody = document.getElementById('projects-table').getElementsByTagName('tbody')[0];
    if (!tableBody) {
        console.error('Table body not found!');
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    // Funzione per creare una riga della tabella
    const createTableRow = async (project) => {
        const row = tableBody.insertRow();
        row.style.height = 'auto'; // Ensure consistent row height
        row.insertCell(0).textContent = project.client;
        row.insertCell(1).textContent = project.productKind;
        row.insertCell(2).textContent = project.factory;
        row.insertCell(3).textContent = project.brand;
        row.insertCell(4).textContent = project.range;
        row.insertCell(5).textContent = project.line;
        
        // Create a link for the model number
        const modelNumberCell = row.insertCell(6);
        const modelNumberLink = document.createElement('a');
        modelNumberLink.href = `project-details.html?id=${project.id}`;
        modelNumberLink.textContent = project.modelNumber;
        modelNumberCell.appendChild(modelNumberLink);
        
        row.insertCell(7).textContent = project.factoryModelNumber;
        row.insertCell(8).textContent = project.startDate;
        row.insertCell(9).textContent = project.endDate;
        
        // Recupera e imposta lo status del progetto
        const status = await getProjectStatus(project.id);
        row.insertCell(10).textContent = status;
        
        row.insertCell(11).textContent = project.priority;

        const actionsCell = row.insertCell(12);
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editProject(row, project.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => confirmDelete(project.id));
        
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
    };

    // Crea tutte le righe in modo asincrono
    await Promise.all(projects.map(project => createTableRow(project)));
    console.log('Projects displayed successfully');
}

// Function to handle adding a new project
function addProject() {
    const tableBody = document.getElementById('projects-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0); // Insert at the beginning
    newRow.style.height = 'auto'; // Ensure consistent row height

    const fields = ['client', 'productKind', 'factory', 'brand', 'range', 'line', 'modelNumber', 'factoryModelNumber', 'startDate', 'endDate', 'status', 'priority'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
            {
            const input = document.createElement('input');
            input.type = index === 8 || index === 9 ? 'date' : 'text';
            input.style.backgroundColor = '#ffff99';
            cell.appendChild(input);
        }
    });

    const actionsCell = newRow.insertCell(12);
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
        const newProject = {
            client: newRow.cells[0].firstChild.value,
            productKind: newRow.cells[1].firstChild.value,
            factory: newRow.cells[2].firstChild.value,
            brand: newRow.cells[3].firstChild.value,
            range: newRow.cells[4].firstChild.value,
            line: newRow.cells[5].firstChild.value,
            modelNumber: newRow.cells[6].firstChild.value,
            factoryModelNumber: newRow.cells[7].firstChild.value,
            startDate: newRow.cells[8].firstChild.value,
            endDate: newRow.cells[9].firstChild.value,
            status: 'In Progress', // Status iniziale per nuovo progetto
            priority: newRow.cells[11].firstChild.value
        };

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newProject),
            });

            if (response.ok) {
                console.log('Project added successfully');
                fetchProjects(); // Refresh the project list
            } else {
                console.error('Failed to add project');
            }
        } catch (error) {
            handleNetworkError(error);
        }
    });
    actionsCell.appendChild(saveBtn);
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
        priority: cells[11].textContent
    };

    // Convert cells to input fields
    for (let i = 0; i < 12; i++) {
        if (i === 10) { // Campo status - non modificabile
            continue; // Salta la cella dello status
        }
        cells[i].innerHTML = '';
        const input = document.createElement('input');
        input.type = i === 8 || i === 9 ? 'date' : 'text';
        input.value = projectData[Object.keys(projectData)[i]];
        input.style.backgroundColor = '#ffff99';
        cells[i].appendChild(input);
    }

    // Change edit button to save button
    const actionsCell = cells[12];
    actionsCell.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
        const updatedProject = {
            client: cells[0].firstChild.value,
            productKind: cells[1].firstChild.value,
            factory: cells[2].firstChild.value,
            brand: cells[3].firstChild.value,
            range: cells[4].firstChild.value,
            line: cells[5].firstChild.value,
            modelNumber: cells[6].firstChild.value,
            factoryModelNumber: cells[7].firstChild.value,
            startDate: cells[8].firstChild.value,
            endDate: cells[9].firstChild.value,
            status: cells[10].textContent, // Mantiene lo status corrente
            priority: cells[11].firstChild.value
        };

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
                fetchProjects(); // Refresh the project list
            } else {
                console.error('Failed to update project');
            }
        } catch (error) {
            handleNetworkError(error);
        }
    });
    actionsCell.appendChild(saveBtn);
}

// Function to confirm deletion
function confirmDelete(projectId) {
    if (confirm("Are you sure you want to delete this project?")) {
        deleteProject(projectId);
    }
}

// Function to delete a project
async function deleteProject(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            console.log('Project deleted successfully');
            fetchProjects(); // Refresh the project list
        } else {
            console.error('Failed to delete project');
        }
    } catch (error) {
        handleNetworkError(error);
    }
}

// Function to save column widths to local storage
function saveColumnWidths() {
    const table = document.getElementById('projects-table');
    const headerCells = table.getElementsByTagName('th');
    const columnWidths = Array.from(headerCells).map(cell => cell.style.width);
    console.log('Saving column widths:', columnWidths);
    localStorage.setItem('columnWidths', JSON.stringify(columnWidths));
}

// Function to restore column widths from local storage
function restoreColumnWidths() {
    const columnWidths = JSON.parse(localStorage.getItem('columnWidths'));
    if (columnWidths) {
        const table = document.getElementById('projects-table');
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

// Function to enable column resizing
function enableColumnResizing() {
    const table = document.getElementById('projects-table');
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
            saveColumnWidths(); // Save widths after resizing
        }

        function stopResize() {
            document.removeEventListener('mousemove', resizeColumn);
            document.removeEventListener('mouseup', stopResize);
        }
    }
}

// Function to enable column sorting
function enableColumnSorting() {
    const table = document.getElementById('projects-table');
    const headers = table.getElementsByTagName('th');
    let sortDirection = Array(headers.length).fill(true); // true for ascending, false for descending

    for (let i = 0; i < headers.length - 1; i++) { // Exclude the last column (Actions)
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
    const tableRows = document.getElementById('projects-table').getElementsByTagName('tbody')[0].rows;
    const filterIndices = [0, 1, 2, 3, 4, 5, 6, 7, 11]; // Indici delle colonne da filtrare

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
        localStorage.setItem('projectFilters', JSON.stringify(filters));
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

            // Controllo filtro status
            if (isMatch && selectedStatuses.length > 0) {
                const statusCell = row.cells[10];
                const statusText = statusCell.textContent.trim();
                
                // Gestione speciale per "In Progress"
                if (selectedStatuses.includes('In Progress')) {
                    // Se è selezionato "In Progress", la riga deve NON contenere questi status
                    const excludedStatuses = ['Completed', 'On Hold', 'Archived'];
                    const hasExcludedStatus = excludedStatuses.some(status => statusText === status);
                    
                    // Rimuovi "In Progress" da selectedStatuses per il controllo degli altri status
                    const otherStatuses = selectedStatuses.filter(s => s !== 'In Progress');
                    
                    // La riga corrisponde se:
                    // - NON ha uno status escluso E non ci sono altri filtri status
                    // OPPURE
                    // - NON ha uno status escluso E corrisponde a uno degli altri status selezionati
                    isMatch = !hasExcludedStatus && 
                             (otherStatuses.length === 0 || otherStatuses.includes(statusText));
                } else {
                    // Per gli altri status, usa il controllo normale
                    if (!selectedStatuses.includes(statusText)) {
                        isMatch = false;
                    }
                }
            }

            row.style.display = isMatch ? '' : 'none';
        });
    }

    // Funzione per caricare e applicare i filtri salvati
    function loadSavedFilters() {
        const savedFilters = localStorage.getItem('projectFilters');
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
