// Aggiunta di un listener per l'evento DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    window.projectId = urlParams.get('id'); // Dichiarato come variabile globale
    window.currentUserId = null; // Memorizza l'ID utente corrente per le operazioni sui file

    // Recupera e visualizza il nome utente
    try {
        const response = await fetch('/api/session-user');
        const userData = await handleResponse(response);
        console.log('userData:', userData);
        if (userData && userData.username) {
            window.currentUserId = String(userData.id);
            if (userData.name) {
                document.querySelector('.user-info span').textContent = `Welcome, ${userData.name}`;
            }
        } else {
            console.error('userData.username is missing or null');
            window.location.href = '/login.html';
            return;
        }
    } catch (error) {
        console.error('Error fetching session user:', error);
        window.location.href = '/login.html';
        return;
    }

    if (projectId) {
        await fetchTeamMembers(); // Assicura che teamMembers sia popolato prima
        await fetchProjectDetails(projectId);
        await fetchProjectPhases(projectId);
    } else {
        console.error('No project ID provided');
    }

    document.getElementById('add-history-btn').addEventListener('click', () => addHistoryEntry(projectId));

    restoreColumnWidths();
    enableColumnResizing();
    enableColumnSorting();
});

// Funzione per gestire la risposta
async function handleResponse(response) {
    console.log('Response status:', response.status);
    if (response.status === 401) {
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
    }
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    try {
        return await response.json();
    } catch (error) {
        console.error('Error parsing JSON:', error);
        throw new Error('Invalid JSON response');
    }
}

// Funzione per recuperare i dettagli del progetto
async function fetchProjectDetails(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`);
        const project = await handleResponse(response);
        displayProjectDetails(project);
        await fetchProjectHistory(projectId);
    } catch (error) {
        console.error('Error fetching project details:', error);
    }
}

// Funzione per visualizzare i dettagli del progetto
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

// Funzione per recuperare le fasi del progetto
async function fetchProjectPhases(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/phases`);
        const phases = await handleResponse(response);
        displayPhaseSummary(phases);
    } catch (error) {
        console.error('Error fetching project phases:', error);
    }
}

// Funzione per visualizzare il riepilogo delle fasi
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

// Funzione per recuperare la cronologia del progetto
async function fetchProjectHistory(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history?includeUserName=true`);
        const history = await handleResponse(response);
        console.log('Project History:', history);
        displayProjectHistory(history);
    } catch (error) {
        console.error('Error fetching project history:', error);
    }
}

let teamMembers = [];

// Funzione per recuperare i membri del team
async function fetchTeamMembers() {
    try {
        const response = await fetch('/api/team-members');
        teamMembers = await handleResponse(response);
    } catch (error) {
        console.error('Error fetching team members:', error);
    }
}

// Funzione per recuperare i file di una voce
async function fetchEntryFiles(entryId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/files?historyId=${entryId}`);
        return await handleResponse(response);
    } catch (error) {
        console.error('Error fetching files:', error);
        return [];
    }
}

// Funzione per aggiornare solo la cella dei file di una riga specifica
async function updateFilesCell(entryId) {
    const files = await fetchEntryFiles(entryId);
    const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
    if (!row) return;

    const filesCell = row.cells[5];
    filesCell.innerHTML = ''; // Pulisce solo la cella dei file

    // Ricrea il form di upload
    const fileUploadForm = document.createElement('form');
    fileUploadForm.className = 'file-upload-form';
    fileUploadForm.innerHTML = `
        <input type="file" name="file" required>
        <input type="hidden" name="historyId" value="${entryId}">
        <button type="submit" class="upload-btn">
            <i class="fas fa-upload"></i>
        </button>
    `;
    fileUploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(fileUploadForm);
        try {
            const response = await fetch(`/api/projects/${projectId}/files`, {
                method: 'POST',
                body: formData
            });
            await handleResponse(response);
            updateFilesCell(entryId); // Aggiorna solo questa cella
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    });
    filesCell.appendChild(fileUploadForm);

    // Visualizza i file esistenti
    const fileList = document.createElement('div');
    fileList.className = 'file-list';
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileNameSpan = document.createElement('span');
        fileNameSpan.textContent = file.filename;
        fileItem.appendChild(fileNameSpan);
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        const downloadIcon = document.createElement('i');
        downloadIcon.className = 'fas fa-download';
        downloadBtn.appendChild(downloadIcon);
        downloadBtn.addEventListener('click', () => downloadFile(file.id));
        fileItem.appendChild(downloadBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'fas fa-trash';
        deleteBtn.appendChild(deleteIcon);
        deleteBtn.addEventListener('click', async () => {
            await deleteFile(file.id);
            updateFilesCell(entryId); // Aggiorna solo questa cella dopo l'eliminazione
        });
        fileItem.appendChild(deleteBtn);
        
        if (file.locked_by) {
            const unlockBtn = document.createElement('button');
            unlockBtn.className = 'unlock-btn';
            const unlockIcon = document.createElement('i');
            unlockIcon.className = 'fas fa-unlock';
            unlockBtn.appendChild(unlockIcon);

            const fileLockedBy = String(file.locked_by);
            const userId = String(currentUserId);
            unlockBtn.disabled = fileLockedBy !== userId;

            unlockBtn.addEventListener('click', async () => {
                await unlockFile(file.id);
                updateFilesCell(entryId); // Aggiorna solo questa cella dopo lo sblocco
            });
            fileItem.appendChild(unlockBtn);
            
            const lockedBySpan = document.createElement('span');
            lockedBySpan.className = 'locked-by';
            lockedBySpan.textContent = `Locked by ${file.locked_by_name}`;
            fileItem.appendChild(lockedBySpan);
        } else {
            const lockBtn = document.createElement('button');
            lockBtn.className = 'lock-btn';
            const lockIcon = document.createElement('i');
            lockIcon.className = 'fas fa-lock';
            lockBtn.appendChild(lockIcon);
            lockBtn.addEventListener('click', async () => {
                await lockFile(file.id);
                updateFilesCell(entryId); // Aggiorna solo questa cella dopo il blocco
            });
            fileItem.appendChild(lockBtn);
        }
        
        fileList.appendChild(fileItem);
    });
    filesCell.appendChild(fileList);
}

// Funzione per visualizzare la cronologia del progetto
function displayProjectHistory(history) {
    const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';

    history.forEach(async entry => {
        const row = tableBody.insertRow();

        // Imposta l'attributo data-entry-id
        row.setAttribute('data-entry-id', entry.id); 

        // Inserimento delle celle di dati
        row.insertCell(0).textContent = entry.date;
        row.insertCell(1).textContent = entry.phase;
        row.insertCell(2).textContent = entry.description;
        row.insertCell(3).textContent = entry.assigned_to;
        row.insertCell(4).textContent = entry.status;

        // Cella dei file
        const filesCell = row.insertCell(5);
        const fileUploadForm = document.createElement('form');
        fileUploadForm.className = 'file-upload-form';
        fileUploadForm.innerHTML = `
            <input type="file" name="file" required>
            <input type="hidden" name="historyId" value="${entry.id}">
            <button type="submit" class="upload-btn">
                <i class="fas fa-upload"></i>
            </button>
        `;
        fileUploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(fileUploadForm);
            try {
                const response = await fetch(`/api/projects/${projectId}/files`, {
                    method: 'POST',
                    body: formData
                });
                await handleResponse(response);
                await updateFilesCell(entry.id); // Aggiorna solo la cella specifica
            } catch (error) {
                console.error('Error uploading file:', error);
            }
        });
        filesCell.appendChild(fileUploadForm);

        // Visualizza i file esistenti per questa voce di cronologia
        const files = await fetchEntryFiles(entry.id);
        const fileList = document.createElement('div');
        fileList.className = 'file-list';
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileNameSpan = document.createElement('span');
            fileNameSpan.textContent = file.filename;
            fileItem.appendChild(fileNameSpan);
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            const downloadIcon = document.createElement('i');
            downloadIcon.className = 'fas fa-download';
            downloadBtn.appendChild(downloadIcon);
            downloadBtn.addEventListener('click', () => downloadFile(file.id));
            fileItem.appendChild(downloadBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'fas fa-trash';
            deleteBtn.appendChild(deleteIcon);
            deleteBtn.addEventListener('click', async () => {
                await deleteFile(file.id);
                updateFilesCell(entry.id); // Aggiorna solo la cella dei file
            });
            fileItem.appendChild(deleteBtn);
            
            if (file.locked_by) {
                const unlockBtn = document.createElement('button');
                unlockBtn.className = 'unlock-btn';
                const unlockIcon = document.createElement('i');
                unlockIcon.className = 'fas fa-unlock';
                unlockBtn.appendChild(unlockIcon);

                const fileLockedBy = String(file.locked_by);
                const userId = String(currentUserId);
                unlockBtn.disabled = fileLockedBy !== userId;

                unlockBtn.addEventListener('click', async () => {
                    await unlockFile(file.id);
                    updateFilesCell(entry.id); // Aggiorna solo la cella dei file
                });
                fileItem.appendChild(unlockBtn);
                
                const lockedBySpan = document.createElement('span');
                lockedBySpan.className = 'locked-by';
                lockedBySpan.textContent = `Locked by ${file.locked_by_name}`;
                fileItem.appendChild(lockedBySpan);
            } else {
                const lockBtn = document.createElement('button');
                lockBtn.className = 'lock-btn';
                const lockIcon = document.createElement('i');
                lockIcon.className = 'fas fa-lock';
                lockBtn.appendChild(lockIcon);
                lockBtn.addEventListener('click', async () => {
                    await lockFile(file.id);
                    updateFilesCell(entry.id); // Aggiorna solo la cella dei file
                });
                fileItem.appendChild(lockBtn);
            }
            
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

        // Aggiungi il pulsante Set Completed
        const setCompletedBtn = document.createElement('button');
        setCompletedBtn.className = 'set-completed-btn';
        setCompletedBtn.textContent = 'Set Completed';
        setCompletedBtn.addEventListener('click', async () => {
            // Imposta il colore di sfondo neutro
            row.style.backgroundColor = '#f0f0f0';
            
            // Aggiorna il campo assigned_to a "Completed"
            const updatedEntry = {
                date: entry.date,
                phase: entry.phase,
                description: entry.description,
                assignedTo: 'Completed',
                status: entry.status
            };

            try {
                const response = await fetch(`/api/projects/${projectId}/history/${entry.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatedEntry),
                });

                if (response.ok) {
                    // Aggiorna il testo della cella assigned_to
                    row.cells[3].textContent = 'Completed';
                } else {
                    console.error('Failed to update history entry');
                }
            } catch (error) {
                console.error('Error updating history entry:', error);
            }
        });
        actionsCell.appendChild(setCompletedBtn);

        const assignedMember = teamMembers.find(member => member.name === entry.assigned_to);
        if (assignedMember) {
            row.style.backgroundColor = assignedMember.color;
        }
    });
}

// Funzione per eliminare un file
async function deleteFile(fileId) {
    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE'
        });
        await handleResponse(response);
        // Non ricaricare tutta la tabella, l'aggiornamento della cella è gestito dal chiamante
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}

// Funzione per aggiungere una nuova voce alla cronologia
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
                option.value = member.id;  // Usa l'ID come value
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

    // Aggiungi cella vuota per i file
    const filesCell = newRow.insertCell(5);
    const fileUploadForm = document.createElement('form');
    fileUploadForm.className = 'file-upload-form';
    fileUploadForm.innerHTML = `
        <input type="file" name="file" disabled>
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

// Funzione per salvare una nuova voce nella cronologia
async function saveNewHistoryEntry(projectId, row) {
    const newEntry = {
        date: row.cells[0].firstChild.value,
        phase: row.cells[1].firstChild.value,
        description: row.cells[2].firstChild.value,
        assigned_to: row.cells[3].querySelector('select').value,
        status: row.cells[4].firstChild.value
    };
    console.log('Dati della nuova voce:', newEntry);

    try {
        // Effettua la richiesta POST al server
        const response = await fetch(`/api/projects/${projectId}/history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newEntry),
        });

         if (!response.ok) {
            throw new Error(`Errore durante il salvataggio: ${response.statusText}`);
        }

        const savedEntry = await handleResponse(response);

        if (savedEntry && savedEntry.id) {
            // Ricarica l'intera tabella della cronologia per aggiornare la UI
            await fetchProjectHistory(projectId);
        } else {
            console.error('Errore: la risposta del server non contiene un ID valido.');
        }

    } catch (error) {
        console.error('Error adding history entry:', error);
    }
}

// Funzione per modificare una voce della cronologia
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
                    // Aggiorna solo i campi modificati nella riga corrente
                    for (let i = 0; i < 5; i++) {
                        cells[i].textContent = updatedEntry[Object.keys(updatedEntry)[i]];
                    }
                    // Ripristina i pulsanti di azione
                    actionsCell.innerHTML = '';
                    const editBtn = document.createElement('button');
                    editBtn.className = 'edit-btn';
                    editBtn.textContent = 'Edit';
                    editBtn.addEventListener('click', () => editHistoryEntry(entryId));
                    actionsCell.appendChild(editBtn);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-btn';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.addEventListener('click', () => confirmDelete(entryId));
                    actionsCell.appendChild(deleteBtn);

                    window.location.reload();
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

// Funzione per confermare l'eliminazione di una voce
function confirmDelete(entryId) {
    if (confirm("Are you sure you want to delete this history entry?")) {
        deleteHistoryEntry(entryId);
    }
}

// Funzione per eliminare una voce della cronologia
async function deleteHistoryEntry(entryId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history/${entryId}`, {
            method: 'DELETE',
        });

        await handleResponse(response);
        // Rimuovi solo la riga specifica invece di ricaricare tutta la tabella
        const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
        if (row) {
            row.remove();
        }
    } catch (error) {
        console.error('Error deleting history entry:', error);
    }
}

// Funzione per scaricare un file
async function downloadFile(fileId) {
    try {
        window.location.href = `/api/files/${fileId}/download`;
    } catch (error) {
        console.error('Error downloading file:', error);
    }
}

// Funzione per bloccare un file
async function lockFile(fileId) {
    try {
        const response = await fetch(`/api/files/${fileId}/lock`, {
            method: 'POST'
        });
        await handleResponse(response);
        // Non ricaricare tutta la tabella, l'aggiornamento della cella è gestito dal chiamante
    } catch (error) {
        console.error('Error locking file:', error);
    }
}

// Funzione per sbloccare un file
async function unlockFile(fileId) {
    console.log('Chiamata a unlockFile con fileId:', fileId);
    try {
        const response = await fetch(`/api/files/${fileId}/unlock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Risposta unlock:', response);
        await handleResponse(response);
        console.log('File sbloccato con successo');
        // Non ricaricare tutta la tabella, l'aggiornamento della cella è gestito dal chiamante
    } catch (error) {
        console.error('Errore durante lo sblocco del file:', error);
    }
}

// Funzione per salvare le larghezze delle colonne
function saveColumnWidths() {
    const table = document.getElementById('history-table');
    const headerCells = table.getElementsByTagName('th');
    const columnWidths = Array.from(headerCells).map(cell => cell.style.width);
    localStorage.setItem('historyColumnWidths', JSON.stringify(columnWidths));
}

// Funzione per ripristinare le larghezze delle colonne
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
    }
}

// Funzione per abilitare il ridimensionamento delle colonne
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
            saveColumnWidths();
        }

        function stopResize() {
            document.removeEventListener('mousemove', resizeColumn);
            document.removeEventListener('mouseup', stopResize);
        }
    }
}

// Funzione per abilitare l'ordinamento delle colonne
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
            sortDirection[columnIndex] = !isAscending;
            rows.forEach(row => table.getElementsByTagName('tbody')[0].appendChild(row));
        });
    }
}
