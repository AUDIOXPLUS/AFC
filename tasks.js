document.addEventListener('DOMContentLoaded', async function() {
    await fetchTasks();

    document.getElementById('filter-input').addEventListener('input', filterTasks);
    document.getElementById('model-filter').addEventListener('input', filterTasks);
    document.getElementById('status-filter').addEventListener('input', filterTasks);

    // Enable column resizing
    enableColumnResizing();

    // Restore column widths on page load
    restoreColumnWidths();

    // Enable column sorting
    enableColumnSorting();
});

async function fetchTasks() {
    try {
        console.log('Fetching tasks from API...');
        const response = await fetch('/api/tasks');
        console.log('Response status:', response.status);
        const tasks = await handleResponse(response);
        console.log('Fetched tasks:', tasks);
        displayTasks(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
    }
}

function displayTasks(tasks) {
    const tableBody = document.getElementById('task-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear existing rows

    tasks.forEach(task => {
        const row = tableBody.insertRow();
        row.setAttribute('data-task-id', task.id); // Store the task ID
        row.insertCell(0).innerHTML = `<a href="project-details.html?id=${task.projectId}">${task.modelNumber}</a>`;
        row.insertCell(1).textContent = task.date;
        row.insertCell(2).textContent = task.description;
        row.insertCell(3).textContent = task.assignedTo;
        row.insertCell(4).textContent = task.status;
        // Removed actions cell creation
    });
}

function filterTasks() {
    const userFilterValue = document.getElementById('filter-input').value.toLowerCase();
    const modelFilterValue = document.getElementById('model-filter').value.toLowerCase();
    const statusFilterValue = document.getElementById('status-filter').value.toLowerCase();
    const rows = document.querySelectorAll('#task-table tbody tr');

    rows.forEach(row => {
        const assignedTo = row.cells[3].textContent.toLowerCase();
        const modelNumber = row.cells[0].textContent.toLowerCase();
        const status = row.cells[4].textContent.toLowerCase();

        const matchesUser = assignedTo.includes(userFilterValue);
        const matchesModel = modelNumber.includes(modelFilterValue);
        const matchesStatus = status.includes(statusFilterValue);

        row.style.display = matchesUser && matchesModel && matchesStatus ? '' : 'none';
    });
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

function editTask(taskId) {
    // Logic to edit the task
    console.log('Edit task with ID:', taskId);
}

function confirmDelete(taskId) {
    if (confirm("Are you sure you want to delete this task?")) {
        deleteTask(taskId);
    }
}

async function deleteTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE',
        });

        await handleResponse(response);
        console.log('Task deleted successfully');
        fetchTasks(); // Refresh the task list
    } catch (error) {
        console.error('Error deleting task:', error);
    }
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
            saveColumnWidths(); // Save widths after resizing
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
