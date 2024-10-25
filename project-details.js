document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    window.projectId = urlParams.get('id'); // Dichiarato come variabile globale
    window.currentUserId = null; // Store current user ID for file operations

    if (projectId) {
        await fetchTeamMembers(); // Ensure teamMembers is populated first
        await fetchProjectDetails(projectId);
        await fetchProjectPhases(projectId);
        
        // Get current user ID
        const response = await fetch('/api/session-user');
        const userData = await handleResponse(response);
        if (userData && userData.id) {
            window.currentUserId = userData.id;
        }
    } else {
        console.error('No project ID provided');
    }

    document.getElementById('add-history-btn').addEventListener('click', () => addHistoryEntry(projectId));

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
    enableColumnSorting();
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
        console.log('Project History:', history);
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

async function fetchEntryFiles(entryId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/files?historyId=${entryId}`);
        return await handleResponse(response);
    } catch (error) {
        console.error('Error fetching files:', error);
        return [];
    }
}

function displayProjectHistory(history) {
    const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';

    history.forEach(async entry => {
        const row = tableBody.insertRow();
        row.setAttribute('data-entry-id', entry.id);
        row.insertCell(0).textContent = entry.date;
        row.insertCell(1).textContent = entry.phase;
        row.insertCell(2).textContent = entry.description;
        row.insertCell(3).textContent = entry.assigned_to;
        row.insertCell(4).textContent = entry.status;

        // Files cell
        const filesCell = row.insertCell(5);
        const fileUploadForm = document.createElement('form');
        fileUploadForm.className = 'file-upload-form';
        fileUploadForm.innerHTML = `
            <input type="file" name="file" required>
            <button type="submit" class="upload-btn">
                <i class="fas fa-upload"></i>
            </button>
        `;
        fileUploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(fileUploadForm);
            formData.append('historyId', entry.id); // Include historyId in the form data
            try {
                const response = await fetch(`/api/projects/${projectId}/files`, {
                    method: 'POST',
                    body: formData
                });
                await handleResponse(response);
                fetchProjectHistory(projectId);
            } catch (error) {
                console.error('Error uploading file:', error);
            }
        });
        filesCell.appendChild(fileUploadForm);

        // Display existing files
        const files = await fetchEntryFiles(entry.id);
        const fileList = document.createElement('div');
        fileList.className = 'file-list';
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span>${file.filename}</span>
                <button onclick="downloadFile(${file.id})" class="download-btn">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="deleteFile(${file.id})" class="delete-btn">
                    <i class="fas fa-trash"></i>
                </button>
                ${file.locked_by ? 
                    file.locked_by === currentUserId ?
                        `<button onclick="unlockFile(${file.id})" class="unlock-btn">
                            <i class="fas fa-unlock"></i>
                        </button>` :
                        `<span class="locked-by">Locked by ${file.locked_by_name}</span>` :
                    `<button onclick="lockFile(${file.id})" class="lock-btn">
                        <i class="fas fa-lock"></i>
                    </button>`
                }
            `;
            fileList.appendChild(fileItem);
        });
        filesCell.appendChild(fileList);

        const actionsCell = row.insertCell(6);
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editHistoryEntry(entry.id));
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => confirmDelete(entry.id));
        actionsCell.appendChild(deleteBtn);

        const assignedMember = teamMembers.find(member => member.name === entry.assigned_to);
        if (assignedMember) {
            row.style.backgroundColor = assignedMember.color;
        }
    });
}

async function deleteFile(fileId) {
    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE'
        });
        await handleResponse(response);
        fetchProjectHistory(projectId);
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}

function addHistoryEntry(projectId) {
    const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0);

    const fields = ['date', 'phase', 'description', 'assigned_to', 'status'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        if (field === 'assigned_to') {
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
            input.style.backgroundColor = '#ffff99';
            cell.appendChild(input);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = field;
            input.style.backgroundColor = '#ffff99';
            cell.appendChild(input);
        }
    });

    // Add empty files cell
    const filesCell = newRow.insertCell(5);
    const fileUploadForm = document.createElement('form');
    fileUploadForm.className = 'file-upload-form';
    fileUploadForm.innerHTML = `
        <input type="file" name="file">
        <button type="submit" class="upload-btn" disabled>
            <i class="fas fa-upload"></i>
        </button>
        <span class="upload-note">Save entry first to upload files</span>
    `;
    filesCell.appendChild(fileUploadForm);

    const actionsCell = newRow.insertCell(6);
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
        assigned_to: row.cells[3].querySelector('select').value,
        status: row.cells[4].firstChild.value
    };

    console.log('New Entry:', newEntry);

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
    const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
    if (row) {
        const cells = row.getElementsByTagName('td');
        const historyData = {
            date: cells[0].textContent,
            phase: cells[1].textContent,
            description: cells[2].textContent,
            assigned_to: cells[3].textContent,
            status: cells[4].textContent
        };

        for (let i = 0; i < 5; i++) {
            let input;
            if (i === 3) {
                input = document.createElement('select');
                teamMembers.forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.name;
                    option.textContent = member.name;
                    if (member.name === historyData.assigned_to) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else {
                input = document.createElement('input');
                input.type = i === 0 ? 'date' : 'text';
                input.value = historyData[Object.keys(historyData)[i]];
            }
            input.style.backgroundColor = '#ffff99';
            cells[i].innerHTML = '';
            cells[i].appendChild(input);
        }

        const actionsCell = cells[6];
        actionsCell.innerHTML = '';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', async function() {
            const updatedEntry = {
                date: cells[0].firstChild.value,
                phase: cells[1].firstChild.value,
                description: cells[2].firstChild.value,
                assignedTo: cells[3].querySelector('select').value,
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
                    fetchProjectHistory(projectId);
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
        fetchProjectHistory(projectId);
    } catch (error) {
        console.error('Error deleting history entry:', error);
    }
}

async function downloadFile(fileId) {
    try {
        window.location.href = `/api/files/${fileId}/download`;
    } catch (error) {
        console.error('Error downloading file:', error);
    }
}

async function lockFile(fileId) {
    try {
        const response = await fetch(`/api/files/${fileId}/lock`, {
            method: 'POST'
        });
        await handleResponse(response);
        fetchProjectHistory(projectId);
    } catch (error) {
        console.error('Error locking file:', error);
    }
}

async function unlockFile(fileId) {
    try {
        const response = await fetch(`/api/files/${fileId}/unlock`, {
            method: 'POST'
        });
        await handleResponse(response);
        fetchProjectHistory(projectId);
    } catch (error) {
        console.error('Error unlocking file:', error);
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
