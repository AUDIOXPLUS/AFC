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

    // Initial fetch of projects (includerà il sorting)
    await fetchProjects();
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

// Function to fetch project data from the backend
async function fetchProjects() {
    console.log('Fetching projects...');
    try {
        const showArchived = document.getElementById('show-archived').checked;
        const response = await fetch(`/api/projects?showArchived=${showArchived}`);
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

        // Applica l'ultimo sorting dopo che i dati sono stati caricati e filtrati
        applyLastSorting();
    } catch (error) {
        handleNetworkError(error);
    }
}

// Funzione per recuperare lo status dalla cronologia del progetto
async function getProjectStatus(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const history = await response.json();
        console.log('Project history:', history); // Debug log

        // Ordina la cronologia per data in ordine decrescente
        history.sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log('Sorted history:', history); // Debug log

        // Se non ci sono entry nella cronologia
        if (history.length === 0) {
            return {
                status: 'No History',
                assignedTo: 'Not Assigned'
            };
        }

        // Cerca la prima entry non completata
        const activeEntry = history.find(entry => entry.status !== 'Completed');

        // Se tutte le entry sono completate
        if (!activeEntry) {
            console.log('All entries completed, using last entry:', history[0]); // Debug log
            return {
                status: 'Completed',
                assignedTo: history[0].assigned_to || 'Not Assigned'
            };
        }

        // Se l'entry non completata è "On Hold"
        if (activeEntry.status === 'On Hold') {
            console.log('Found On Hold entry:', activeEntry); // Debug log
            return {
                status: 'On Hold',
                assignedTo: activeEntry.assigned_to || 'Not Assigned'
            };
        }

        // Altrimenti ritorna la descrizione dell'entry non completata
        console.log('Using active entry:', activeEntry); // Debug log
        return {
            status: `${activeEntry.description} (${activeEntry.status})`,
            assignedTo: activeEntry.assigned_to || 'Not Assigned'
        };
    } catch (error) {
        console.error('Error fetching project history:', error);
        return {
            status: 'Error fetching history',
            assignedTo: 'Not Assigned'
        };
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

        // Recupera e imposta lo status del progetto e l'utente assegnato
        const projectStatus = await getProjectStatus(project.id);
        const statusCell = row.insertCell(10);
        statusCell.textContent = projectStatus.status;
        statusCell.title = projectStatus.status; // Aggiunge il tooltip
        // Assigned to
        const assignedToCell = row.insertCell(11);
        assignedToCell.textContent = projectStatus.assignedTo;
        assignedToCell.title = assignedToCell.textContent;

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
        if (project.archived || projectStatus.status === 'Completed') {
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

        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
    };

    // Crea tutte le righe in modo asincrono
    await Promise.all(projects.map(project => createTableRow(project)));
    console.log('Projects displayed successfully');
    
    // Ripristina le larghezze delle colonne dopo aver caricato i dati
    restoreColumnWidths();
}

// Function to handle adding a new project
function addProject() {
    const tableBody = document.getElementById('projects-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0); // Insert at the beginning
    newRow.classList.add('new-entry-row'); // Aggiungi una classe per lo styling

    // Definisci i campi con le loro proprietà
    const fields = [
        { name: 'client', type: 'text', editable: true },
        { name: 'productKind', type: 'text', editable: true },
        { name: 'factory', type: 'text', editable: true },
        { name: 'brand', type: 'text', editable: true },
        { name: 'range', type: 'text', editable: true },
        { name: 'line', type: 'text', editable: true },
        { name: 'modelNumber', type: 'text', editable: true },
        { name: 'factoryModelNumber', type: 'text', editable: true },
        { name: 'startDate', type: 'date', editable: true },
        { name: 'endDate', type: 'date', editable: true },
        { name: 'status', type: 'text', editable: false, defaultValue: '-' },
        { name: 'assignedTo', type: 'text', editable: false, defaultValue: '-' },
        { name: 'priority', type: 'text', editable: true }
    ];

    // Crea le celle con gli input
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        cell.classList.add('input-cell'); // Aggiungi una classe per lo styling

        if (!field.editable) {
            cell.textContent = field.defaultValue;
        } else {
            if (field.name === 'productKind') {
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
            } else {
                const input = document.createElement('input');
                input.type = field.type;
                input.name = field.name;
                input.classList.add('new-entry-input');
                cell.appendChild(input);
            }
        }
    });

    const actionsCell = newRow.insertCell(fields.length);
    actionsCell.classList.add('actions-cell');
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.classList.add('save-btn');
    saveBtn.addEventListener('click', async function() {
        const newProject = {
            client: newRow.cells[0].firstChild.value,
            productKind: newRow.cells[1].querySelector('input').value,
            factory: newRow.cells[2].firstChild.value,
            brand: newRow.cells[3].firstChild.value,
            range: newRow.cells[4].firstChild.value,
            line: newRow.cells[5].firstChild.value,
            modelNumber: newRow.cells[6].firstChild.value,
            factoryModelNumber: newRow.cells[7].firstChild.value,
            startDate: newRow.cells[8].firstChild.value,
            endDate: newRow.cells[9].firstChild.value,
            priority: newRow.cells[12].firstChild.value
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
                const savedWidths = localStorage.getItem('projectsColumnWidths');
                await fetchProjects(); // Refresh the project list and apply sorting
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
        if (i === 1) { // Campo productKind
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
        } else {
            const input = document.createElement('input');
            input.type = i === 8 || i === 9 ? 'date' : 'text';
            input.value = projectData[Object.keys(projectData)[i]];
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
        const updatedProject = {
            client: cells[0].firstChild.value,
            productKind: cells[1].querySelector('input').value,
            factory: cells[2].firstChild.value,
            brand: cells[3].firstChild.value,
            range: cells[4].firstChild.value,
            line: cells[5].firstChild.value,
            modelNumber: cells[6].firstChild.value,
            factoryModelNumber: cells[7].firstChild.value,
            startDate: cells[8].firstChild.value,
            endDate: cells[9].firstChild.value,
            status: cells[10].textContent, // Mantiene lo status corrente
            assignedTo: cells[11].textContent, // Mantiene l'utente assegnato corrente
            priority: cells[12].firstChild.value
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

    // Gestione checkbox progetti archiviati
    const showArchivedCheckbox = document.getElementById('show-archived');
    showArchivedCheckbox.addEventListener('change', () => {
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
