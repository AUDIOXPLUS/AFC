/**
 * Modulo per la gestione dei file nella cronologia del progetto
 * Contiene funzioni per caricare, scaricare, visualizzare e eliminare file
 */

import { handleNetworkError, handleResponse, isOnlyOfficeCompatible, normalizeFilePath } from './utils.js';

/**
 * Recupera i file associati a una voce della cronologia.
 * @param {number} entryId - L'ID della voce della cronologia.
 * @param {number} projectId - L'ID del progetto.
 * @returns {Array} - Array di oggetti che rappresentano i file.
 */
export async function fetchEntryFiles(entryId, projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/files?historyId=${entryId}`);
        return await handleResponse(response);
    } catch (error) {
        handleNetworkError(error);
        return [];
    }
}

/**
 * Scarica un file associato a una voce della cronologia.
 * @param {number} fileId - L'ID del file da scaricare.
 */
export function downloadFile(fileId) {
    try {
        window.location.href = `/api/files/${fileId}/download`;
    } catch (error) {
        handleNetworkError(error);
    }
}

/**
 * Elimina un file associato a una voce della cronologia.
 * @param {number} fileId - L'ID del file da eliminare.
 * @param {number} projectId - L'ID del progetto.
 * @param {Function} updateCallback - Funzione di callback da chiamare dopo l'eliminazione.
 */
export async function deleteFile(fileId, projectId, updateCallback) {
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
        
        if (response.ok) {
            // Trova l'entryId dal DOM risalendo alla riga della tabella
            const fileItem = document.querySelector(`button[data-file-id="${fileId}"]`).closest('.file-item');
            const filesCell = fileItem.closest('td');
            const row = filesCell.closest('tr');
            const entryId = row.getAttribute('data-entry-id');
            
            // Esegui il callback di aggiornamento se fornito
            if (typeof updateCallback === 'function') {
                updateCallback(entryId);
            }
            
            // Gestisce la risposta in background
            handleResponse(response).catch(error => {
                console.error('Errore nel processare la risposta:', error);
            });
        } else {
            throw new Error(`HTTP error: ${response.status}`);
        }
    } catch (error) {
        handleNetworkError(error);
    }
}

/**
 * Aggiorna la cella dei file nella riga della cronologia dopo un'operazione.
 * @param {number} entryId - L'ID della voce della cronologia.
 * @param {number} projectId - L'ID del progetto.
 */
export async function updateFilesCell(entryId, projectId) {
    const files = await fetchEntryFiles(entryId, projectId);
    const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
    if (!row) return;

    const filesCell = row.cells[5];
    filesCell.innerHTML = '';

    // Crea il container principale con display flex
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = '5px';
    buttonsContainer.style.marginBottom = '10px';

    // Crea il container per l'upload
    const uploadContainer = document.createElement('div');
    uploadContainer.className = 'file-upload-container';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'files';
    fileInput.multiple = true;
    fileInput.required = true;
    fileInput.style.marginRight = '10px';
    fileInput.style.display = 'none';

    const browseIcon = document.createElement('i');
    browseIcon.className = 'fas fa-folder-open';
    browseIcon.style.color = 'black';
    browseIcon.style.cursor = 'pointer';
    browseIcon.style.fontSize = '12px';
    browseIcon.setAttribute('title', 'Upload File');
    browseIcon.addEventListener('click', function() {
        fileInput.click();
    });
    uploadContainer.appendChild(fileInput);
    uploadContainer.appendChild(browseIcon);

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
                const result = await handleResponse(response);
                console.log('Upload completato:', result);
                
                // Aggiorna solo la lista dei file
                const files = await fetchEntryFiles(entryId, projectId);
                
                // Aggiorna i pulsanti "Download All" e "Preview All"
                const buttonsContainer = filesCell.querySelector('div');
                if (buttonsContainer) {
                    // Rimuovi i vecchi pulsanti
                    while (buttonsContainer.firstChild) {
                        if (!buttonsContainer.firstChild.classList.contains('file-upload-container')) {
                            buttonsContainer.removeChild(buttonsContainer.firstChild);
                        } else {
                            break;
                        }
                    }
                    
                    // Aggiungi i nuovi pulsanti se ci sono file
                    if (files.length > 0) {
                        const downloadAllBtn = document.createElement('button');
                        downloadAllBtn.className = 'download-all-btn';
                        downloadAllBtn.innerHTML = '<i class="fas fa-download" style="color:#000;"></i>';
                        downloadAllBtn.title = 'Download All';
                        downloadAllBtn.style.alignSelf = 'center';
                        downloadAllBtn.style.height = fileInput.offsetHeight + 'px';
                        downloadAllBtn.style.padding = '0 5px';
                        downloadAllBtn.addEventListener('click', async () => {
                            await downloadAllFiles(files);
                        });
                        buttonsContainer.insertBefore(downloadAllBtn, uploadContainer);
                        
                        const previewAllBtn = document.createElement('button');
                        previewAllBtn.className = 'preview-all-btn';
                        previewAllBtn.innerHTML = '<i class="fas fa-eye" style="color: black;"></i>';
                        previewAllBtn.title = 'Preview All';
                        previewAllBtn.style.alignSelf = 'center';
                        previewAllBtn.style.height = fileInput.offsetHeight + 'px';
                        previewAllBtn.style.padding = '0 5px';
                        previewAllBtn.addEventListener('click', async () => {
                            previewAllFiles(files);
                        });
                        buttonsContainer.insertBefore(previewAllBtn, uploadContainer);
                    }
                }
                
                // Aggiorna la lista dei file
                const fileList = filesCell.querySelector('.file-list');
                if (fileList) {
                    fileList.innerHTML = '';
                    files.forEach(file => {
                        const fileItem = createFileItem(file, projectId, entryId);
                        fileList.appendChild(fileItem);
                    });
                }
                
                // Rimuovi il messaggio di stato
                statusDiv.remove();
                
                // Riabilita l'input
                this.disabled = false;
            } catch (error) {
                console.error('Errore nel caricare i files:', error);
                statusDiv.textContent = 'Errore durante il caricamento dei file';
                statusDiv.style.color = 'red';
                // Riabilita l'input in caso di errore
                this.disabled = false;
            }
        }
    });
    buttonsContainer.appendChild(uploadContainer);

    // Aggiungi i pulsanti "Preview All" e "Download All" solo se ci sono file
    if (files.length > 0) {
        // Aggiungi il pulsante "Preview All"
        const previewAllBtn = document.createElement('button');
        previewAllBtn.className = 'preview-all-btn';
        previewAllBtn.innerHTML = '<i class="fas fa-eye" style="color: black;"></i>';
        previewAllBtn.title = 'Preview All';
        previewAllBtn.style.alignSelf = 'center';
        previewAllBtn.style.height = fileInput.offsetHeight + 'px';
        previewAllBtn.style.padding = '0 5px';
        buttonsContainer.insertBefore(previewAllBtn, uploadContainer);
        
        // Aggiungi il pulsante "Download All"
        const downloadAllBtn = document.createElement('button');
        downloadAllBtn.className = 'download-all-btn';
        downloadAllBtn.innerHTML = '<i class="fas fa-download" style="color:#000;"></i>';
        downloadAllBtn.title = 'Download All';
        downloadAllBtn.style.alignSelf = 'center';
        downloadAllBtn.style.height = fileInput.offsetHeight + 'px';
        downloadAllBtn.style.padding = '0 5px';
        buttonsContainer.insertBefore(downloadAllBtn, uploadContainer);

        previewAllBtn.addEventListener('click', () => {
            previewAllFiles(files);
        });

        downloadAllBtn.addEventListener('click', () => {
            downloadAllFiles(files);
        });
    }

    filesCell.appendChild(buttonsContainer);

    const fileList = document.createElement('div');
    fileList.className = 'file-list';
    files.forEach(file => {
        const fileItem = createFileItem(file, projectId, entryId);
        fileList.appendChild(fileItem);
    });
    filesCell.appendChild(fileList);
}

/**
 * Crea un elemento HTML per un file
 * @param {Object} file - Oggetto file con id, filename, filepath
 * @param {number} projectId - ID del progetto
 * @param {number} entryId - ID dell'entry
 * @returns {HTMLElement} - Elemento HTML per il file
 */
function createFileItem(file, projectId, entryId) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const fileNameSpan = document.createElement('span');
    fileNameSpan.textContent = file.filename;
    fileNameSpan.style.cursor = 'pointer';
    fileNameSpan.style.textDecoration = 'underline';
    fileNameSpan.addEventListener('click', () => {
        if (isOnlyOfficeCompatible(file.filename)) {
            const normalizedPath = normalizeFilePath(file.filepath);
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
    downloadBtn.addEventListener('click', () => downloadFile(file.id));
    fileItem.appendChild(downloadBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('data-file-id', file.id);
    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'fas fa-trash';
    deleteBtn.appendChild(deleteIcon);
    deleteBtn.addEventListener('click', async () => {
        await deleteFile(file.id, projectId, (entryId) => {
            updateFilesCell(entryId, projectId);
        });
    });
    fileItem.appendChild(deleteBtn);
    
    return fileItem;
}

/**
 * Scarica tutti i file associati a un'entry
 * @param {Array} files - Array di oggetti file
 */
async function downloadAllFiles(files) {
    // Crea un div per il messaggio di notifica
    const notificationDiv = document.createElement('div');
    notificationDiv.style.position = 'fixed';
    notificationDiv.style.bottom = '20px';
    notificationDiv.style.right = '20px';
    notificationDiv.style.padding = '15px';
    notificationDiv.style.backgroundColor = '#f0f9ff';
    notificationDiv.style.border = '1px solid #bae6fd';
    notificationDiv.style.borderRadius = '4px';
    notificationDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    notificationDiv.style.zIndex = '1000';
    notificationDiv.style.maxWidth = '400px';

    // Aggiungi pulsante di chiusura
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.position = 'absolute';
    closeBtn.style.right = '5px';
    closeBtn.style.top = '5px';
    closeBtn.style.border = 'none';
    closeBtn.style.background = 'none';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = '#64748b';
    closeBtn.onclick = () => document.body.removeChild(notificationDiv);
    notificationDiv.appendChild(closeBtn);

    document.body.appendChild(notificationDiv);

    // Scarica i file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const link = document.createElement('a');
        link.href = `/api/files/${file.id}/download`;
        link.download = file.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Aggiorna il messaggio di progresso
        notificationDiv.innerHTML = `
            <button style="position: absolute; right: 5px; top: 5px; border: none; background: none; font-size: 20px; cursor: pointer; color: #64748b;" onclick="this.parentElement.remove()">&times;</button>
            <div style="margin-right: 20px">
                Downloading files... (${i + 1}/${files.length})
            </div>
        `;
        
        // Aggiungi una pausa tra i download
        if (i < files.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Mostra il messaggio di completamento
    notificationDiv.innerHTML = `
        <button style="position: absolute; right: 5px; top: 5px; border: none; background: none; font-size: 20px; cursor: pointer; color: #64748b;" onclick="this.parentElement.remove()">&times;</button>
        <div style="margin-right: 20px">
            Files have been downloaded to your default download folder:<br>
            <strong>Downloads</strong>
        </div>
    `;

    // Se il browser supporta l'API File System Access, aggiungi il pulsante per aprire la cartella
    if ('showDirectoryPicker' in window) {
        const openFolderBtn = document.createElement('button');
        openFolderBtn.textContent = 'Open Download Folder';
        openFolderBtn.style.marginTop = '10px';
        openFolderBtn.style.padding = '5px 10px';
        openFolderBtn.style.backgroundColor = '#0ea5e9';
        openFolderBtn.style.color = 'white';
        openFolderBtn.style.border = 'none';
        openFolderBtn.style.borderRadius = '4px';
        openFolderBtn.style.cursor = 'pointer';
        openFolderBtn.addEventListener('click', async () => {
            try {
                const dirHandle = await window.showDirectoryPicker();
                // Il browser ha già aperto la cartella selezionata
            } catch (err) {
                console.error('Error opening folder:', err);
            }
        });
        notificationDiv.appendChild(openFolderBtn);
    }

    // Rimuovi la notifica dopo 10 secondi se non è già stata chiusa
    setTimeout(() => {
        if (document.body.contains(notificationDiv)) {
            document.body.removeChild(notificationDiv);
        }
    }, 10000);
}

/**
 * Visualizza l'anteprima di tutti i file
 * @param {Array} files - Array di oggetti file
 */
function previewAllFiles(files) {
    const previewWindow = window.open('all-files-preview.html', '_blank');
    previewWindow.onload = function() {
        const previewContainer = previewWindow.document.getElementById('preview-container');
        files.forEach(file => {
            const iframe = document.createElement('iframe');
            iframe.src = `/api/files/${file.id}/view`;
            iframe.style.width = '100%';
            iframe.style.height = '500px';
            iframe.style.border = 'none';
            previewContainer.appendChild(iframe);
        });
    };
}
