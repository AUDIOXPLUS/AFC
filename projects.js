document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, initializing dashboard...');
    initializeDashboard();
    restoreColumnWidths(); // Restore column widths on page load
});

function initializeDashboard() {
    document.getElementById('logout').addEventListener('click', function() {
        window.location.href = 'login.html';
    });

    // Add event listener for the "Add Project" button
    document.getElementById('add-project-btn').addEventListener('click', addProject);

    // Initial fetch of projects
    fetchProjects();

    // Enable column resizing
    enableColumnResizing();

    // Enable column sorting
    enableColumnSorting();

    // Enable live filtering
    enableLiveFiltering();
}

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
        displayProjects(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
    }
}

// Function to display projects in the table
function displayProjects(projects) {
    console.log('Displaying projects:', projects);
    const tableBody = document.getElementById('projects-table').getElementsByTagName('tbody')[0];
    if (!tableBody) {
        console.error('Table body not found!');
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    projects.forEach(project => {
        const row = tableBody.insertRow();
        row.style.height = 'auto'; // Ensure consistent row height
        row.insertCell(0).textContent = project.factory;
        
        // Create a link for the model number
        const modelNumberCell = row.insertCell(1);
        const modelNumberLink = document.createElement('a');
        modelNumberLink.href = `project-details.html?id=${project.id}`;
        modelNumberLink.textContent = project.modelNumber;
        modelNumberCell.appendChild(modelNumberLink);
        
        row.insertCell(2).textContent = project.factoryModelNumber;
        row.insertCell(3).textContent = project.productKind;
        row.insertCell(4).textContent = project.client;
        row.insertCell(5).textContent = project.startDate;
        row.insertCell(6).textContent = project.endDate;
        row.insertCell(7).textContent = project.status;

        const actionsCell = row.insertCell(8);
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
    });
    console.log('Projects displayed successfully');
}

// Function to handle adding a new project
function addProject() {
    const tableBody = document.getElementById('projects-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0); // Insert at the beginning
    newRow.style.height = 'auto'; // Ensure consistent row height

    const fields = ['factory', 'modelNumber', 'factoryModelNumber', 'productKind', 'client', 'startDate', 'endDate', 'status'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        const input = document.createElement('input');
        input.type = index === 5 || index === 6 ? 'date' : 'text';
        input.style.backgroundColor = '#ffff99'; // Light yellow background
        cell.appendChild(input);
    });

    const actionsCell = newRow.insertCell(8);
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
        const newProject = {
            factory: newRow.cells[0].firstChild.value,
            modelNumber: newRow.cells[1].firstChild.value,
            factoryModelNumber: newRow.cells[2].firstChild.value,
            productKind: newRow.cells[3].firstChild.value,
            client: newRow.cells[4].firstChild.value,
            startDate: newRow.cells[5].firstChild.value,
            endDate: newRow.cells[6].firstChild.value,
            status: newRow.cells[7].firstChild.value
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
            console.error('Error adding project:', error);
        }
    });
    actionsCell.appendChild(saveBtn);
}

// Function to edit a project
function editProject(row, projectId) {
    const cells = row.getElementsByTagName('td');
    const projectData = {
        factory: cells[0].textContent,
        modelNumber: cells[1].textContent,
        factoryModelNumber: cells[2].textContent,
        productKind: cells[3].textContent,
        client: cells[4].textContent,
        startDate: cells[5].textContent,
        endDate: cells[6].textContent,
        status: cells[7].textContent
    };

    // Convert cells to input fields
    for (let i = 0; i < 8; i++) {
        const input = document.createElement('input');
        input.type = i === 5 || i === 6 ? 'date' : 'text'; // Date inputs for start and end dates
        input.value = projectData[Object.keys(projectData)[i]];
        input.style.backgroundColor = '#ffff99'; // Light yellow background
        cells[i].innerHTML = '';
        cells[i].appendChild(input);
    }

    // Change edit button to save button
    const actionsCell = cells[8];
    actionsCell.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
        const updatedProject = {
            factory: cells[0].firstChild.value,
            modelNumber: cells[1].firstChild.value,
            factoryModelNumber: cells[2].firstChild.value,
            productKind: cells[3].firstChild.value,
            client: cells[4].firstChild.value,
            startDate: cells[5].firstChild.value,
            endDate: cells[6].firstChild.value,
            status: cells[7].firstChild.value
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
            console.error('Error updating project:', error);
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
        console.error('Error deleting project:', error);
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
    const filterInputs = document.querySelectorAll('.filters input[type="text"]');
    const tableRows = document.getElementById('projects-table').getElementsByTagName('tbody')[0].rows;

    const filterIndices = [0, 1, 3, 4, 7];

    filterInputs.forEach(() => {
        filterInputs.forEach((input) => {
            input.addEventListener('input', function() {
                const filterValues = Array.from(filterInputs).map(input => input.value.toLowerCase().trim());

                Array.from(tableRows).forEach(row => {
                    let isMatch = true;
                    for (let i = 0; i < filterValues.length; i++) {
                        const filterValue = filterValues[i];
                        const cellIndex = filterIndices[i];
                        const cell = row.cells[cellIndex];

                        if (cell) {
                            const cellText = cell.textContent.toLowerCase().trim();
                            if (filterValue && !cellText.includes(filterValue)) {
                                isMatch = false;
                                break;
                            }
                        } else {
                            isMatch = false;
                            break;
                        }
                    }
                    row.style.display = isMatch ? '' : 'none';
                });
            });
        });
    });
}
