// Funzioni per la gestione della cronologia del progetto

window.fetchProjectHistory = async function(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history?includeUserName=true`);
        const history = await window.handleResponse(response);
        console.log('Project History:', history);
        window.displayProjectHistory(history);
    } catch (error) {
        console.error('Error fetching project history:', error);
    }
};

window.displayProjectHistory = function(history) {
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
                await window.handleResponse(response);
                await window.updateFilesCell(entry.id);
            } catch (error) {
                console.error('Error uploading file:', error);
            }
        });
        filesCell.appendChild(fileUploadForm);

        const files = await window.fetchEntryFiles(entry.id);
        const fileList = document.createElement('div');
        fileList.className = 'file-list';
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileNameSpan = document.createElement('span');
            fileNameSpan.textContent = file.filename;
            fileNameSpan.style.cursor = 'pointer';
            fileNameSpan.style.textDecoration = 'underline';
            fileNameSpan.addEventListener('click', () => {
                window.open(`/api/files/${file.id}/view`, '_blank');
            });
            fileItem.appendChild(fileNameSpan);
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            const downloadIcon = document.createElement('i');
            downloadIcon.className = 'fas fa-download';
            downloadBtn.appendChild(downloadIcon);
            downloadBtn.addEventListener('click', () => window.downloadFile(file.id));
            fileItem.appendChild(downloadBtn);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'fas fa-trash';
            deleteBtn.appendChild(deleteIcon);
            deleteBtn.addEventListener('click', async () => {
                await window.deleteFile(file.id);
                window.updateFilesCell(entry.id);
            });
            fileItem.appendChild(deleteBtn);
            
            if (file.locked_by) {
                const unlockBtn = document.createElement('button');
                unlockBtn.className = 'unlock-btn';
                const unlockIcon = document.createElement('i');
                unlockIcon.className = 'fas fa-unlock';
                unlockBtn.appendChild(unlockIcon);

                const fileLockedBy = String(file.locked_by);
                const userId = String(window.currentUserId);
                unlockBtn.disabled = fileLockedBy !== userId;

                unlockBtn.addEventListener('click', async () => {
                    await window.unlockFile(file.id);
                    window.updateFilesCell(entry.id);
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
                    await window.lockFile(file.id);
                    window.updateFilesCell(entry.id);
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
        editBtn.addEventListener('click', () => window.editHistoryEntry(entry.id));
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => window.confirmDelete(entry.id));
        actionsCell.appendChild(deleteBtn);

        const setCompletedBtn = document.createElement('button');
        setCompletedBtn.className = 'set-completed-btn';
        setCompletedBtn.textContent = 'Set Completed';
        setCompletedBtn.addEventListener('click', async () => {
            row.style.backgroundColor = '#f0f0f0';
            
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
                    row.cells[3].textContent = 'Completed';
                } else {
                    console.error('Failed to update history entry');
                }
            } catch (error) {
                console.error('Error updating history entry:', error);
            }
        });
        actionsCell.appendChild(setCompletedBtn);

        const assignedMember = window.teamMembers.find(member => member.name === entry.assigned_to);
        if (assignedMember) {
            row.style.backgroundColor = assignedMember.color;
        }
    });
};

window.fetchEntryFiles = async function(entryId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/files?historyId=${entryId}`);
        return await window.handleResponse(response);
    } catch (error) {
        console.error('Error fetching files:', error);
        return [];
    }
};

window.updateFilesCell = async function(entryId) {
    const files = await window.fetchEntryFiles(entryId);
    const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
    if (!row) return;

    const filesCell = row.cells[5];
    filesCell.innerHTML = '';

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
            await window.handleResponse(response);
            window.updateFilesCell(entryId);
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    });
    filesCell.appendChild(fileUploadForm);

    const fileList = document.createElement('div');
    fileList.className = 'file-list';
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileNameSpan = document.createElement('span');
        fileNameSpan.textContent = file.filename;
        fileNameSpan.style.cursor = 'pointer';
        fileNameSpan.style.textDecoration = 'underline';
        fileNameSpan.addEventListener('click', () => {
            window.open(`/api/files/${file.id}/view`, '_blank');
        });
        fileItem.appendChild(fileNameSpan);
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        const downloadIcon = document.createElement('i');
        downloadIcon.className = 'fas fa-download';
        downloadBtn.appendChild(downloadIcon);
        downloadBtn.addEventListener('click', () => window.downloadFile(file.id));
        fileItem.appendChild(downloadBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'fas fa-trash';
        deleteBtn.appendChild(deleteIcon);
        deleteBtn.addEventListener('click', async () => {
            await window.deleteFile(file.id);
            window.updateFilesCell(entryId);
        });
        fileItem.appendChild(deleteBtn);
        
        if (file.locked_by) {
            const unlockBtn = document.createElement('button');
            unlockBtn.className = 'unlock-btn';
            const unlockIcon = document.createElement('i');
            unlockIcon.className = 'fas fa-unlock';
            unlockBtn.appendChild(unlockIcon);

            const fileLockedBy = String(file.locked_by);
            const userId = String(window.currentUserId);
            unlockBtn.disabled = fileLockedBy !== userId;

            unlockBtn.addEventListener('click', async () => {
                await window.unlockFile(file.id);
                window.updateFilesCell(entryId);
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
                await window.lockFile(file.id);
                window.updateFilesCell(entryId);
            });
            fileItem.appendChild(lockBtn);
        }
        
        fileList.appendChild(fileItem);
    });
    filesCell.appendChild(fileList);
};

window.addHistoryEntry = function(projectId) {
    const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0);

    const fields = ['date', 'phase', 'description', 'assigned_to', 'status'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        if (field === 'assigned_to') {
            const select = document.createElement('select');
            window.teamMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
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
        } else if (field === 'description') {
            const textarea = document.createElement('textarea');
            textarea.name = field;
            textarea.style.backgroundColor = '#ffff99';
            textarea.style.width = '100%';
            textarea.style.minHeight = '100px';
            textarea.style.resize = 'vertical';
            cell.appendChild(textarea);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = field;
            input.style.backgroundColor = '#ffff99';
            cell.appendChild(input);
        }
    });

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
    saveBtn.addEventListener('click', () => window.saveNewHistoryEntry(projectId, newRow));
    actionsCell.appendChild(saveBtn);
};

window.saveNewHistoryEntry = async function(projectId, row) {
    const newEntry = {
        date: row.cells[0].firstChild.value,
        phase: row.cells[1].firstChild.value,
        description: row.cells[2].firstChild.value,
        assigned_to: row.cells[3].querySelector('select').value,
        status: row.cells[4].firstChild.value
    };
    console.log('Dati della nuova voce:', newEntry);

    try {
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

        const savedEntry = await window.handleResponse(response);

        if (savedEntry && savedEntry.id) {
            await window.fetchProjectHistory(projectId);
        } else {
            console.error('Errore: la risposta del server non contiene un ID valido.');
        }

    } catch (error) {
        console.error('Error adding history entry:', error);
    }
};

window.editHistoryEntry = function(entryId) {
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
                window.teamMembers.forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.name;
                    option.textContent = member.name;
                    if (member.name === historyData.assigned_to) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else if (i === 2) {
                input = document.createElement('textarea');
                input.value = historyData.description;
                input.style.width = '100%';
                input.style.minHeight = '100px';
                input.style.resize = 'vertical';
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
                    for (let i = 0; i < 5; i++) {
                        cells[i].textContent = updatedEntry[Object.keys(updatedEntry)[i]];
                    }
                    actionsCell.innerHTML = '';
                    const editBtn = document.createElement('button');
                    editBtn.className = 'edit-btn';
                    editBtn.textContent = 'Edit';
                    editBtn.addEventListener('click', () => window.editHistoryEntry(entryId));
                    actionsCell.appendChild(editBtn);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-btn';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.addEventListener('click', () => window.confirmDelete(entryId));
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
};

window.confirmDelete = function(entryId) {
    if (confirm("Are you sure you want to delete this history entry?")) {
        window.deleteHistoryEntry(entryId);
    }
};

window.deleteHistoryEntry = async function(entryId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history/${entryId}`, {
            method: 'DELETE',
        });

        await window.handleResponse(response);
        const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
        if (row) {
            row.remove();
        }
    } catch (error) {
        console.error('Error deleting history entry:', error);
    }
};

window.downloadFile = function(fileId) {
    try {
        window.location.href = `/api/files/${fileId}/download`;
    } catch (error) {
        console.error('Error downloading file:', error);
    }
};

window.lockFile = async function(fileId) {
    try {
        const response = await fetch(`/api/files/${fileId}/lock`, {
            method: 'POST'
        });
        await window.handleResponse(response);
    } catch (error) {
        console.error('Error locking file:', error);
    }
};

window.unlockFile = async function(fileId) {
    console.log('Chiamata a unlockFile con fileId:', fileId);
    try {
        const response = await fetch(`/api/files/${fileId}/unlock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Risposta unlock:', response);
        await window.handleResponse(response);
        console.log('File sbloccato con successo');
    } catch (error) {
        console.error('Errore durante lo sblocco del file:', error);
    }
};

window.deleteFile = async function(fileId) {
    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE'
        });
        await window.handleResponse(response);
    } catch (error) {
        console.error('Error deleting file:', error);
    }
};
