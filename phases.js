document.addEventListener('DOMContentLoaded', function() {
    initializePhasesPage();
});

function initializePhasesPage() {
    document.getElementById('logout').addEventListener('click', function() {
        window.location.href = 'login.html';
    });

    document.getElementById('add-phase-btn').addEventListener('click', addPhase);

    fetchPhases();
}

async function fetchPhases() {
    try {
        const response = await fetch('/api/phases');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const phases = await response.json();
        displayPhases(phases);
    } catch (error) {
        console.error('Error fetching phases:', error);
    }
}

function displayPhases(phases) {
    const tableBody = document.getElementById('phases-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear existing rows

    phases.forEach(phase => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = phase.name;
        row.insertCell(1).textContent = phase.description;
        row.insertCell(2).textContent = phase.order;

        const actionsCell = row.insertCell(3);
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editPhase(phase.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => confirmDeletePhase(phase.id));
        
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
    });
}

function addPhase() {
    const tableBody = document.getElementById('phases-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0);

    const fields = ['name', 'description', 'order'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        const input = document.createElement('input');
        input.type = field === 'order' ? 'number' : 'text';
        input.name = field;
        cell.appendChild(input);
    });

    const actionsCell = newRow.insertCell(3);
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => saveNewPhase(newRow));
    actionsCell.appendChild(saveBtn);
}

async function saveNewPhase(row) {
    const newPhase = {
        name: row.cells[0].firstChild.value,
        description: row.cells[1].firstChild.value,
        order: parseInt(row.cells[2].firstChild.value)
    };

    try {
        const response = await fetch('/api/phases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newPhase),
        });

        if (response.ok) {
            console.log('Phase added successfully');
            fetchPhases(); // Refresh the phase list
        } else {
            console.error('Failed to add phase');
        }
    } catch (error) {
        console.error('Error adding phase:', error);
    }
}

function editPhase(phaseId) {
    // Implement edit functionality
    console.log('Edit phase:', phaseId);
    // You can implement inline editing or open a modal for editing
}

function confirmDeletePhase(phaseId) {
    if (confirm("Are you sure you want to delete this phase?")) {
        deletePhase(phaseId);
    }
}

async function deletePhase(phaseId) {
    try {
        const response = await fetch(`/api/phases/${phaseId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            console.log('Phase deleted successfully');
            fetchPhases(); // Refresh the phase list
        } else {
            console.error('Failed to delete phase');
        }
    } catch (error) {
        console.error('Error deleting phase:', error);
    }
}
