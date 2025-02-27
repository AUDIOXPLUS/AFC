/* Definizione della variabile projectId
   Estrae l'ID del progetto dalla query string dell'URL.
   Vengono verificati i parametri "projectId" e "id", ad esempio ?projectId=123 o ?id=123
*/
const urlParams = new URLSearchParams(window.location.search);
let projectId = urlParams.get('projectId');
if (!projectId) {
    projectId = urlParams.get('id');
}
if (!projectId) {
    console.error("projectId non definito nell'URL");
    document.body.innerHTML = "<h1>Errore: projectId non definito nell'URL</h1>";
    throw new Error("projectId non definito");
}

// Funzione di utilità per gestire gli errori di rete
function handleNetworkError(error) {
    console.error('Network error:', error);
    // Se l'errore è di tipo network (offline) o 401 (non autorizzato)
    if (!navigator.onLine || (error.response && error.response.status === 401)) {
        window.location.replace('login.html');
    }
}

// Funzione per gestire le risposte delle API
window.handleResponse = function(response) {
    if (response.status === 401) {
        window.location.replace('login.html');
        throw new Error('Unauthorized');
    }
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Carica le fasi all'avvio della pagina
document.addEventListener('DOMContentLoaded', function() {
    // Verifica lo stato della connessione
    if (!navigator.onLine) {
        window.location.replace('login.html');
        return;
    }
    // Carica i dati necessari
    Promise.all([
        // Carica le fasi
        fetch('/api/phases').then(response => window.handleResponse(response)),
        // Carica i membri del team
        fetch('/api/team-members').then(response => window.handleResponse(response)),
        // Carica l'utente corrente
        fetch('/api/users/current').then(response => window.handleResponse(response))
    ])
    .then(([phases, teamMembers, currentUser]) => {
        window.projectPhases = phases;
        window.dispatchEvent(new CustomEvent('phasesLoaded', { detail: phases }));
        window.teamMembers = teamMembers;
        window.currentUserId = currentUser.id;

        // Inizializza il filtraggio
        enableFiltering();

        // Carica la cronologia del progetto
        window.fetchProjectHistory(projectId);
    })
    .catch(error => handleNetworkError(error));
});

// Funzione per abilitare il filtraggio live
function enableFiltering() {
    const textFilterInputs = document.querySelectorAll('.filters input[type="text"]');
    const statusDropdownBtn = document.getElementById('status-dropdown-btn');
    const statusDropdown = document.getElementById('status-filter');
    const statusCheckboxes = statusDropdown.querySelectorAll('input[type="checkbox"]');
    const tableRows = document.getElementById('history-table').getElementsByTagName('tbody')[0].rows;

    // Apertura/chiusura dropdown
    statusDropdownBtn.addEventListener('click', function() {
        statusDropdown.classList.toggle('show');
    });

    // Chiudi dropdown quando si clicca fuori
    document.addEventListener('click', function(event) {
        if (!event.target.matches('#status-dropdown-btn') && !event.target.closest('.dropdown-content')) {
            statusDropdown.classList.remove('show');
        }
    });

    function applyFilters() {
        const textFilterValues = Array.from(textFilterInputs).map(input => input.value.toLowerCase().trim());
        const selectedStatuses = Array.from(statusCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        // Aggiorna lo stile dei filtri attivi
        textFilterInputs.forEach(input => {
            input.classList.toggle('filter-active', input.value.trim() !== '');
        });

        statusDropdownBtn.classList.toggle('filter-active', selectedStatuses.length > 0);

        Array.from(tableRows).forEach(row => {
            let isMatch = true;

            // Filtra per descrizione
            if (textFilterValues[0] && !row.cells[2].textContent.toLowerCase().includes(textFilterValues[0])) {
                isMatch = false;
            }

            // Filtra per assigned to
            if (textFilterValues[1] && !row.cells[3].textContent.toLowerCase().includes(textFilterValues[1])) {
                isMatch = false;
            }

            // Filtra per status
            if (selectedStatuses.length > 0) {
                const statusCell = row.cells[4];
                const statusText = statusCell.textContent.trim();
                if (!selectedStatuses.includes(statusText)) {
                    isMatch = false;
                }
            }

            row.style.display = isMatch ? '' : 'none';
        });
    }

    // Event listeners per i filtri
    textFilterInputs.forEach(input => {
        input.addEventListener('input', applyFilters);
    });

    statusCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });

    // Salva il riferimento globale
    filteringApi = { applyFilters };
}

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
        
        // Evidenzia l'header della colonna Date che è ordinata di default
        const table = document.getElementById('history-table');
        const headers = table.getElementsByTagName('th');
        Array.from(headers).forEach(header => header.classList.remove('sorted'));
        headers[0].classList.add('sorted'); // Date è la prima colonna (index 0)
        
        window.displayProjectHistory(history);
    } catch (error) {
        handleNetworkError(error);
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
        
        // Trova il nome della fase corrispondente
        const phaseCell = row.insertCell(1);
        if (window.projectPhases) {
            const phase = window.projectPhases.find(p => String(p.id) === String(entry.phase));
            phaseCell.textContent = phase ? phase.name : entry.phase;
        } else {
            // Se le fasi non sono ancora state caricate, aggiungi un listener per l'evento phasesLoaded
            phaseCell.textContent = entry.phase;
            window.addEventListener('phasesLoaded', (event) => {
                const phases = event.detail;
                const phase = phases.find(p => String(p.id) === String(entry.phase));
                if (phase) {
                    phaseCell.textContent = phase.name;
                }
            });
        }
        
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
        // Converti l'ID in nome utente se necessario
        const assignedMember = window.teamMembers.find(member => String(member.id) === String(entry.assigned_to));
        row.insertCell(3).textContent = assignedMember ? assignedMember.name : (entry.assigned_to || '-');
        row.insertCell(4).textContent = entry.status || '-';

        // Gestisce la cella dei file associati alla voce della cronologia
        const filesCell = row.insertCell(5);

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

uploadContainer.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadContainer.style.backgroundColor = '#e6ffe6'; // Feedback visivo
});

uploadContainer.addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadContainer.style.backgroundColor = ''; // Ripristina colore originale
});

uploadContainer.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadContainer.style.backgroundColor = ''; // Ripristina colore originale

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
    }
});

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
                    
                    // Aggiorna solo la lista dei file invece di ricreare l'intera interfaccia
                    const files = await window.fetchEntryFiles(entry.id);
                    const fileList = filesCell.querySelector('.file-list');
                    fileList.innerHTML = '';
                    
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
                                window.open(`http://185.250.144.219:3000/onlyoffice/editor?filePath=${normalizedPath}`, '_blank');
                            } else {
                                window.open(`/api/files/${file.id}/view`, '_blank');
                            }
                        });
                        fileItem.appendChild(fileNameSpan);
                        
                        const downloadBtn = document.createElement('button');
                        downloadBtn.className = 'download-btn';
                        downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
                        downloadBtn.addEventListener('click', () => window.downloadFile(file.id));
                        fileItem.appendChild(downloadBtn);
                        
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'delete-btn';
                        deleteBtn.setAttribute('data-file-id', file.id);
                        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                        deleteBtn.addEventListener('click', async () => {
                            await window.deleteFile(file.id);
                            window.updateFilesCell(entry.id);
                        });
                        fileItem.appendChild(deleteBtn);
                        
                        fileList.appendChild(fileItem);
                    });
                    
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

        // Recupera e visualizza i file associati alla voce della cronologia
        const files = await window.fetchEntryFiles(entry.id);
        // Aggiungi il pulsante "Download All" se ci sono file
        if (files.length > 0) {
            const downloadAllBtn = document.createElement('button');
            downloadAllBtn.className = 'download-all-btn';
downloadAllBtn.innerHTML = '<i class="fas fa-download" style="color:#000;"></i>';
downloadAllBtn.title = 'Download All';
downloadAllBtn.style.alignSelf = 'center';
downloadAllBtn.style.height = fileInput.offsetHeight + 'px';
downloadAllBtn.style.padding = '0 5px';
            buttonsContainer.insertBefore(downloadAllBtn, uploadContainer);
            downloadAllBtn.addEventListener('click', async () => {
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
                    
                    // Aggiungi una pausa tra i download
                    if (i < files.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                // Mostra il messaggio di completamento
                const downloadPath = 'Downloads';
                notificationDiv.innerHTML = `
                    <div style="margin-bottom: 10px">
                        Files have been downloaded to your default download folder:<br>
                        <strong>${downloadPath}</strong>
                    </div>
                `;

                // Se il browser supporta l'API File System Access, aggiungi il pulsante per aprire la cartella
                if ('showDirectoryPicker' in window) {
                    const openFolderBtn = document.createElement('button');
                    openFolderBtn.textContent = 'Open Download Folder';
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

                // Rimuovi la notifica dopo 10 secondi
                setTimeout(() => {
                    document.body.removeChild(notificationDiv);
                }, 10000);
            });
        }

        // Rimuovi tutti i pulsanti esistenti prima di aggiungerne di nuovi
        while (buttonsContainer.firstChild) {
            buttonsContainer.removeChild(buttonsContainer.firstChild);
        }
        
        // Aggiungi i pulsanti "Preview All" e "Download All" solo se ci sono file
        if (files.length > 0) {
            // Aggiungi il pulsante "Preview All"
            const previewAllBtn = document.createElement('button');
            previewAllBtn.className = 'preview-all-btn';
            previewAllBtn.innerHTML = '<i class="fas fa-eye" style="color: black;"></i>';
            previewAllBtn.title = 'Preview All';
            buttonsContainer.appendChild(previewAllBtn);
            
            // Aggiungi il pulsante "Download All"
            const downloadAllBtn = document.createElement('button');
            downloadAllBtn.className = 'download-all-btn';
            downloadAllBtn.innerHTML = '<i class="fas fa-download" style="color:#000;"></i>';
            downloadAllBtn.title = 'Download All';
            buttonsContainer.appendChild(downloadAllBtn);
            
            downloadAllBtn.addEventListener('click', async () => {
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
                    
                    // Aggiungi una pausa tra i download
                    if (i < files.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                // Mostra il messaggio di completamento
                const downloadPath = 'Downloads';
                notificationDiv.innerHTML = `
                    <div style="margin-bottom: 10px">
                        Files have been downloaded to your default download folder:<br>
                        <strong>${downloadPath}</strong>
                    </div>
                `;

                // Se il browser supporta l'API File System Access, aggiungi il pulsante per aprire la cartella
                if ('showDirectoryPicker' in window) {
                    const openFolderBtn = document.createElement('button');
                    openFolderBtn.textContent = 'Open Download Folder';
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

                // Rimuovi la notifica dopo 10 secondi
                setTimeout(() => {
                    document.body.removeChild(notificationDiv);
                }, 10000);
            });
            
            // Aggiungi l'event listener per il pulsante "Preview All"
            previewAllBtn.addEventListener('click', async () => {
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
            });
        }
        
        // Aggiungi il pulsante per l'upload dei file
        buttonsContainer.appendChild(uploadContainer);

        filesCell.appendChild(buttonsContainer);

        const fileList = document.createElement('div');
        fileList.className = 'file-list';
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileNameSpan = document.createElement('span');
            fileNameSpan.textContent = file.filename || '-';
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
downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
downloadBtn.addEventListener('click', () => window.downloadFile(file.id));
fileItem.appendChild(downloadBtn);

const deleteBtn = document.createElement('button');
deleteBtn.className = 'delete-btn';
deleteBtn.setAttribute('data-file-id', file.id);
deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
deleteBtn.addEventListener('click', async () => {
    await window.deleteFile(file.id);
    window.updateFilesCell(entry.id);
});
fileItem.appendChild(deleteBtn);
            
            
            fileList.appendChild(fileItem);
        });
        filesCell.appendChild(fileList);

        // Gestisce le azioni della riga della cronologia
        const actionsCell = row.insertCell(6);

        // Aggiunge il lucchetto per la privacy
        const privacyBtn = document.createElement('button');
        privacyBtn.className = entry.private_by !== null ? 'privacy-btn text-danger' : 'privacy-btn text-dark';
        privacyBtn.setAttribute('data-entry-id', entry.id);
        const privacyIcon = document.createElement('i');
        // Mostra il lucchetto chiuso rosso se il record è privato, altrimenti lucchetto aperto nero
        privacyIcon.className = entry.private_by !== null ? 'fas fa-lock' : 'fas fa-unlock';
        privacyBtn.appendChild(privacyIcon);
        privacyBtn.addEventListener('click', async function() {
            // Se il record è privato
            if (entry.private_by !== null) {
                let isOwner = false;
                let isInList = false;
                
                // Verifica se l'utente corrente è il proprietario o è nella lista
                if (entry.private_by.includes(',')) {
                    // Se contiene virgole, è una lista di ID
                    const userIds = entry.private_by.split(',');
                    isOwner = userIds[0] == window.currentUserId; // Il primo ID è il proprietario
                    isInList = userIds.includes(String(window.currentUserId));
                } else {
                    // Se non contiene virgole, è un singolo ID
                    isOwner = entry.private_by == window.currentUserId;
                    isInList = isOwner; // Se è un singolo ID, l'utente è nella lista solo se è il proprietario
                }
                
                // Se l'utente è il proprietario, mostra il modale di condivisione
                if (isOwner) {
                    await window.showSharingModal(entry.id);
                    return;
                }
                
                // Se l'utente è nella lista ma non è il proprietario, mostra un messaggio
                if (isInList && !isOwner) {
                    alert("This record is private. Please contact the owner to modify privacy settings.");
                    return;
                }
                
                // Se l'utente non è nella lista, non dovrebbe vedere il record
                return;
            }
            
            // Se il record è pubblico, mostra il modale di condivisione
            await window.showSharingModal(entry.id);
        });
        actionsCell.appendChild(privacyBtn);

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
            // Mantiene l'ID della fase quando si imposta come completato
            const updatedEntry = {
                date: entry.date,
                phase: entry.phase, // Mantiene l'ID della fase originale
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
                    // Aggiorna subito la cronologia
                    await window.fetchProjectHistory(projectId);
                    window.updatePhaseSummary();
                    // Gestisce la risposta in background
                    window.handleResponse(response).catch(error => {
                        console.error('Errore nel processare la risposta:', error);
                    });
                } else {
                    console.error('Errore nell\'aggiornare la voce della cronologia');
                }
            } catch (error) {
                console.error('Errore durante l\'aggiornamento della voce della cronologia:', error);
            }
        });
        actionsCell.appendChild(setCompletedBtn);

        // Imposta il colore di sfondo e la classe per i task completati
        if (entry.status === 'Completed') {
            row.classList.add('completed');
        } else {
            const assignedMember = window.teamMembers.find(member => member.name === entry.assigned_to);
            if (assignedMember) {
                row.style.backgroundColor = assignedMember.color;
                row.style.color = assignedMember.fontColor || '#000000';
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
        handleNetworkError(error);
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
                    const result = await window.handleResponse(response);
                    console.log('Upload completato:', result);
                    
                    // Aggiorna solo la lista dei file
                    const files = await window.fetchEntryFiles(entryId);
                    
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
                                    
                                    // Aggiungi una pausa tra i download
                                    if (i < files.length - 1) {
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                    }
                                }

                                // Mostra il messaggio di completamento
                                const downloadPath = 'Downloads';
                                notificationDiv.innerHTML = `
                                    <div style="margin-bottom: 10px">
                                        Files have been downloaded to your default download folder:<br>
                                        <strong>${downloadPath}</strong>
                                    </div>
                                `;

                                // Rimuovi la notifica dopo 10 secondi
                                setTimeout(() => {
                                    document.body.removeChild(notificationDiv);
                                }, 10000);
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
                            });
                            buttonsContainer.insertBefore(previewAllBtn, uploadContainer);
                        }
                    }
                    
                    // Aggiorna la lista dei file
                    const fileList = filesCell.querySelector('.file-list');
                    if (fileList) {
                        fileList.innerHTML = '';
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
                                    window.open(`http://185.250.144.219:3000/onlyoffice/editor?filePath=${normalizedPath}`, '_blank');
                                } else {
                                    window.open(`/api/files/${file.id}/view`, '_blank');
                                }
                            });
                            fileItem.appendChild(fileNameSpan);
                            
                            const downloadBtn = document.createElement('button');
                            downloadBtn.className = 'download-btn';
                            downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
                            downloadBtn.addEventListener('click', () => window.downloadFile(file.id));
                            fileItem.appendChild(downloadBtn);
                            
                            const deleteBtn = document.createElement('button');
                            deleteBtn.className = 'delete-btn';
                            deleteBtn.setAttribute('data-file-id', file.id);
                            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                            deleteBtn.addEventListener('click', async () => {
                                await window.deleteFile(file.id);
                                window.updateFilesCell(entryId);
                            });
                            fileItem.appendChild(deleteBtn);
                            
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

        previewAllBtn.addEventListener('click', async () => {
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
        });

        downloadAllBtn.addEventListener('click', async () => {
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
        });
    }

    filesCell.appendChild(buttonsContainer);

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
                option.value = member.name;
                option.textContent = member.name;
                // Seleziona l'utente corrente di default
                if (String(member.id) === window.currentUserId) {
                    option.selected = true;
                }
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
            
            // Gestione del drag and drop dei file
            textarea.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.style.backgroundColor = '#e6ffe6'; // Feedback visivo
            });
            
            textarea.addEventListener('dragleave', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
            });
            
            textarea.addEventListener('drop', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const fileInput = row.cells[5].querySelector('input[type="file"]');
                    if (fileInput && !fileInput.disabled) {
                        // Crea un nuovo FileList con i file trascinati
                        const dataTransfer = new DataTransfer();
                        for (let i = 0; i < files.length; i++) {
                            dataTransfer.items.add(files[i]);
                        }
                        fileInput.files = dataTransfer.files;
                        
                        // Simula l'evento change per attivare l'upload
                        const event = new Event('change', { bubbles: true });
                        fileInput.dispatchEvent(event);
                    }
                }
            });
            
            cell.appendChild(textarea);
        } else if (field === 'phase') {
            const select = document.createElement('select');
            select.style.backgroundColor = '#ffff99';
            // Verifica se le fasi sono già state caricate
            if (window.projectPhases) {
                window.projectPhases.forEach(phase => {
                    const option = document.createElement('option');
                    option.value = phase.id;
                    option.textContent = phase.name;
                    select.appendChild(option);
                });
            } else {
                // Se le fasi non sono ancora state caricate, aggiungi un listener per l'evento phasesLoaded
                window.addEventListener('phasesLoaded', (event) => {
                    const phases = event.detail;
                    phases.forEach(phase => {
                        const option = document.createElement('option');
                        option.value = phase.id;
                        option.textContent = phase.name;
                        select.appendChild(option);
                    });
                });
            }
            cell.appendChild(select);
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

    // Cella per i file
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
    const privacyBtn = document.createElement('button');
    privacyBtn.className = 'privacy-btn text-dark';
    const privacyIcon = document.createElement('i');
    privacyIcon.className = 'fas fa-unlock';
    privacyBtn.appendChild(privacyIcon);
    privacyBtn.disabled = true; // Disabilitato finché non viene salvata la voce
    actionsCell.appendChild(privacyBtn);

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
        assignedTo: row.cells[3].querySelector('select').value,
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

        // Aggiorna subito la cronologia
        await window.fetchProjectHistory(projectId);
        window.updatePhaseSummary();
        
        // Gestisce la risposta in background
        window.handleResponse(response).then(savedEntry => {
            if (!savedEntry || !savedEntry.id) {
                console.error('Errore: la risposta del server non contiene un ID valido.');
                alert('Errore durante il salvataggio della voce');
            }
        }).catch(error => {
            console.error('Errore nel processare la risposta:', error);
        });

    } catch (error) {
        handleNetworkError(error);
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
            } else if (i === 1) { // Campo 'phase'
                input = document.createElement('select');
                // Verifica se le fasi sono già state caricate
                if (window.projectPhases) {
                    window.projectPhases.forEach(phase => {
                        const option = document.createElement('option');
                        option.value = phase.id;
                        option.textContent = phase.name;
                        if (phase.name === historyData.phase) {
                            option.selected = true;
                        }
                        input.appendChild(option);
                    });
                } else {
                    // Se le fasi non sono ancora state caricate, aggiungi un listener per l'evento phasesLoaded
                    window.addEventListener('phasesLoaded', (event) => {
                        const phases = event.detail;
                        phases.forEach(phase => {
                            const option = document.createElement('option');
                            option.value = phase.id;
                            option.textContent = phase.name;
                            if (phase.name === historyData.phase) {
                                option.selected = true;
                            }
                            input.appendChild(option);
                        });
                    });
                }
            } else if (i === 2) { // Campo 'description'
                // Per il campo description, manteniamo il testo originale inclusi i link
                input = document.createElement('textarea');
                // Otteniamo il testo originale dalla cella, che potrebbe contenere link HTML
                const descriptionText = cells[2].textContent || cells[2].innerText;
                input.value = descriptionText;
                input.style.width = '100%';
                input.style.minHeight = '100px';
                input.style.resize = 'vertical';
                
                // Gestione del drag and drop dei file in modalità edit
                input.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.style.backgroundColor = '#e6ffe6'; // Feedback visivo
                });
                
                input.addEventListener('dragleave', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
                });
                
                input.addEventListener('drop', async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
                    
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        const fileInput = cells[5].querySelector('input[type="file"]');
                        if (fileInput) {
                            // Crea un nuovo FileList con i file trascinati
                            const dataTransfer = new DataTransfer();
                            for (let i = 0; i < files.length; i++) {
                                dataTransfer.items.add(files[i]);
                            }
                            fileInput.files = dataTransfer.files;
                            
                            // Simula l'evento change per attivare l'upload
                            const event = new Event('change', { bubbles: true });
                            fileInput.dispatchEvent(event);
                        }
                    }
                });
            } else if (i === 0) { // Campo 'date'
                input = document.createElement('input');
                input.type = 'date';
                input.value = historyData.date;
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
                    // Aggiorna subito la cronologia
                    await window.fetchProjectHistory(projectId);
                    window.updatePhaseSummary();
                    // Gestisce la risposta in background
                    window.handleResponse(response).catch(error => {
                        console.error('Errore nel processare la risposta:', error);
                    });
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

        if (response.ok) {
            // Rimuove subito la riga dalla UI
            const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
            if (row) {
                row.remove();
            }
            // Aggiorna il riepilogo delle fasi
            window.updatePhaseSummary();
            // Gestisce la risposta in background
            window.handleResponse(response).catch(error => {
                console.error('Errore nel processare la risposta:', error);
            });
        } else {
            console.error('Errore nell\'eliminare la voce della cronologia');
        }
    } catch (error) {
        handleNetworkError(error);
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
        handleNetworkError(error);
    }
};



/**
 * Elimina un file associato a una voce della cronologia.
 * @param {number} fileId - L'ID del file da eliminare.
 */
/**
 * Mostra un modale per la condivisione di un'entry privata con altri utenti
 * @param {number} entryId - L'ID dell'entry da condividere
 */
window.showSharingModal = async function(entryId) {
    // Crea il modale
    const modal = document.createElement('div');
    modal.className = 'sharing-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';
    
    // Crea il contenuto del modale
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '500px';
    modalContent.style.maxWidth = '90%';
    modalContent.style.maxHeight = '80%';
    modalContent.style.overflowY = 'auto';
    
    // Titolo del modale
    const title = document.createElement('h2');
    title.textContent = 'Share with other users';
    title.style.marginBottom = '20px';
    modalContent.appendChild(title);
    
    // Caricamento degli utenti
    const loadingMessage = document.createElement('p');
    loadingMessage.textContent = 'Loading users...';
    modalContent.appendChild(loadingMessage);
    
    // Aggiungi il modale al body
    document.body.appendChild(modal);
    modal.appendChild(modalContent);
    
    // Funzione per chiudere il modale
    const closeModal = () => {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
    };
    
    // Funzione per mostrare un messaggio di errore
    const showError = (message) => {
        if (modalContent.contains(loadingMessage)) {
            modalContent.removeChild(loadingMessage);
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.marginBottom = '20px';
        errorDiv.textContent = message;
        modalContent.appendChild(errorDiv);
        
        // Pulsante di chiusura
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.padding = '5px 10px';
        closeBtn.addEventListener('click', closeModal);
        modalContent.appendChild(closeBtn);
    };
    
    try {
        // Verifica se il record è privato
        const entry = document.querySelector(`tr[data-entry-id='${entryId}']`);
        const isPrivate = entry && entry.querySelector('.privacy-btn').classList.contains('text-danger');
        
        // Recupera gli utenti disponibili
        let users = [];
        try {
            const usersResponse = await fetch('/api/team-members');
            if (usersResponse.status === 401) {
                // Reindirizza alla pagina di login se non autenticato
                alert("Your session has expired. Please log in again.");
                window.location.replace('login.html');
                return;
            }
            if (!usersResponse.ok) {
                throw new Error(`HTTP error! status: ${usersResponse.status}`);
            }
            users = await usersResponse.json();
        } catch (error) {
            console.error('Error loading team members:', error);
            showError('Error loading users. Please check your connection and try again.');
            return;
        }
        
        let sharedUsers = [];
        // Recupera gli utenti con cui è già condiviso solo se il record è privato
        if (isPrivate) {
            try {
                const sharedResponse = await fetch(`/api/projects/${projectId}/history/${entryId}/shared-users`);
                if (sharedResponse.status === 401) {
                    // Reindirizza alla pagina di login se non autenticato
                    alert("Your session has expired. Please log in again.");
                    window.location.replace('login.html');
                    return;
                }
                if (sharedResponse.ok) {
                    sharedUsers = await sharedResponse.json();
                } else {
                    console.warn(`Error loading shared users: ${sharedResponse.status}`);
                    // Continua comunque, potrebbe essere un record appena reso privato
                }
            } catch (error) {
                console.warn('Non è stato possibile recuperare gli utenti condivisi:', error);
                // Continua comunque, potrebbe essere un record appena reso privato
            }
        }
        
        // Rimuovi il messaggio di caricamento
        if (modalContent.contains(loadingMessage)) {
            modalContent.removeChild(loadingMessage);
        }
        
        // Crea la lista degli utenti
        const usersList = document.createElement('div');
        usersList.style.marginBottom = '20px';
        usersList.style.maxHeight = '300px';
        usersList.style.overflowY = 'auto';
        
        // Filtra l'utente corrente dalla lista
        const filteredUsers = users.filter(user => String(user.id) !== window.currentUserId);
        
        if (filteredUsers.length === 0) {
            const noUsersMessage = document.createElement('p');
            noUsersMessage.textContent = 'No other users available to share with.';
            usersList.appendChild(noUsersMessage);
        } else {
            // Crea un array di ID degli utenti con cui è già condiviso
            const sharedUserIds = sharedUsers.map(user => String(user.id));
            
            // Aggiungi ogni utente alla lista
            filteredUsers.forEach(user => {
                const userItem = document.createElement('div');
                userItem.style.display = 'flex';
                userItem.style.alignItems = 'center';
                userItem.style.marginBottom = '10px';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `user-${user.id}`;
                checkbox.value = user.id;
                checkbox.checked = sharedUserIds.includes(String(user.id));
                checkbox.style.marginRight = '10px';
                
                const label = document.createElement('label');
                label.htmlFor = `user-${user.id}`;
                label.textContent = user.name;
                
                userItem.appendChild(checkbox);
                userItem.appendChild(label);
                usersList.appendChild(userItem);
            });
        }
        
        modalContent.appendChild(usersList);
        
        // Pulsanti di azione
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.justifyContent = 'flex-end';
        buttonsContainer.style.gap = '10px';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', closeModal);
        
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', async () => {
            // Disabilita i pulsanti durante il salvataggio
            saveBtn.disabled = true;
            cancelBtn.disabled = true;
            
            // Raccogli gli ID degli utenti selezionati
            const selectedUsers = Array.from(usersList.querySelectorAll('input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            
            // Crea un div per i messaggi di stato
            const statusDiv = document.createElement('div');
            statusDiv.style.marginTop = '10px';
            statusDiv.style.padding = '5px';
            statusDiv.style.borderRadius = '3px';
            buttonsContainer.parentNode.insertBefore(statusDiv, buttonsContainer);
            
            // Mostra un messaggio di caricamento
            statusDiv.style.backgroundColor = '#e6f7ff';
            statusDiv.style.border = '1px solid #91d5ff';
            statusDiv.textContent = 'Saving privacy settings...';
            
            try {
                console.log('Sending privacy update request:', {
                    private: true,
                    sharedWith: selectedUsers
                });
                
                // Aggiorna la privacy con gli utenti selezionati
                const response = await fetch(`/api/projects/${projectId}/history/${entryId}/privacy`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        private: true,
                        sharedWith: selectedUsers
                    })
                });
                
                console.log('Privacy update response status:', response.status);
                
                if (response.status === 401) {
                    // Reindirizza alla pagina di login se non autenticato
                    alert("Your session has expired. Please log in again.");
                    window.location.replace('login.html');
                    return;
                }
                
                // Ottieni il testo della risposta per il debug
                const responseText = await response.text();
                console.log('Privacy update response text:', responseText);
                
                // Prova a parsare la risposta come JSON
                let result;
                try {
                    result = JSON.parse(responseText);
                    console.log('Privacy updated:', result);
                } catch (parseError) {
                    console.error('Error parsing response as JSON:', parseError);
                    throw new Error(`Invalid JSON response: ${responseText}`);
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}, message: ${result.error || responseText}`);
                }
                
                // Aggiorna lo stato del modale
                statusDiv.style.backgroundColor = '#f6ffed';
                statusDiv.style.border = '1px solid #b7eb8f';
                statusDiv.textContent = 'Privacy settings saved successfully!';
                
                // Aggiorna l'UI
                const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
                if (row) {
                    const privacyBtn = row.querySelector('.privacy-btn');
                    if (privacyBtn) {
                        privacyBtn.className = 'privacy-btn text-danger';
                        const privacyIcon = privacyBtn.querySelector('i');
                        if (privacyIcon) {
                            privacyIcon.className = 'fas fa-lock';
                        }
                    }
                }
                
                // Chiudi il modale dopo un breve ritardo
                setTimeout(() => {
                    closeModal();
                    
                    // Aggiorna il phase summary
                    if (typeof window.updatePhaseSummary === 'function') {
                        window.updatePhaseSummary();
                    }
                }, 1000);
            } catch (e) {
                console.error('Error updating privacy:', e);
                
                // Aggiorna lo stato del modale
                statusDiv.style.backgroundColor = '#fff1f0';
                statusDiv.style.border = '1px solid #ffa39e';
                statusDiv.textContent = `Error: ${e.message || 'Failed to update privacy settings'}`;
                
                // Riabilita i pulsanti
                saveBtn.disabled = false;
                cancelBtn.disabled = false;
            }
        });
        
        const makePublicBtn = document.createElement('button');
        makePublicBtn.textContent = 'Make Public';
        makePublicBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to make this record public?')) {
                // Disabilita i pulsanti durante il salvataggio
                makePublicBtn.disabled = true;
                cancelBtn.disabled = true;
                saveBtn.disabled = true;
                
                // Crea un div per i messaggi di stato
                const statusDiv = document.createElement('div');
                statusDiv.style.marginTop = '10px';
                statusDiv.style.padding = '5px';
                statusDiv.style.borderRadius = '3px';
                buttonsContainer.parentNode.insertBefore(statusDiv, buttonsContainer);
                
                // Mostra un messaggio di caricamento
                statusDiv.style.backgroundColor = '#e6f7ff';
                statusDiv.style.border = '1px solid #91d5ff';
                statusDiv.textContent = 'Making record public...';
                
                try {
                    console.log('Sending make public request');
                    
                    // Rendi pubblico il record
                    const response = await fetch(`/api/projects/${projectId}/history/${entryId}/privacy`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            private: false
                        })
                    });
                    
                    console.log('Make public response status:', response.status);
                    
                    if (response.status === 401) {
                        // Reindirizza alla pagina di login se non autenticato
                        alert("Your session has expired. Please log in again.");
                        window.location.replace('login.html');
                        return;
                    }
                    
                    // Ottieni il testo della risposta per il debug
                    const responseText = await response.text();
                    console.log('Make public response text:', responseText);
                    
                    // Prova a parsare la risposta come JSON
                    let result;
                    try {
                        result = JSON.parse(responseText);
                        console.log('Privacy updated:', result);
                    } catch (parseError) {
                        console.error('Error parsing response as JSON:', parseError);
                        throw new Error(`Invalid JSON response: ${responseText}`);
                    }
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}, message: ${result.error || responseText}`);
                    }
                    
                    // Aggiorna lo stato del modale
                    statusDiv.style.backgroundColor = '#f6ffed';
                    statusDiv.style.border = '1px solid #b7eb8f';
                    statusDiv.textContent = 'Record is now public!';
                    
                    // Aggiorna l'UI
                    const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
                    if (row) {
                        const privacyBtn = row.querySelector('.privacy-btn');
                        if (privacyBtn) {
                            privacyBtn.className = 'privacy-btn text-dark';
                            const privacyIcon = privacyBtn.querySelector('i');
                            if (privacyIcon) {
                                privacyIcon.className = 'fas fa-unlock';
                            }
                        }
                    }
                    
                    // Chiudi il modale dopo un breve ritardo
                    setTimeout(() => {
                        closeModal();
                        
                        // Aggiorna il phase summary
                        if (typeof window.updatePhaseSummary === 'function') {
                            window.updatePhaseSummary();
                        }
                    }, 1000);
                } catch (e) {
                    console.error('Error updating privacy:', e);
                    
                    // Aggiorna lo stato del modale
                    statusDiv.style.backgroundColor = '#fff1f0';
                    statusDiv.style.border = '1px solid #ffa39e';
                    statusDiv.textContent = `Error: ${e.message || 'Failed to make record public'}`;
                    
                    // Riabilita i pulsanti
                    makePublicBtn.disabled = false;
                    cancelBtn.disabled = false;
                    saveBtn.disabled = false;
                }
            }
        });
        
        // Se il record è già privato, mostra il pulsante "Make Public"
        if (isPrivate) {
            buttonsContainer.appendChild(makePublicBtn);
        }
        
        buttonsContainer.appendChild(cancelBtn);
        buttonsContainer.appendChild(saveBtn);
        modalContent.appendChild(buttonsContainer);
    } catch (e) {
        console.error('Error in sharing modal:', e);
        showError('An unexpected error occurred. Please try again later.');
    }
};

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
        
        if (response.ok) {
            // Trova l'entryId dal DOM risalendo alla riga della tabella
            const fileItem = document.querySelector(`button[data-file-id="${fileId}"]`).closest('.file-item');
            const filesCell = fileItem.closest('td');
            const row = filesCell.closest('tr');
            const entryId = row.getAttribute('data-entry-id');
            
            // Aggiorna subito la UI
            window.updateFilesCell(entryId);
            
            // Gestisce la risposta in background
            window.handleResponse(response).catch(error => {
                console.error('Errore nel processare la risposta:', error);
            });
        } else {
            throw new Error(`HTTP error: ${response.status}`);
        }
    } catch (error) {
        handleNetworkError(error);
    }
};
