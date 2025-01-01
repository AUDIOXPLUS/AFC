// Variabile globale per mantenere il riferimento alle funzioni di filtering
let filteringApi = null;


// Funzioni per la gestione della cronologia del progetto

/**
 * Verifica se un file è compatibile con OnlyOffice
 * @param {string} filename - Nome del file da verificare
 * @returns {boolean} - true se il file è compatibile, false altrimenti
 */
window.isOnlyOfficeCompatible = function(filename) {
    const supportedExtensions = [
        '.docx', '.doc', '.odt', '.rtf', '.txt',
        '.xlsx', '.xls', '.ods',
        '.pptx', '.ppt', '.odp'
    ];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return supportedExtensions.includes(extension);
};

/**
 * Normalizza il percorso del file per l'URL di OnlyOffice
 * @param {string} filepath - Percorso completo del file
 * @returns {string} - Percorso normalizzato
 */
window.normalizeFilePath = function(filepath) {
    // Trova l'indice di 'uploads' nel percorso
    const uploadsIndex = filepath.indexOf('uploads');
    if (uploadsIndex === -1) return filepath;
    
    // Prendi la parte del percorso dopo 'uploads'
    const relativePath = filepath.slice(uploadsIndex);
    
    // Sostituisci tutti i backslash con forward slash
    return relativePath.split('\\').join('/');
};

/**
 * Recupera la cronologia del progetto e la ordina per data in ordine decrescente.
 * @param {number} projectId - L'ID del progetto.
 */
window.fetchProjectHistory = async function(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history?includeUserName=true`);
        const history = await window.handleResponse(response);
        // Ordina la cronologia per data in ordine decrescente
        history.sort((a, b) => new Date(b.date) - new Date(a.date));
        console.log('Cronologia del Progetto:', history);
        window.displayProjectHistory(history);
    } catch (error) {
        console.error('Errore nel recuperare la cronologia del progetto:', error);
    }
};

/**
 * Visualizza la cronologia del progetto nella tabella HTML.
 * @param {Array} history - Array di oggetti che rappresentano le voci della cronologia.
 */
window.displayProjectHistory = function(history) {
    const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';

    history.forEach(async entry => {
        const row = tableBody.insertRow();
        row.setAttribute('data-entry-id', entry.id);

        // Inserisce le celle della tabella con i dati della cronologia
        row.insertCell(0).textContent = entry.date;
        row.insertCell(1).textContent = entry.phase;
        // Crea una cella per la descrizione
        const descCell = row.insertCell(2);
        
        // Funzione per convertire URL in link cliccabili
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const description = entry.description;
        
        if (urlRegex.test(description)) {
            // Se ci sono URL nel testo, li convertiamo in link
            const parts = description.split(urlRegex);
            parts.forEach((part, index) => {
                if (urlRegex.test(part)) {
                    // Se è un URL, crea un link
                    const link = document.createElement('a');
                    link.href = part;
                    link.textContent = part;
                    link.target = '_blank'; // Apre in una nuova tab
                    descCell.appendChild(link);
                } else {
                    // Se è testo normale, aggiungilo come nodo di testo
                    descCell.appendChild(document.createTextNode(part));
                }
            });
        } else {
            // Se non ci sono URL, mostra il testo normalmente
            descCell.textContent = description;
        }
        row.insertCell(3).textContent = entry.assigned_to;
        row.insertCell(4).textContent = entry.status;

        // Gestisce la cella dei file associati alla voce della cronologia
        const filesCell = row.insertCell(5);
        const uploadContainer = document.createElement('div');
        uploadContainer.className = 'file-upload-container';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.name = 'files';
        fileInput.multiple = true;
        fileInput.required = true;
        fileInput.addEventListener('change', async function(e) {
            if (this.files.length > 0) {
                // Disabilita l'input durante l'upload
                this.disabled = true;
                
                // Crea un elemento di stato per l'upload
                const statusDiv = document.createElement('div');
                statusDiv.className = 'upload-status';
                statusDiv.textContent = `Caricamento ${this.files.length} file in corso...`;
                uploadContainer.appendChild(statusDiv);

                const formData = new FormData();
                
                // Aggiungiamo ogni file selezionato al FormData
                for (let i = 0; i < this.files.length; i++) {
                    formData.append('files', this.files[i]);
                }
                formData.append('historyId', entry.id);

                try {
                    const response = await fetch(`/api/projects/${projectId}/files`, {
                        method: 'POST',
                        body: formData
                    });
                    const result = await window.handleResponse(response);
                    console.log('Upload completato:', result);
                    window.updateFilesCell(entry.id);
                } catch (error) {
                    console.error('Errore nel caricare i files:', error);
                    statusDiv.textContent = 'Errore durante il caricamento dei file';
                    statusDiv.style.color = 'red';
                    // Riabilita l'input in caso di errore
                    this.disabled = false;
                }
            }
        });
        uploadContainer.appendChild(fileInput);
        filesCell.appendChild(uploadContainer);

        // Recupera e visualizza i file associati alla voce della cronologia
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
                if (window.isOnlyOfficeCompatible(file.filename)) {
                    const normalizedPath = window.normalizeFilePath(file.filepath);
                    //window.open(`http://localhost:3000/onlyoffice/editor?filePath=${normalizedPath}`, '_blank');
                    window.open(`http://185.250.144.219:3000/onlyoffice/editor?filePath=${normalizedPath}`, '_blank');
                } else {
                    window.open(`/api/files/${file.id}/view`, '_blank');
                }
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
            deleteBtn.setAttribute('data-file-id', file.id);
            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'fas fa-trash';
            deleteBtn.appendChild(deleteIcon);
            deleteBtn.addEventListener('click', async () => {
                await window.deleteFile(file.id);
                window.updateFilesCell(entry.id);
            });
            fileItem.appendChild(deleteBtn);
            
            // Gestisce il blocco e lo sblocco dei file
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
                lockBtn.setAttribute('data-file-id', file.id);
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

        // Gestisce le azioni della riga della cronologia
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
        setCompletedBtn.textContent = 'Completed';
        setCompletedBtn.addEventListener('click', async () => {
            const updatedEntry = {
                date: entry.date,
                phase: entry.phase,
                description: entry.description,
                assignedTo: entry.assigned_to,
                status: 'Completed'
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
                    window.location.reload();
                } else {
                    console.error('Errore nell\'aggiornare la voce della cronologia');
                }
            } catch (error) {
                console.error('Errore durante l\'aggiornamento della voce della cronologia:', error);
            }
        });
        actionsCell.appendChild(setCompletedBtn);

        // Imposta il colore di sfondo basato sullo stato o sul membro assegnato
        if (entry.status === 'Completed') {
            row.style.backgroundColor = '#f0f0f0';
        } else {
            const assignedMember = window.teamMembers.find(member => member.name === entry.assigned_to);
            if (assignedMember) {
                row.style.backgroundColor = assignedMember.color;
            }
        }

        // Riapplica i filtri dopo aver aggiunto la riga
        if (filteringApi && typeof filteringApi.applyFilters === 'function') {
            filteringApi.applyFilters();
        }
    });
};

/**
 * Recupera i file associati a una voce della cronologia.
 * @param {number} entryId - L'ID della voce della cronologia.
 * @returns {Array} - Array di oggetti che rappresentano i file.
 */
window.fetchEntryFiles = async function(entryId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/files?historyId=${entryId}`);
        return await window.handleResponse(response);
    } catch (error) {
        console.error('Errore nel recuperare i file:', error);
        return [];
    }
};

/**
 * Aggiorna la cella dei file nella riga della cronologia dopo un'operazione.
 * @param {number} entryId - L'ID della voce della cronologia.
 */
window.updateFilesCell = async function(entryId) {
    const files = await window.fetchEntryFiles(entryId);
    const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
    if (!row) return;

    const filesCell = row.cells[5];
    filesCell.innerHTML = '';

    const uploadContainer = document.createElement('div');
    uploadContainer.className = 'file-upload-container';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'files';
    fileInput.multiple = true;
    fileInput.required = true;
    fileInput.addEventListener('change', async function(e) {
        if (this.files.length > 0) {
            // Disabilita l'input durante l'upload
            this.disabled = true;
            
            // Crea un elemento di stato per l'upload
            const statusDiv = document.createElement('div');
            statusDiv.className = 'upload-status';
            statusDiv.textContent = `Caricamento ${this.files.length} file in corso...`;
            uploadContainer.appendChild(statusDiv);

            const formData = new FormData();
            
            // Aggiungiamo ogni file selezionato al FormData
            for (let i = 0; i < this.files.length; i++) {
                formData.append('files', this.files[i]);
            }
            formData.append('historyId', entryId);

            try {
                const response = await fetch(`/api/projects/${projectId}/files`, {
                    method: 'POST',
                    body: formData
                });
                const result = await window.handleResponse(response);
                console.log('Upload completato:', result);
                window.updateFilesCell(entryId);
            } catch (error) {
                console.error('Errore nel caricare i files:', error);
                statusDiv.textContent = 'Errore durante il caricamento dei file';
                statusDiv.style.color = 'red';
                // Riabilita l'input in caso di errore
                this.disabled = false;
            }
        }
    });
    uploadContainer.appendChild(fileInput);
    filesCell.appendChild(uploadContainer);

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
            if (window.isOnlyOfficeCompatible(file.filename)) {
                const normalizedPath = window.normalizeFilePath(file.filepath);
                //window.open(`http://localhost:3000/onlyoffice/editor?filePath=${normalizedPath}`, '_blank');
                window.open(`http://185.250.144.219:3000/onlyoffice/editor?filePath=${normalizedPath}`, '_blank');
            } else {
                window.open(`/api/files/${file.id}/view`, '_blank');
            }
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
        deleteBtn.setAttribute('data-file-id', file.id);
        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'fas fa-trash';
        deleteBtn.appendChild(deleteIcon);
        deleteBtn.addEventListener('click', async () => {
            await window.deleteFile(file.id);
            window.updateFilesCell(entryId);
        });
        fileItem.appendChild(deleteBtn);
        
        // Gestisce il blocco e lo sblocco dei file
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

/**
 * Apre il modulo per aggiungere una nuova voce alla cronologia del progetto.
 * @param {number} projectId - L'ID del progetto.
 */
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
            // Imposta automaticamente la data odierna
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            input.value = `${year}-${month}-${day}`;
            cell.appendChild(input);
        } else if (field === 'description') {
            const textarea = document.createElement('textarea');
            textarea.name = field;
            textarea.style.backgroundColor = '#ffff99';
            textarea.style.width = '100%';
            textarea.style.minHeight = '100px';
            textarea.style.resize = 'vertical';
            cell.appendChild(textarea);
        } else if (field === 'status') {
            const select = document.createElement('select');
            select.style.backgroundColor = '#ffff99';
            ['In Progress', 'Completed', 'On Hold', 'Archived'].forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                select.appendChild(option);
            });
            cell.appendChild(select);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = field;
            input.style.backgroundColor = '#ffff99';
            cell.appendChild(input);
        }
    });

    const filesCell = newRow.insertCell(5);
    const uploadContainer = document.createElement('div');
    uploadContainer.className = 'file-upload-container';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'files';
    fileInput.multiple = true;
    fileInput.disabled = true;
    
    const uploadNote = document.createElement('span');
    uploadNote.className = 'upload-note';
    uploadNote.textContent = 'Save entry first to upload files';
    
    uploadContainer.appendChild(fileInput);
    uploadContainer.appendChild(uploadNote);
    filesCell.appendChild(uploadContainer);

    const actionsCell = newRow.insertCell(6);
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => window.saveNewHistoryEntry(projectId, newRow));
    actionsCell.appendChild(saveBtn);
};

/**
 * Salva una nuova voce nella cronologia del progetto.
 * @param {number} projectId - L'ID del progetto.
 * @param {HTMLTableRowElement} row - La riga della tabella che contiene i dati della nuova voce.
 */
window.saveNewHistoryEntry = async function(projectId, row) {
    const newEntry = {
        date: row.cells[0].firstChild.value,
        phase: row.cells[1].firstChild.value,
        description: row.cells[2].firstChild.value,
        assigned_to: row.cells[3].querySelector('select').value,
        status: row.cells[4].querySelector('select').value
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
        console.error('Errore nell\'aggiungere la voce della cronologia:', error);
    }
};

/**
 * Apre il modulo per modificare una voce esistente nella cronologia del progetto.
 * @param {number} entryId - L'ID della voce della cronologia da modificare.
 */
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
            if (i === 3) { // Campo 'assigned_to'
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
            } else if (i === 4) { // Campo 'status'
                input = document.createElement('select');
                ['In Progress', 'Completed', 'On Hold', 'Archived'].forEach(status => {
                    const option = document.createElement('option');
                    option.value = status;
                    option.textContent = status;
                    if (status === historyData.status) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else if (i === 2) { // Campo 'description'
                // Per il campo description, manteniamo il testo originale inclusi i link
                input = document.createElement('textarea');
                // Otteniamo il testo originale dalla cella, che potrebbe contenere link HTML
                const descriptionText = cells[2].textContent || cells[2].innerText;
                input.value = descriptionText;
                input.style.width = '100%';
                input.style.minHeight = '100px';
                input.style.resize = 'vertical';
            } else { // Campi 'date', 'phase'
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
                    console.error('Errore nell\'aggiornare la voce della cronologia');
                }
            } catch (error) {
                console.error('Errore durante l\'aggiornamento della voce della cronologia:', error);
            }
        });
        actionsCell.appendChild(saveBtn);
    } else {
        console.error('Row non trovata per entryId:', entryId);
    }
};

/**
 * Conferma l'eliminazione di una voce della cronologia.
 * @param {number} entryId - L'ID della voce della cronologia da eliminare.
 */
window.confirmDelete = function(entryId) {
    if (confirm("Are you sure you want to delete this history entry?")) {
        window.deleteHistoryEntry(entryId);
    }
};

/**
 * Elimina una voce della cronologia del progetto.
 * @param {number} entryId - L'ID della voce della cronologia da eliminare.
 */
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
        console.error('Errore nell\'eliminare la voce della cronologia:', error);
    }
};

/**
 * Scarica un file associato a una voce della cronologia.
 * @param {number} fileId - L'ID del file da scaricare.
 */
window.downloadFile = function(fileId) {
    try {
        window.location.href = `/api/files/${fileId}/download`;
    } catch (error) {
        console.error('Errore nel scaricare il file:', error);
    }
};

/**
 * Blocca un file per prevenire modifiche simultanee.
 * @param {number} fileId - L'ID del file da bloccare.
 */
window.lockFile = async function(fileId) {
    try {
        const response = await fetch(`/api/files/${fileId}/lock`, {
            method: 'POST'
        });
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        await window.handleResponse(response);
        // Trova l'entryId dal DOM risalendo alla riga della tabella
        const fileItem = document.querySelector(`button[data-file-id="${fileId}"]`).closest('.file-item');
        const filesCell = fileItem.closest('td');
        const row = filesCell.closest('tr');
        const entryId = row.getAttribute('data-entry-id');
        window.updateFilesCell(entryId);
    } catch (error) {
        console.error('Errore nel bloccare il file:', error);
    }
};

/**
 * Sblocca un file precedentemente bloccato.
 * @param {number} fileId - L'ID del file da sbloccare.
 */
window.unlockFile = async function(fileId) {
    console.log('Chiamata a unlockFile con fileId:', fileId);
    try {
        const response = await fetch(`/api/files/${fileId}/unlock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        await window.handleResponse(response);
        // Trova l'entryId dal DOM risalendo alla riga della tabella
        const fileItem = document.querySelector(`button[data-file-id="${fileId}"]`).closest('.file-item');
        const filesCell = fileItem.closest('td');
        const row = filesCell.closest('tr');
        const entryId = row.getAttribute('data-entry-id');
        window.updateFilesCell(entryId);
    } catch (error) {
        console.error('Errore durante lo sblocco del file:', error);
    }
};

/**
 * Elimina un file associato a una voce della cronologia.
 * @param {number} fileId - L'ID del file da eliminare.
 */
window.deleteFile = async function(fileId) {
    if (!confirm("Are you sure you want to delete this file?")) {
        return;
    }

    try {
        const response = await fetch(`/api/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        await window.handleResponse(response);
        // Trova l'entryId dal DOM risalendo alla riga della tabella
        const fileItem = document.querySelector(`button[data-file-id="${fileId}"]`).closest('.file-item');
        const filesCell = fileItem.closest('td');
        const row = filesCell.closest('tr');
        const entryId = row.getAttribute('data-entry-id');
        window.updateFilesCell(entryId);
    } catch (error) {
        console.error('Errore nell\'eliminare il file:', error);
    }
};
