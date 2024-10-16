document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (projectId) {
        fetchProjectDetails(projectId);
        fetchProjectPhases(projectId);
        fetchTeamMembers();
    } else {
        console.error('No project ID provided');
    }

    document.getElementById('add-history-btn').addEventListener('click', () => addHistoryEntry(projectId));
});

async function fetchProjectDetails(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const project = await response.json();
        displayProjectDetails(project);
        fetchProjectHistory(projectId);
    } catch (error) {
        console.error('Error fetching project details:', error);
    }
}

function displayProjectDetails(project) {
    document.getElementById('project-model-number').textContent = project.modelNumber;

    const detailsDiv = document.getElementById('project-details');
    detailsDiv.innerHTML = `
        <p><strong>Factory:</strong> ${project.factory}</p>
        <p><strong>Factory Model Number:</strong> ${project.factoryModelNumber}</p>
        <p><strong>Product Kind:</strong> ${project.productKind}</p>
        <p><strong>Client:</strong> ${project.client}</p>
        <p><strong>Start Date:</strong> ${project.startDate}</p>
        <p><strong>End Date:</strong> ${project.endDate}</p>
        <p><strong>Status:</strong> ${project.status}</p>
    `;
}

async function fetchProjectPhases(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/phases`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const phases = await response.json();
        displayPhaseSummary(phases);
    } catch (error) {
        console.error('Error fetching project phases:', error);
    }
}

function displayPhaseSummary(phases) {
    const summaryDiv = document.getElementById('phase-summary');
    summaryDiv.innerHTML = '';

    phases.forEach(phase => {
        const phaseElement = document.createElement('div');
        phaseElement.className = 'phase-item';
        phaseElement.innerHTML = `
            <h3>${phase.name}</h3>
            <p>Status: ${phase.status}</p>
            <p>Progress: ${phase.progress}%</p>
        `;
        summaryDiv.appendChild(phaseElement);
    });
}

async function fetchProjectHistory(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const history = await response.json();
        displayProjectHistory(history);
    } catch (error) {
        console.error('Error fetching project history:', error);
    }
}

let teamMembers = [];

async function fetchTeamMembers() {
    try {
        const response = await fetch('/api/team-members');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        teamMembers = await response.json();
    } catch (error) {
        console.error('Error fetching team members:', error);
    }
}

function displayProjectHistory(history) {
    const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear existing rows

    history.forEach(entry => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = entry.date;
        row.insertCell(1).textContent = entry.phase;
        row.insertCell(2).textContent = entry.description;
        row.insertCell(3).textContent = entry.assignedTo;
        row.insertCell(4).textContent = entry.status;

        const actionsCell = row.insertCell(5);
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editHistoryEntry(entry.id));
        actionsCell.appendChild(editBtn);

        // Apply color-coding based on assigned team member
        const assignedMember = teamMembers.find(member => member.name === entry.assignedTo);
        if (assignedMember) {
            row.style.backgroundColor = assignedMember.color;
        }
    });
}

function addHistoryEntry(projectId) {
    const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0);

    const fields = ['date', 'phase', 'description', 'assignedTo', 'status'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        if (field === 'assignedTo') {
            const select = document.createElement('select');
            teamMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.name;
                option.textContent = member.name;
                select.appendChild(option);
            });
            cell.appendChild(select);
        } else if (field === 'date') {
            const input = document.createElement('input');
            input.type = 'date';
            input.name = field;
            cell.appendChild(input);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = field;
            cell.appendChild(input);
        }
    });

    const actionsCell = newRow.insertCell(5);
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => saveNewHistoryEntry(projectId, newRow));
    actionsCell.appendChild(saveBtn);
}

async function saveNewHistoryEntry(projectId, row) {
    const newEntry = {
        date: row.cells[0].firstChild.value,
        phase: row.cells[1].firstChild.value,
        description: row.cells[2].firstChild.value,
        assignedTo: row.cells[3].firstChild.value,
        status: row.cells[4].firstChild.value
    };

    try {
        const response = await fetch(`/api/projects/${projectId}/history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newEntry),
        });

        if (response.ok) {
            console.log('History entry added successfully');
            fetchProjectHistory(projectId);
        } else {
            console.error('Failed to add history entry');
        }
    } catch (error) {
        console.error('Error adding history entry:', error);
    }
}

function editHistoryEntry(entryId) {
    // Implement edit functionality for history entries
    console.log('Edit history entry:', entryId);
    // You can implement a modal or inline editing here
}
