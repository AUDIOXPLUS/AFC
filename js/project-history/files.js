/**
 * Modulo per la gestione dei file nella cronologia del progetto
 * Contiene funzioni per caricare, scaricare, visualizzare e eliminare file
 */

import { handleNetworkError, handleResponse, isOnlyOfficeCompatible, isStepFile, normalizeFilePath } from './utils.js';

/**
 * Analizza il contenuto di un file per determinare il tipo di dati e l'indice di inizio dei dati numerici
 * @param {string} content - Contenuto del file
 * @returns {Object} - Oggetto con dataType ('db', 'ohm', 'unknown') e startIndex
 */
function analyzeFileContent(content) {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let dataType = 'unknown';
    let startIndex = 0;

    // Analizza le prime righe per determinare il tipo di dati e l'inizio dei dati numerici
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const originalLine = lines[i];
        const lineForCheck = originalLine.toLowerCase();
        
        // Cerca "db" o "ohm" per determinare il tipo di dati
        if (lineForCheck.includes('db')) {
            dataType = 'db';
        } else if (lineForCheck.includes('ohm') || lineForCheck.includes('impedance')) {
            dataType = 'ohm';
        }

        // Logica per rilevare l'header e trovare startIndex
        if (lineForCheck.includes('[') || lineForCheck.includes(']') || 
            lineForCheck.includes('freq') || 
            lineForCheck.includes('phase') || 
            lineForCheck.includes('hz') ||
            dataType !== 'unknown' ||
            /^[a-zA-Z]/.test(originalLine)) {
            
            startIndex = i + 1;
        } else {
            // Controlla se la riga contiene dati numerici validi
            const parts = originalLine.split(/[\s,;\t]+/).filter(p => p.length > 0);
            const numericParts = parts.filter(p => !isNaN(parseFloat(p)) && isFinite(parseFloat(p)));
            
            if (numericParts.length >= 2 && numericParts.length === parts.length) {
                if (startIndex <= i) {
                   startIndex = i;
                }
                break;
            } else {
                startIndex = i + 1;
            }
        }
    }
    
    console.log(`[File Analysis] Tipo di dati rilevato: ${dataType}, Inizio dati alla riga: ${startIndex} (0-indexed)`);
    return { dataType, startIndex };
}

/**
 * Estrae i punti dati da un contenuto di file
 * @param {string} content - Contenuto del file
 * @param {number} startIndex - Indice di inizio dei dati numerici
 * @returns {Array} - Array di punti {x, y}
 */
function extractDataPoints(content, startIndex) {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const points = [];
    
    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        
        // Salta righe vuote o commenti
        if (!line || line.startsWith('#') || line.startsWith('//')) {
            continue;
        }
        
        // Dividi usando diversi separatori possibili
        const parts = line.split(/[\s,;\t]+/).filter(p => p.length > 0);
        
        if (parts.length >= 2) {
            const x = parseFloat(parts[0]);
            const y = parseFloat(parts[1]);
            
            if (!isNaN(x) && isFinite(x) && !isNaN(y) && isFinite(y)) {
                points.push({ x, y });
            }
        }
    }
    
    return points;
}

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
 * Funzione per gestire il caricamento dei file
 * @param {FileList|File[]} files - Lista di file da caricare
 * @param {HTMLElement} uploadContainer - Container dell'upload
 * @param {HTMLElement} filesCell - Cella della tabella contenente i file
 * @param {number} entryId - ID dell'entry
 * @param {number} projectId - ID del progetto
 */
// Esporta la funzione per usarla in entries.js
export async function handleFileUpload(files, uploadContainer, filesCell, entryId, projectId) {
    if (files.length === 0) return;

    // Disabilita l'input durante l'upload
    const fileInput = uploadContainer.querySelector('input[type="file"]');
    if (fileInput) fileInput.disabled = true;
    
    // Crea un elemento di stato per l'upload
    let statusDiv = uploadContainer.querySelector('.upload-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.className = 'upload-status';
        uploadContainer.appendChild(statusDiv);
    }
    statusDiv.textContent = `Caricamento ${files.length} file in corso...`;
    statusDiv.style.color = 'initial';

    const formData = new FormData();
    
    // Aggiungiamo ogni file selezionato al FormData
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
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
        const buttonsContainer = filesCell.querySelector('.buttons-container');
        const uploadContainerRef = filesCell.querySelector('.file-upload-container'); // Riferimento all'uploader
        if (buttonsContainer && uploadContainerRef) {
            // Rimuovi tutti i pulsanti esistenti tranne l'uploader
            Array.from(buttonsContainer.children).forEach(child => {
                if (child !== uploadContainerRef) {
                    buttonsContainer.removeChild(child);
                }
            });

            // Aggiungi i nuovi pulsanti se ci sono file, inserendoli prima dell'uploader
            if (files.length > 0) {
                const downloadAllBtn = document.createElement('button');
                downloadAllBtn.className = 'download-all-btn';
                downloadAllBtn.innerHTML = '<i class="fas fa-download" style="color:#000;"></i>';
                downloadAllBtn.title = 'Download All';
                downloadAllBtn.style.alignSelf = 'center';
                downloadAllBtn.style.height = fileInput ? fileInput.offsetHeight + 'px' : 'auto';
                downloadAllBtn.style.padding = '0 5px';
                downloadAllBtn.addEventListener('click', async () => {
                    await downloadAllFiles(files);
                });
                
                const previewAllBtn = document.createElement('button');
                previewAllBtn.className = 'preview-all-btn';
                previewAllBtn.innerHTML = '<i class="fas fa-eye" style="color: black;"></i>';
                previewAllBtn.title = 'Preview All';
                previewAllBtn.style.alignSelf = 'center';
                previewAllBtn.style.height = fileInput ? fileInput.offsetHeight + 'px' : 'auto';
                previewAllBtn.style.padding = '0 5px';
                previewAllBtn.addEventListener('click', async () => {
                    previewAllFiles(files);
                });

                // Inserisci i nuovi pulsanti prima dell'elemento di upload
                buttonsContainer.insertBefore(downloadAllBtn, uploadContainerRef);
                buttonsContainer.insertBefore(previewAllBtn, uploadContainerRef);
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
        if (fileInput) fileInput.disabled = false;
    } catch (error) {
        console.error('Errore nel caricare i files:', error);
        statusDiv.textContent = 'Errore durante il caricamento dei file';
        statusDiv.style.color = 'red';
        // Riabilita l'input in caso di errore
        if (fileInput) fileInput.disabled = false;
    }
}

/**
 * Aggiorna la cella dei file nella riga della cronologia dopo un'operazione.
 * @param {number} entryId - L'ID della voce della cronologia.
 * @param {number} projectId - L'ID del progetto.
 * @param {HTMLElement} [customFilesCell] - Cella dei file personalizzata (opzionale).
 * @param {boolean} [canDelete] - Se l'utente può eliminare i file (opzionale).
 */
export async function updateFilesCell(entryId, projectId, customFilesCell, canDelete) {
    const files = await fetchEntryFiles(entryId, projectId);
    
    // Usa la cella personalizzata se fornita, altrimenti la cerca nel DOM
    let filesCell = customFilesCell;
    if (!filesCell) {
        const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
        if (!row) return;
        filesCell = row.cells[5];
    }
    
    // Se canDelete non è esplicitamente passato, determina se l'utente può eliminare in base alla riga
    if (canDelete === undefined) {
        const row = filesCell.closest('tr');
        const entryCreatedBy = row.getAttribute('data-created-by');
        canDelete = window.currentUserName === 'GOD' || 
                   (entryCreatedBy && String(entryCreatedBy) === String(window.currentUserId)) ||
                   !entryCreatedBy;
    }

    // Rimuovi listener 'drop' esistente prima di svuotare e riaggiungere
    // Controlla se un handler precedente è stato memorizzato sull'elemento
    if (filesCell._dropHandler) {
        filesCell.removeEventListener('drop', filesCell._dropHandler);
        // console.log(`Rimosso vecchio listener drop da cella per entry ${entryId}`);
    }
    // Rimuovi anche i listener per dragenter, dragover, dragleave per sicurezza
    if (filesCell._dragEnterHandler) filesCell.removeEventListener('dragenter', filesCell._dragEnterHandler);
    if (filesCell._dragOverHandler) filesCell.removeEventListener('dragover', filesCell._dragOverHandler);
    if (filesCell._dragLeaveHandler) filesCell.removeEventListener('dragleave', filesCell._dragLeaveHandler);


    // Svuota la cella
    filesCell.innerHTML = '';

    // Crea il container principale con display flex
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'buttons-container';
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = '5px';
    buttonsContainer.style.marginBottom = '10px';

    // Crea il container per l'upload con supporto per drag & drop
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
    browseIcon.setAttribute('title', 'Click to browse or drag & drop files here');
    browseIcon.addEventListener('click', function() {
        fileInput.click();
    });
    uploadContainer.appendChild(fileInput);
    uploadContainer.appendChild(browseIcon);

    // Definisci setupDropEvents per memorizzare gli handler
    const setupDropEvents = (element) => {
        // let leaveTimeout; // Rimosso: usiamo il contatore
        let dragCounter = 0; // Contatore per dragenter/dragleave

        // Definisci gli handler
        const handleDragEnter = (e) => {
            e.preventDefault(); e.stopPropagation();
            dragCounter++;
            // Applica lo stile solo la prima volta che si entra
            if (dragCounter === 1) {
                browseIcon.style.color = '#007bff';
                element.style.backgroundColor = '#f0f7ff';
                element.style.boxShadow = '0 0 0 2px #007bff inset';
            }
        };
        const handleDragOver = (e) => {
            e.preventDefault(); e.stopPropagation(); // Necessario per permettere il drop
            // Manteniamo l'applicazione dello stile qui per sicurezza,
            // anche se teoricamente il contatore dovrebbe bastare.
            browseIcon.style.color = '#007bff';
            element.style.backgroundColor = '#f0f7ff';
            element.style.boxShadow = '0 0 0 2px #007bff inset';
        };
        const handleDragLeave = (e) => {
            e.preventDefault(); e.stopPropagation();
            dragCounter--;
            // Rimuovi lo stile solo quando il contatore torna a zero
            if (dragCounter === 0) {
                browseIcon.style.color = 'black';
                element.style.backgroundColor = '';
                element.style.boxShadow = '';
            }
        };
        // Rimosso handleDrop da qui, verrà gestito da event delegation sul tbody

        // Rimuovi handler precedenti (se esistono) prima di aggiungere i nuovi
        if (element._dragEnterHandler) element.removeEventListener('dragenter', element._dragEnterHandler);
        if (element._dragOverHandler) element.removeEventListener('dragover', element._dragOverHandler);
        if (element._dragLeaveHandler) element.removeEventListener('dragleave', element._dragLeaveHandler);
        // Drop è gestito altrove, quindi non serve rimuoverlo qui

        // Aggiungi i nuovi handler (dragenter, dragover, dragleave)
        element.addEventListener('dragenter', handleDragEnter, false);
        element.addEventListener('dragover', handleDragOver, false); // Necessario per permettere il drop e per l'highlight continuo
        element.addEventListener('dragleave', handleDragLeave, false);
        // Drop non viene aggiunto qui

        // Memorizza i riferimenti agli handler sull'elemento per poterli rimuovere dopo
        element._dragEnterHandler = handleDragEnter;
        element._dragOverHandler = handleDragOver;
        element._dragLeaveHandler = handleDragLeave;
        // Drop non viene memorizzato qui
        // console.log(`Aggiunti listener dragenter/over/leave alla cella per entry ${entryId}`);
    };

    // Configura eventi di drag and drop solo sull'intera cella
    setupDropEvents(filesCell);

    // Non serve più aggiungere il listener 'drop' separatamente qui
    // filesCell.addEventListener('drop', ...); // Rimosso

    fileInput.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            handleFileUpload(this.files, uploadContainer, filesCell, entryId, projectId);
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
        const fileItem = createFileItem(file, projectId, entryId, canDelete);
        fileList.appendChild(fileItem);
    });
    filesCell.appendChild(fileList);
}

/**
 * Crea un elemento HTML per un file
 * @param {Object} file - Oggetto file con id, filename, filepath
 * @param {number} projectId - ID del progetto
 * @param {number} entryId - ID dell'entry
 * @param {boolean} canDelete - Se l'utente può eliminare il file
 * @returns {HTMLElement} - Elemento HTML per il file
 */
function createFileItem(file, projectId, entryId, canDelete) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const fileNameSpan = document.createElement('span');
    fileNameSpan.textContent = file.filename;
    fileNameSpan.title = file.filename; // Aggiungo il tooltip con il nome del file
    fileNameSpan.style.cursor = 'pointer';
    fileNameSpan.style.textDecoration = 'underline';
    
    fileNameSpan.addEventListener('click', async () => {
        // Prima verifica se è un file di testo
        if (file.filename.toLowerCase().endsWith('.txt')) {
            // Per i file .txt, tenta sempre di aprirli come grafico.
            // Se l'operazione fallisce, il blocco catch gestirà l'apertura come testo.
            try {
                const response = await fetch(`/api/files/${file.id}/content`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const content = await response.text();
                
                // Usa le funzioni helper centralizzate per analizzare il file
                const { dataType, startIndex } = analyzeFileContent(content);
                const points = extractDataPoints(content, startIndex);
                
                if (points.length === 0) {
                    // Rimosso alert, apro direttamente come testo.
                    window.open(`/api/files/${file.id}/view`, '_blank');
                    return;
                }

                // Nome univoco per la finestra del grafico per gestire più istanze se necessario
                const graphWindowName = 'graphViewer'; // Potrebbe essere reso più dinamico se servono più viewer
                let graphWindow = window.open('', graphWindowName); // Tenta di ottenere un riferimento a una finestra esistente

                const sendDataToGraphWindow = (targetWindow) => {
                    console.log(`Invio dati a ${targetWindow.name || 'finestra grafico'}: ${file.filename}`);
                    try {
                        targetWindow.postMessage({
                            type: 'addGraph',
                            points: points,
                            filename: file.filename,
                            dataType: dataType // Aggiunto dataType al messaggio
                        }, '*');
                    } catch (e) {
                        console.error(`Errore postMessage a ${targetWindow.name} (file .txt) con dataType:`, e);
                    }
                };

                const handleGraphViewerReady = (event) => {
                    // Assicurati che il messaggio provenga dalla finestra del grafico corretta
                    if (event.source === graphWindow && event.data && event.data.type === 'graphViewerReady') {
                        console.log(`Ricevuto graphViewerReady da ${graphWindow.name || 'finestra grafico'} per ${file.filename}`);
                        window.removeEventListener('message', handleGraphViewerReady);
                        clearTimeout(readyCheckTimeout);
                        sendDataToGraphWindow(graphWindow);
                    }
                };

                let readyCheckTimeout;

                if (!graphWindow || graphWindow.closed || !graphWindow.location || !graphWindow.location.href.includes('graph-viewer.html')) {
                    // Finestra non esiste, è chiusa, o non è graph-viewer.html: aprila.
                    console.log(`Apertura nuova finestra graph-viewer.html per ${file.filename}`);
                    graphWindow = window.open('graph-viewer.html', graphWindowName);
                    // Non impostare graphWindow.onload direttamente, affidati al messaggio 'graphViewerReady'
                    // o al timeout.
                } else {
                    // Finestra esiste ed è graph-viewer.html, portala in focus.
                    console.log(`Finestra graph-viewer.html (${graphWindow.name}) già aperta, invio areYouReady per ${file.filename}`);
                    graphWindow.focus();
                    // Invia un messaggio per chiedere se è pronta, specificando il nome della finestra target
                    try {
                        graphWindow.postMessage({ type: 'areYouReady', targetWindowName: graphWindowName }, '*');
                    } catch (e) {
                         console.error(`Errore postMessage 'areYouReady' a ${graphWindow.name} (file .txt):`, e);
                    }
                }
                
                // Ascolta la risposta 'graphViewerReady'
                window.addEventListener('message', handleGraphViewerReady);

                // Timeout di fallback: se non riceviamo 'graphViewerReady' entro un tot, invia comunque i dati.
                // Questo gestisce casi in cui la finestra era già aperta e pronta ma il messaggio iniziale è andato perso,
                // o se la nuova finestra non invia il messaggio per qualche motivo.
                readyCheckTimeout = setTimeout(() => {
                    console.warn(`Timeout attesa graphViewerReady per ${graphWindow.name || 'finestra grafico'}. Invio dati comunque per ${file.filename}.`);
                    window.removeEventListener('message', handleGraphViewerReady);
                    if (graphWindow && !graphWindow.closed) {
                        sendDataToGraphWindow(graphWindow);
                    } else {
                        console.error("Finestra grafico chiusa o non disponibile dopo timeout.");
                    }
                }, 2000); // Timeout di 2 secondi
            } catch (error) {
                console.error(`Error opening "${file.filename}" as graph:`, error);
                // Rimosso alert, apro direttamente come testo in caso di errore.
                window.open(`/api/files/${file.id}/view`, '_blank');
            }
            return;
        }
        
        // Comportamento speciale per OnlyOffice (solo per file non txt)
        if (isOnlyOfficeCompatible(file.filename)) {
            const normalizedPath = normalizeFilePath(file.filepath);
            window.open(`http://185.250.144.219:3000/onlyoffice/editor?filePath=${normalizedPath}`, '_blank');
            return;
        }
        
        // Comportamento speciale per STEP files
        if (isStepFile(file.filename)) {
            const confirmed = confirm(
                `STEP File Viewer Instructions:\n\n` +
                `The download and page opening will happen automatically:\n` +
                `1. This STEP file will be downloaded to your Downloads folder\n` +
                `2. 3D Viewer Online will open in a new window\n` +
                `3. Drag and drop the downloaded file onto the 3D Viewer page\n` +
                `4. TIP: On some browsers you can drag files directly from the download bar\n` +
                `5. Use the "Measure" tools for advanced measurements\n\n` +
                `Do you want to proceed?`
            );
            
            if (confirmed) {
                window.location.href = `/api/files/${file.id}/download`;
                setTimeout(() => {
                    window.open('https://3dviewer.net/', '_blank');
                }, 500);
            }
            return;
        }

        // Per gli altri tipi di file, tenta sempre di aprirli come grafico.
        // Se l'operazione fallisce, il blocco catch gestirà l'apertura come testo.
        try {
            const response = await fetch(`/api/files/${file.id}/content`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const content = await response.text();
            
            // Usa le funzioni helper centralizzate per analizzare il file
            const { dataType, startIndex } = analyzeFileContent(content);
            const points = extractDataPoints(content, startIndex);
            
            if (points.length === 0) {
                // Rimosso alert, apro direttamente come testo.
                window.open(`/api/files/${file.id}/view`, '_blank');
                return;
            }

            // Nome univoco per la finestra del grafico
            const graphWindowName = 'graphViewer';
            let graphWindow = window.open('', graphWindowName);

            const sendDataToGraphWindow = (targetWindow) => {
                console.log(`Invio dati a ${targetWindow.name || 'finestra grafico'}: ${file.filename}`);
                try {
                    targetWindow.postMessage({
                        type: 'addGraph',
                        points: points,
                        filename: file.filename,
                        dataType: dataType // Aggiunto dataType al messaggio
                    }, '*');
                } catch (e) {
                    console.error(`Errore postMessage a ${targetWindow.name} (altri file) con dataType:`, e);
                }
            };

            const handleGraphViewerReady = (event) => {
                if (event.source === graphWindow && event.data && event.data.type === 'graphViewerReady') {
                    console.log(`Ricevuto graphViewerReady da ${graphWindow.name || 'finestra grafico'} per ${file.filename}`);
                    window.removeEventListener('message', handleGraphViewerReady);
                    clearTimeout(readyCheckTimeout);
                    sendDataToGraphWindow(graphWindow);
                }
            };

            let readyCheckTimeout;

            if (!graphWindow || graphWindow.closed || !graphWindow.location || !graphWindow.location.href.includes('graph-viewer.html')) {
                console.log(`Apertura nuova finestra graph-viewer.html per ${file.filename}`);
                graphWindow = window.open('graph-viewer.html', graphWindowName);
            } else {
                console.log(`Finestra graph-viewer.html (${graphWindow.name}) già aperta, invio areYouReady per ${file.filename}`);
                graphWindow.focus();
                try {
                    graphWindow.postMessage({ type: 'areYouReady', targetWindowName: graphWindowName }, '*');
                } catch (e) {
                    console.error(`Errore postMessage 'areYouReady' a ${graphWindow.name} (altri file):`, e);
                }
            }

            window.addEventListener('message', handleGraphViewerReady);

            readyCheckTimeout = setTimeout(() => {
                console.warn(`Timeout attesa graphViewerReady per ${graphWindow.name || 'finestra grafico'}. Invio dati comunque per ${file.filename}.`);
                window.removeEventListener('message', handleGraphViewerReady);
                if (graphWindow && !graphWindow.closed) {
                    sendDataToGraphWindow(graphWindow);
                } else {
                    console.error("Finestra grafico chiusa o non disponibile dopo timeout.");
                }
            }, 2000); // Timeout di 2 secondi
        } catch (error) {
            console.error(`Error opening "${file.filename}" as graph:`, error);
            // Rimosso alert, apro direttamente come testo in caso di errore.
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
    
    // Aggiungi il pulsante di eliminazione solo se l'utente ha i permessi
    if (canDelete) {
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
    }
    
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
 * Visualizza l'anteprima di tutti i file, separando i file di curve dagli altri.
 * @param {Array} files - Array di oggetti file
 */
async function previewAllFiles(files) {
    // Array per separare i file
    const graphFiles = [];
    const otherFiles = [];

    // Analizza ogni file per determinare il tipo
    // Parole chiave da cercare nei file di testo
    const KEYWORDS = [
        "Fs", "Re", "Sd", "Qms", "Qes", "Qts", "Cms", "Mms", "Rms", "Bl", "dBspl", "VAS", "Zmin", "L1kHz", "L10kHz"
    ];

    for (const file of files) {
        try {
            // Solo i file di testo possono contenere dati grafici o parametri
            if (file.filename && file.filename.toLowerCase().endsWith('.txt')) {
                const response = await fetch(`/api/files/${file.id}/content`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const content = await response.text();
                // Usa le funzioni helper centralizzate per analizzare il file
                const { dataType, startIndex } = analyzeFileContent(content);
                const points = extractDataPoints(content, startIndex);

                // Cerca le parole chiave nel testo (case-insensitive)
                let keywordCount = 0;
                for (const kw of KEYWORDS) {
                    if (content.toLowerCase().includes(kw.toLowerCase())) {
                        keywordCount++;
                    }
                }

                // Se contiene dati grafici, va in graphFiles
                if (points.length > 0) {
                    graphFiles.push({ file, points, dataType });
                    continue;
                }

                // Se contiene almeno 3 parole chiave, va in floating graph viewer
                if (keywordCount >= 3) {
                    // Invia il file come "floating" al graph viewer
                    // La finestra floating sarà gestita da graph-viewer.html
                    const graphWindowName = 'graphViewer';
                    let graphWindow = window.open('', graphWindowName);
                    const sendFloatingToGraphWindow = (targetWindow) => {
                        targetWindow.postMessage({
                            type: 'addFloatingText',
                            filename: file.filename,
                            content: content
                        }, '*');
                    };
                    if (!graphWindow || graphWindow.closed || !graphWindow.location || !graphWindow.location.href.includes('graph-viewer.html')) {
                        graphWindow = window.open('graph-viewer.html', graphWindowName);
                        graphWindow.onload = () => sendFloatingToGraphWindow(graphWindow);
                    } else {
                        graphWindow.focus();
                        sendFloatingToGraphWindow(graphWindow);
                    }
                    // Non aggiungere agli altri file
                    continue;
                }
            }
            // Se non è un file grafico o parametri, aggiungilo agli altri
            otherFiles.push(file);
        } catch (error) {
            console.error(`Errore nell'analisi del file "${file.filename}", verrà trattato come file generico:`, error);
            otherFiles.push(file); // In caso di errore, lo mettiamo negli "altri"
        }
    }

    // Gestisce l'apertura della finestra per i grafici
    if (graphFiles.length > 0) {
        const graphWindowName = 'graphViewer';
        let graphWindow = window.open('', graphWindowName);

        // Funzione per inviare i dati alla finestra del grafico
        const sendDataToGraphWindow = (targetWindow) => {
            // Pulisce i grafici precedenti prima di aggiungerne di nuovi
            targetWindow.postMessage({ type: 'clearGraphs' }, '*');
            graphFiles.forEach(graphData => {
                targetWindow.postMessage({
                    type: 'addGraph',
                    points: graphData.points,
                    filename: graphData.file.filename,
                    dataType: graphData.dataType
                }, '*');
            });
        };

        // Se la finestra non esiste o è chiusa, la apriamo
        if (!graphWindow || graphWindow.closed || !graphWindow.location || !graphWindow.location.href.includes('graph-viewer.html')) {
            graphWindow = window.open('graph-viewer.html', graphWindowName);
            graphWindow.onload = () => sendDataToGraphWindow(graphWindow);
        } else {
            graphWindow.focus();
            sendDataToGraphWindow(graphWindow);
        }
    }

    // Gestisce l'apertura della finestra per tutti gli altri file
    if (otherFiles.length > 0) {
        const fileIds = otherFiles.map(file => file.id);
        const url = `all-files-preview.html?ids=${fileIds.join(',')}`;
        // Crea un nome univoco per ogni finestra usando timestamp per aprire sempre una nuova finestra
        const previewWindowName = `allFilesPreview_${Date.now()}`;
        let previewWindow = window.open(url, previewWindowName);
        if (previewWindow && !previewWindow.closed) {
            previewWindow.focus();
        }
    }
}
