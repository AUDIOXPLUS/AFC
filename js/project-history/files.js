/**
 * Modulo per la gestione dei file nella cronologia del progetto
 * Contiene funzioni per caricare, scaricare, visualizzare e eliminare file
 */

import { handleNetworkError, handleResponse, isOnlyOfficeCompatible, normalizeFilePath } from './utils.js';

/**
 * Recupera i file associati a una voce della cronologia.
 * NOTA: Questa funzione è ancora necessaria per aggiornamenti specifici (es. dopo upload/delete)
 * ma non dovrebbe essere chiamata nel ciclo iniziale di rendering della tabella.
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
 * @param {number} entryId - L'ID della voce di cronologia a cui appartiene il file.
 * @param {HTMLElement} filesCell - La cella da aggiornare dopo l'eliminazione.
 */
export async function deleteFile(fileId, projectId, entryId, filesCell) { // Modificata firma
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
            // Non serve più trovare entryId e filesCell dal DOM
            // Aggiorna la cella direttamente chiamando updateFilesCell
            // Passiamo null come preloadedFiles per forzare il refetch
            await updateFilesCell(entryId, projectId, filesCell, null);

            // Gestisce la risposta in background (opzionale, potrebbe non essere necessaria)
            handleResponse(response).catch(error => {
                console.error('Errore nel processare la risposta di delete:', error);
            });
        } else {
            const errorText = await response.text();
            console.error(`Errore HTTP durante l'eliminazione: ${response.status} - ${errorText}`);
            throw new Error(`HTTP error: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        handleNetworkError(error);
        alert(`Failed to delete file: ${error.message}`); // Mostra errore all'utente
    }
}


/**
 * Funzione per gestire il caricamento dei file
 * @param {FileList|File[]} files - Lista di file da caricare
 * @param {HTMLElement} uploadContainer - Container dell'upload
 * @param {HTMLElement} filesCell - Cella della tabella contenente i file
 * @param {number} entryId - ID dell'entry
 * @param {number} projectId - ID del progetto
 */
async function handleFileUpload(files, uploadContainer, filesCell, entryId, projectId) {
    if (files.length === 0) return;

    // Disabilita l'input durante l'upload
    const fileInput = uploadContainer.querySelector('input[type="file"]');
    if (fileInput) fileInput.disabled = true;

    // Crea un elemento di stato per l'upload
    let statusDiv = uploadContainer.querySelector('.upload-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.className = 'upload-status';
        statusDiv.style.fontSize = '10px'; // Stile più piccolo per lo stato
        statusDiv.style.marginTop = '5px';
        uploadContainer.appendChild(statusDiv);
    }
    statusDiv.textContent = `Uploading ${files.length} file(s)...`;
    statusDiv.style.color = 'initial';

    const formData = new FormData();

    // Aggiungiamo ogni file selezionato al FormData
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    formData.append('historyId', entryId); // Assicurati che il backend usi questo

    try {
        const response = await fetch(`/api/projects/${projectId}/files`, { // Endpoint corretto per upload
            method: 'POST',
            body: formData
            // Non impostare Content-Type per FormData, il browser lo fa
        });
        const result = await handleResponse(response); // Gestisce errori HTTP
        console.log('Upload completato:', result);

        // Aggiorna la cella dei file forzando il refetch (passando null)
        await updateFilesCell(entryId, projectId, filesCell, null);

        // Rimuovi il messaggio di stato (updateFilesCell lo ricrea se necessario)
        // statusDiv.remove(); // Non necessario, updateFilesCell pulisce la cella

        // Riabilita l'input (updateFilesCell lo ricrea abilitato)
        // if (fileInput) fileInput.disabled = false; // Non necessario

    } catch (error) {
        console.error('Errore nel caricare i files:', error);
        if (statusDiv) { // Verifica se statusDiv esiste ancora
             statusDiv.textContent = 'Upload error!';
             statusDiv.style.color = 'red';
        }
        // Riabilita l'input in caso di errore (se esiste ancora)
        if (fileInput) fileInput.disabled = false;
        alert(`Error uploading files: ${error.message}`);
    }
}

/**
 * Aggiorna la cella dei file nella riga della cronologia dopo un'operazione.
 * @param {number} entryId - L'ID della voce della cronologia.
 * @param {number} projectId - L'ID del progetto.
 * @param {HTMLElement} filesCell - La cella della tabella da aggiornare.
 * @param {Array} [preloadedFiles] - Array opzionale di file precaricati.
 */
export async function updateFilesCell(entryId, projectId, filesCell, preloadedFiles = null) { // Modificata firma
    let files = [];
    // Se i file sono precaricati e sono un array, usali direttamente
    if (preloadedFiles && Array.isArray(preloadedFiles)) {
        files = preloadedFiles;
        // console.log(`Using preloaded files for entry ${entryId}:`, files); // Log opzionale
    } else {
        // Altrimenti, recupera i file come prima (utile per aggiornamenti specifici post-upload/delete)
        // console.log(`Fetching files for entry ${entryId}...`); // Log opzionale
        files = await fetchEntryFiles(entryId, projectId);
    }

    // Non è più necessario cercare la riga e la cella, vengono passate
    // const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
    // if (!row) return;
    // const filesCell = row.cells[5];

    if (!filesCell) {
        console.error(`Files cell not provided for entry ${entryId}`);
        return;
    }

    filesCell.innerHTML = ''; // Pulisce la cella prima di ricostruirla

    // Crea il container principale con display flex
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'buttons-container';
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = '5px';
    buttonsContainer.style.marginBottom = '5px'; // Ridotto margine inferiore

    // Crea il container per l'upload con supporto per drag & drop
    const uploadContainer = document.createElement('div');
    uploadContainer.className = 'file-upload-container';
    uploadContainer.style.display = 'inline-block'; // Per allineamento

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'files';
    fileInput.multiple = true;
    // fileInput.required = true; // Non necessario per un input file
    fileInput.style.display = 'none'; // Nascosto, attivato dall'icona

    const browseIcon = document.createElement('i');
    browseIcon.className = 'fas fa-folder-open';
    browseIcon.style.color = 'black';
    browseIcon.style.cursor = 'pointer';
    browseIcon.style.fontSize = '14px'; // Leggermente più grande
    browseIcon.style.padding = '3px'; // Padding per cliccabilità
    browseIcon.setAttribute('title', 'Click to browse or drag & drop files here');
    browseIcon.addEventListener('click', function() {
        fileInput.click(); // Apre la finestra di dialogo file
    });
    uploadContainer.appendChild(fileInput);
    uploadContainer.appendChild(browseIcon);

    // Aggiungi eventi per il drag and drop - rendi l'intera cella compatibile con il drop
    const setupDropEvents = (element) => {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            element.addEventListener(eventName, () => {
                browseIcon.style.color = '#007bff'; // Blu per indicare drop possibile
                filesCell.style.backgroundColor = '#e7f3ff'; // Sfondo leggero
                // filesCell.style.boxShadow = '0 0 0 2px #007bff inset'; // Forse troppo invasivo
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, () => {
                browseIcon.style.color = 'black'; // Torna al colore normale
                filesCell.style.backgroundColor = '';
                // filesCell.style.boxShadow = '';
            }, false);
        });
    };

    // Configura eventi di drag and drop sia sull'icona che sull'intera cella
    setupDropEvents(uploadContainer);
    setupDropEvents(filesCell);

    // Gestione del drop dei file (solo sulla cella per area più ampia)
    filesCell.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const droppedFiles = dt.files;

        if (droppedFiles.length > 0) {
            handleFileUpload(droppedFiles, uploadContainer, filesCell, entryId, projectId);
        }
    }, false);


    fileInput.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            handleFileUpload(this.files, uploadContainer, filesCell, entryId, projectId);
        }
    });

    buttonsContainer.appendChild(uploadContainer); // Aggiunge l'icona/input

    // Aggiungi i pulsanti "Preview All" e "Download All" solo se ci sono file
    if (files && files.length > 0) { // Verifica che files sia definito e non vuoto
        // Aggiungi il pulsante "Preview All"
        const previewAllBtn = document.createElement('button');
        previewAllBtn.className = 'preview-all-btn action-btn'; // Classe generica per stile
        previewAllBtn.innerHTML = '<i class="fas fa-eye"></i>';
        previewAllBtn.title = 'Preview All';
        // Stili inline rimossi, usare CSS se possibile
        buttonsContainer.appendChild(previewAllBtn); // Aggiunto dopo upload

        // Aggiungi il pulsante "Download All"
        const downloadAllBtn = document.createElement('button');
        downloadAllBtn.className = 'download-all-btn action-btn'; // Classe generica
        downloadAllBtn.innerHTML = '<i class="fas fa-download"></i>';
        downloadAllBtn.title = 'Download All';
        // Stili inline rimossi
        buttonsContainer.appendChild(downloadAllBtn); // Aggiunto dopo preview

        previewAllBtn.addEventListener('click', () => {
            previewAllFiles(files);
        });

        downloadAllBtn.addEventListener('click', () => {
            downloadAllFiles(files);
        });
    }


    filesCell.appendChild(buttonsContainer); // Aggiunge il container dei pulsanti/upload

    // Crea e popola la lista dei file
    const fileList = document.createElement('div');
    fileList.className = 'file-list';
    if (files && files.length > 0) { // Verifica di nuovo prima di iterare
        files.forEach(file => {
            const fileItem = createFileItem(file, projectId, entryId, filesCell); // Passa filesCell a createFileItem
            fileList.appendChild(fileItem);
        });
    }
    filesCell.appendChild(fileList); // Aggiunge la lista dei file
}

/**
 * Crea un elemento HTML per un file
 * @param {Object} file - Oggetto file con id, filename, filepath
 * @param {number} projectId - ID del progetto
 * @param {number} entryId - ID dell'entry
 * @param {HTMLElement} filesCell - La cella che contiene questo file item
 * @returns {HTMLElement} - Elemento HTML per il file
 */
function createFileItem(file, projectId, entryId, filesCell) { // Aggiunto filesCell
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item'; // Classe per stile CSS
    fileItem.style.display = 'flex'; // Usa flex per allineare elementi
    fileItem.style.alignItems = 'center';
    fileItem.style.marginBottom = '3px'; // Spazio tra i file

    const fileNameSpan = document.createElement('span');
    fileNameSpan.textContent = file.filename;
    fileNameSpan.style.cursor = 'pointer';
    fileNameSpan.style.textDecoration = 'underline';
    fileNameSpan.style.flexGrow = '1'; // Occupa spazio rimanente
    fileNameSpan.style.marginRight = '10px'; // Spazio prima dei pulsanti
    fileNameSpan.style.overflow = 'hidden'; // Gestisce nomi lunghi
    fileNameSpan.style.textOverflow = 'ellipsis';
    fileNameSpan.style.whiteSpace = 'nowrap';
    fileNameSpan.title = file.filename; // Tooltip con nome completo

    fileNameSpan.addEventListener('click', () => {
        if (isOnlyOfficeCompatible(file.filename)) {
            const normalizedPath = normalizeFilePath(file.filepath);
            // Assicurati che l'URL sia corretto e accessibile
            window.open(`http://185.250.144.219:3000/onlyoffice/editor?filePath=${encodeURIComponent(normalizedPath)}`, '_blank');
        } else {
            window.open(`/api/files/${file.id}/view`, '_blank');
        }
    });
    fileItem.appendChild(fileNameSpan);

    // Container per i pulsanti azione
    const actionButtons = document.createElement('div');
    actionButtons.style.display = 'flex';
    actionButtons.style.gap = '5px'; // Spazio tra i pulsanti

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn action-btn'; // Classe generica
    const downloadIcon = document.createElement('i');
    downloadIcon.className = 'fas fa-download';
    downloadBtn.appendChild(downloadIcon);
    downloadBtn.title = 'Download';
    downloadBtn.addEventListener('click', () => downloadFile(file.id));
    actionButtons.appendChild(downloadBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn action-btn'; // Classe generica
    deleteBtn.setAttribute('data-file-id', file.id); // Utile per debugging o selezioni
    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'fas fa-trash';
    deleteBtn.appendChild(deleteIcon);
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', async () => {
        // Passa entryId e filesCell direttamente a deleteFile
        await deleteFile(file.id, projectId, entryId, filesCell);
    });
    actionButtons.appendChild(deleteBtn);

    fileItem.appendChild(actionButtons); // Aggiunge il gruppo di pulsanti

    return fileItem;
}


/**
 * Scarica tutti i file associati a un'entry
 * @param {Array} files - Array di oggetti file
 */
async function downloadAllFiles(files) {
    if (!files || files.length === 0) return;

    // Crea un div per il messaggio di notifica
    const notificationDiv = document.createElement('div');
    notificationDiv.style.position = 'fixed';
    notificationDiv.style.bottom = '20px';
    notificationDiv.style.right = '20px';
    notificationDiv.style.padding = '15px';
    notificationDiv.style.backgroundColor = '#f0f9ff'; // Blu chiaro
    notificationDiv.style.border = '1px solid #bae6fd';
    notificationDiv.style.borderRadius = '4px';
    notificationDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    notificationDiv.style.zIndex = '1000';
    notificationDiv.style.maxWidth = '400px';
    notificationDiv.style.fontSize = '14px';
    notificationDiv.style.fontFamily = 'sans-serif';

    // Aggiungi pulsante di chiusura
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;'; // Carattere 'x'
    closeBtn.style.position = 'absolute';
    closeBtn.style.right = '5px';
    closeBtn.style.top = '5px';
    closeBtn.style.border = 'none';
    closeBtn.style.background = 'none';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = '#64748b'; // Grigio scuro
    closeBtn.onclick = () => { if (document.body.contains(notificationDiv)) document.body.removeChild(notificationDiv); };
    notificationDiv.appendChild(closeBtn);

    // Contenuto del messaggio
    const messageContent = document.createElement('div');
    messageContent.style.marginRight = '20px'; // Spazio per il pulsante chiudi
    notificationDiv.appendChild(messageContent);

    document.body.appendChild(notificationDiv);

    // Scarica i file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const link = document.createElement('a');
        link.href = `/api/files/${file.id}/download`;
        link.download = file.filename; // Il browser userà questo nome
        link.style.display = 'none'; // Non visibile
        document.body.appendChild(link);
        link.click(); // Simula il click per avviare il download
        document.body.removeChild(link); // Rimuovi il link temporaneo

        // Aggiorna il messaggio di progresso
        messageContent.innerHTML = `Downloading files... (${i + 1}/${files.length})`;

        // Aggiungi una pausa tra i download per evitare sovraccarico/blocchi
        if (i < files.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300)); // Pausa di 300ms
        }
    }

    // Mostra il messaggio di completamento
    messageContent.innerHTML = `
        Files have been downloaded to your default download folder:<br>
        (Usually <strong>Downloads</strong>)
    `;

    // Se il browser supporta l'API File System Access (molto raro e sperimentale),
    // potremmo aggiungere un pulsante per aprire la cartella, ma è meglio evitarlo per compatibilità.

    // Rimuovi la notifica dopo 10 secondi se non è già stata chiusa
    setTimeout(() => {
        if (document.body.contains(notificationDiv)) {
            document.body.removeChild(notificationDiv);
        }
    }, 10000); // 10 secondi
}

/**
 * Visualizza l'anteprima di tutti i file in una nuova finestra/tab.
 * @param {Array} files - Array di oggetti file
 */
function previewAllFiles(files) {
    if (!files || files.length === 0) return;

    // Apre una nuova finestra/tab con un HTML di base per contenere le anteprime
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
        alert("Please allow popups for this site to preview all files.");
        return;
    }

    previewWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Files Preview</title>
            <style>
                body { font-family: sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
                .preview-item { margin-bottom: 20px; border: 1px solid #ccc; background-color: #fff; padding: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                h3 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                iframe { width: 100%; height: 60vh; border: 1px solid #ddd; }
                a { color: #007bff; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <h1>Files Preview</h1>
            <div id="preview-container">Loading previews...</div>
        </body>
        </html>
    `);
    previewWindow.document.close(); // Finisce la scrittura del documento

    // Attende che il DOM della nuova finestra sia pronto
    previewWindow.onload = function() {
        const previewContainer = previewWindow.document.getElementById('preview-container');
        previewContainer.innerHTML = ''; // Pulisce il messaggio di caricamento

        files.forEach(file => {
            const itemDiv = previewWindow.document.createElement('div');
            itemDiv.className = 'preview-item';

            const title = previewWindow.document.createElement('h3');
            const fileLink = previewWindow.document.createElement('a');
            fileLink.href = `/api/files/${file.id}/view`; // Link per aprire direttamente se l'iframe fallisce
            fileLink.textContent = file.filename;
            fileLink.target = '_blank'; // Apri in nuova tab se cliccato
            title.appendChild(fileLink);
            itemDiv.appendChild(title);

            // Usa un iframe per l'anteprima (funziona per PDF, immagini, testo semplice)
            // Per altri tipi, l'utente dovrà cliccare il link sopra.
            const iframe = previewWindow.document.createElement('iframe');
            iframe.src = `/api/files/${file.id}/view`; // L'endpoint che serve il file
            iframe.title = `Preview of ${file.filename}`;
            itemDiv.appendChild(iframe);

            previewContainer.appendChild(itemDiv);
        });
    };
}
