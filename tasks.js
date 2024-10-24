document.addEventListener('DOMContentLoaded', async function() {
    await fetchTasks();

    document.getElementById('filter-input').addEventListener('input', filterTasks);
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
    const filterValue = document.getElementById('filter-input').value.toLowerCase();
    const rows = document.querySelectorAll('#task-table tbody tr');

    rows.forEach(row => {
        const assignedTo = row.cells[3].textContent.toLowerCase();
        row.style.display = assignedTo.includes(filterValue) ? '' : 'none';
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
