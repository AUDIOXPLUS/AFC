document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    window.projectId = urlParams.get('id'); // Dichiarato come variabile globale

    if (projectId) {
        fetchProjectDetails(projectId);
        fetchProjectPhases(projectId);
        fetchTeamMembers();
    } else {
        console.error('No project ID provided');
    }

    document.getElementById('add-history-btn').addEventListener('click', () => addHistoryEntry(projectId));

    // Recupera e visualizza il nome utente
    fetch('/api/session-user')
        .then(response => handleResponse(response))
        .then(data => {
            if (data.name) {
                document.querySelector('.user-info span').textContent = `Welcome, ${data.name}`;
            }
        })
        .catch(error => console.error('Error fetching session user:', error));

    restoreColumnWidths();
    enableColumnResizing();
    enableColumnSorting(); // Se desideri abilitare l'ordinamento delle colonne
});

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

async function fetchProjectDetails(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`);
        const project = await handleResponse(response);
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
        const phases = await handleResponse(response);
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
        const history = await handleResponse(response);
        displayProjectHistory(history);
    } catch (error) {
        console.error('Error fetching project history:', error);
    }
}

let teamMembers = [];

async function fetchTeamMembers() {
    try {
        const response = await fetch('/api/team-members');
        teamMembers = await handleResponse(response);
    } catch (error) {
        console.error('Error fetching team members:', error);
    }
}

function displayProjectHistory(history) {
    const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear existing rows

    history.forEach(entry => {
        const row = tableBody.insertRow();
        row.setAttribute('data-entry-id', entry.id); // Memorizza l'ID dell'entry
        row.insertCell(0).textContent = entry.date;
        row.insertCell(1).textContent = entry.phase;
        row.insertCell(2).textContent = entry.description;
        row.insertCell(3).textContent = entry.assignedTo;
        row.insertCell(4).textContent = entry.status;

        const actionsCell = row.insertCell(5);
        // Creare il pulsante "Edit" con la classe CSS corretta
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn'; // Applica la classe CSS
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
            console.log('Edit button clicked for entry ID:', entry.id); // Log ID
            editHistoryEntry(entry.id);
        });
        actionsCell.appendChild(editBtn);

        // Creare il pulsante "Delete" con la classe CSS corretta
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn'; // Applica la classe CSS
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => confirmDelete(entry.id));
        actionsCell.appendChild(deleteBtn);

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
            input.style.backgroundColor = '#ffff99'; // Sfondo giallo chiaro
            cell.appendChild(input);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = field;
            input.style.backgroundColor = '#ffff99'; // Sfondo giallo chiaro
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

        await handleResponse(response);
        console.log('History entry added successfully');
        fetchProjectHistory(projectId);
    } catch (error) {
        console.error('Error adding history entry:', error);
    }
}

function editHistoryEntry(entryId) {
    const row = document.querySelector(`tr[data-entry-id='${entryId}']`); // Seleziona la riga corretta
    if (row) {
        const cells = row.getElementsByTagName('td');
        const historyData = {
            date: cells[0].textContent,
            phase: cells[1].textContent,
            description: cells[2].textContent,
            assignedTo: cells[3].textContent,
            status: cells[4].textContent
        };

        // Rimuovi la riga che cambia il colore di sfondo della riga
        // row.style.backgroundColor = 'yellow';

        // Converti le celle in campi di input
        for (let i = 0; i < 5; i++) {
            let input;
            if (i === 3) { // Campo 'assignedTo'
                input = document.createElement('select');
                teamMembers.forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.name;
                    option.textContent = member.name;
                    if (member.name === historyData.assignedTo) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else {
                input = document.createElement('input');
                input.type = i === 0 ? 'date' : 'text'; // Input di tipo data per la data
                input.value = historyData[Object.keys(historyData)[i]];
            }
            input.style.backgroundColor = '#ffff99'; // Sfondo giallo chiaro
            cells[i].innerHTML = '';
            cells[i].appendChild(input);
        }

        // Cambia il pulsante Edit in Save
        const actionsCell = cells[5];
        actionsCell.innerHTML = '';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', async function() {
            const updatedEntry = {
                date: cells[0].firstChild.value,
                phase: cells[1].firstChild.value,
                description: cells[2].firstChild.value,
                assignedTo: cells[3].firstChild.value,
                status: cells[4].firstChild.value
            };

            try {
                const response = await fetch(`/api/projects/${projectId}/history/${entryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatedEntry),
                });

                if (response.ok) {
                    console.log('History entry updated successfully');
                    fetchProjectHistory(projectId); // Aggiorna la lista delle history
                } else {
                    console.error('Failed to update history entry');
                }
            } catch (error) {
                console.error('Error updating history entry:', error);
            }
        });
        actionsCell.appendChild(saveBtn);
    } else {
        console.error('Row not found for entryId:', entryId);
    }
}

// Aggiunta delle funzioni per la conferma e l'eliminazione
function confirmDelete(entryId) {
    if (confirm("Are you sure you want to delete this history entry?")) {
        deleteHistoryEntry(entryId);
    }
}

async function deleteHistoryEntry(entryId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history/${entryId}`, {
            method: 'DELETE',
        });

        await handleResponse(response);
        console.log('History entry deleted successfully');
        fetchProjectHistory(projectId); // Aggiorna la lista delle history
    } catch (error) {
        console.error('Error deleting history entry:', error);
    }
}

function saveColumnWidths() {
    const table = document.getElementById('history-table');
    const headerCells = table.getElementsByTagName('th');
    const columnWidths = Array.from(headerCells).map(cell => cell.style.width);
    console.log('Salvataggio delle larghezze delle colonne:', columnWidths);
    localStorage.setItem('historyColumnWidths', JSON.stringify(columnWidths));
}

function restoreColumnWidths() {
    const columnWidths = JSON.parse(localStorage.getItem('historyColumnWidths'));
    if (columnWidths) {
        const table = document.getElementById('history-table');
        const headerCells = table.getElementsByTagName('th');
        columnWidths.forEach((width, index) => {
            if (headerCells[index]) {
                headerCells[index].style.width = width;
            }
        });
        console.log('Larghezze delle colonne ripristinate:', columnWidths);
    } else {
        console.log('Nessuna larghezza delle colonne trovata nel local storage.');
    }
}

function enableColumnResizing() {
    const table = document.getElementById('history-table');
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
            saveColumnWidths(); // Salva le larghezze dopo il ridimensionamento
        }

        function stopResize() {
            document.removeEventListener('mousemove', resizeColumn);
            document.removeEventListener('mouseup', stopResize);
        }
    }
}

function enableColumnSorting() {
    const table = document.getElementById('history-table');
    const headers = table.getElementsByTagName('th');
    let sortDirection = Array(headers.length).fill(true); // true per ascendente, false per discendente

    for (let i = 0; i < headers.length - 1; i++) { // Esclude l'ultima colonna (Actions)
        headers[i].addEventListener('click', function() {
            const columnIndex = i;
            const rows = Array.from(table.getElementsByTagName('tbody')[0].rows);
            const isAscending = sortDirection[columnIndex];
            rows.sort((a, b) => {
                const aText = a.cells[columnIndex].textContent.trim();
                const bText = b.cells[columnIndex].textContent.trim();
                return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
            });
            sortDirection[columnIndex] = !isAscending; // Inverte la direzione di ordinamento
            rows.forEach(row => table.getElementsByTagName('tbody')[0].appendChild(row)); // Riordina le righe
        });
    }
}
