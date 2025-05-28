// Integrazione con Sketchfab per visualizzazione file STEP
// Questo script gestisce l'interazione con l'API di Sketchfab

// Configurazione Sketchfab
const SKETCHFAB_CONFIG = {
    // Imposta qui la tua API key se necessario
    apiUrl: 'https://api.sketchfab.com/v3',
    modelUrl: 'https://sketchfab.com/models'
};

/**
 * Visualizza un file STEP su Sketchfab
 * @param {File|Blob|String} fileContent - Il contenuto del file o un URL per il download
 * @param {String} fileName - Nome del file
 * @param {Function} onSuccess - Callback per il successo
 * @param {Function} onError - Callback per l'errore
 */
function viewOnSketchfab(fileContent, fileName, onSuccess, onError) {
    // Apri una finestra modale per l'upload
    const modal = createSketchfabModal(fileName);
    document.body.appendChild(modal);
    
    // Aggiorna lo stato
    updateModalStatus(modal, 'Preparazione per l\'upload su Sketchfab...');
    
    // Gestisci azioni dei pulsanti
    modal.querySelector('.sketchfab-cancel-btn').addEventListener('click', function() {
        modal.remove();
    });
    
    const uploadBtn = modal.querySelector('.sketchfab-upload-btn');
    uploadBtn.addEventListener('click', function() {
        // Prendi i valori dal form
        const title = modal.querySelector('#sketchfab-model-title').value || fileName;
        const description = modal.querySelector('#sketchfab-model-desc').value || 
                           `Modello STEP convertito da ${fileName}`;
        const isPrivate = modal.querySelector('#sketchfab-private').checked;
        
        // Disabilita il pulsante durante l'upload
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
        
        // Prepara il form data
        const formData = new FormData();
        
        // Aggiungi il file
        if (typeof fileContent === 'string' && fileContent.startsWith('http')) {
            // Se è un URL, lo inviamo come parametro
            formData.append('source', 'url');
            formData.append('url', fileContent);
        } else if (fileContent instanceof File) {
            // Se è un File object
            formData.append('source', 'file');
            formData.append('file', fileContent);
        } else if (typeof fileContent === 'string') {
            // Se è una stringa di contenuto, crea un blob
            const blob = new Blob([fileContent], { type: 'application/step' });
            formData.append('source', 'file');
            formData.append('file', blob, fileName);
        }
        
        // Aggiungi i metadati
        formData.append('name', title);
        formData.append('description', description);
        formData.append('isPrivate', isPrivate ? 'true' : 'false');
        formData.append('tags', 'step cad');
        
        // Senza API key, offri un link diretto a Sketchfab
        redirectToSketchfabUpload(modal);
    });
}

/**
 * Crea una finestra modale per l'upload su Sketchfab
 * @param {String} fileName - Nome del file
 * @returns {HTMLElement} - Elemento DOM della modale
 */
function createSketchfabModal(fileName) {
    const modal = document.createElement('div');
    modal.className = 'sketchfab-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0,0,0,0.7);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;
    
    // Contenuto della modale
    modal.innerHTML = `
        <div class="sketchfab-modal-content" style="
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            width: 80%;
            max-width: 500px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        ">
            <h3 style="margin-top: 0;">Visualizza su Sketchfab</h3>
            <p>Compila i dettagli per il tuo modello:</p>
            
            <div style="margin-bottom: 15px;">
                <label for="sketchfab-model-title" style="display: block; margin-bottom: 5px;">Titolo:</label>
                <input type="text" id="sketchfab-model-title" value="${fileName}" style="
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                ">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label for="sketchfab-model-desc" style="display: block; margin-bottom: 5px;">Descrizione:</label>
                <textarea id="sketchfab-model-desc" style="
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    height: 100px;
                ">Modello STEP importato dal visualizzatore</textarea>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="sketchfab-private">
                    <span style="margin-left: 5px;">Modello privato</span>
                </label>
            </div>
            
            <div class="sketchfab-status" style="
                margin: 15px 0;
                padding: 10px;
                background-color: #f8f9fa;
                border-radius: 4px;
                display: none;
            "></div>
            
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button class="sketchfab-cancel-btn" style="
                    padding: 8px 12px;
                    background-color: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Annulla</button>
                <button class="sketchfab-upload-btn" style="
                    padding: 8px 12px;
                    background-color: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Upload su Sketchfab</button>
            </div>
        </div>
    `;
    
    return modal;
}

/**
 * Aggiorna lo stato della modale
 * @param {HTMLElement} modal - Elemento della modale
 * @param {String} message - Messaggio di stato
 * @param {String} type - Tipo di messaggio (info, error, success)
 */
function updateModalStatus(modal, message, type = 'info') {
    const statusElement = modal.querySelector('.sketchfab-status');
    statusElement.style.display = 'block';
    
    // Colore basato sul tipo
    let backgroundColor = '#f8f9fa';
    let color = '#212529';
    
    if (type === 'error') {
        backgroundColor = '#f8d7da';
        color = '#721c24';
    } else if (type === 'success') {
        backgroundColor = '#d4edda';
        color = '#155724';
    } else if (type === 'warning') {
        backgroundColor = '#fff3cd';
        color = '#856404';
    }
    
    statusElement.style.backgroundColor = backgroundColor;
    statusElement.style.color = color;
    statusElement.textContent = message;
}

/**
 * Reindirizza l'utente a Sketchfab per l'upload manuale
 * @param {HTMLElement} modal - Elemento della modale
 */
function redirectToSketchfabUpload(modal) {
    // Aggiorna stato
    updateModalStatus(modal, 'Per procedere senza API key, ti reindirizzeremo a Sketchfab...', 'info');
    
    // Dopo un breve delay, apri una nuova finestra con Sketchfab
    setTimeout(() => {
        const title = modal.querySelector('#sketchfab-model-title').value;
        const isPrivate = modal.querySelector('#sketchfab-private').checked;
        
        // URL di upload su Sketchfab
        const sketchfabUploadUrl = 'https://sketchfab.com/upload';
        
        // Apri una nuova finestra
        window.open(sketchfabUploadUrl, '_blank');
        
        // Aggiorna stato
        updateModalStatus(
            modal, 
            'Una nuova finestra è stata aperta con Sketchfab. Carica il tuo file manualmente.', 
            'success'
        );
        
        // Riabilita il pulsante
        const uploadBtn = modal.querySelector('.sketchfab-upload-btn');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload su Sketchfab';
    }, 1500);
}

// Esporta funzioni per l'uso esterno
window.SketchfabIntegration = {
    viewOnSketchfab
};
