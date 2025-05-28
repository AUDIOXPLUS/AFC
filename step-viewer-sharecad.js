// Integrazione con ShareCAD per visualizzazione file STEP
// Questo script gestisce l'interazione con il servizio ShareCAD.org

/**
 * Visualizza un file STEP su ShareCAD
 * @param {File|Blob|String} fileContent - Il contenuto del file o un URL per il download
 * @param {String} fileName - Nome del file
 */
function viewOnShareCAD(fileContent, fileName) {
    // ShareCAD supporta la visualizzazione di URL direttamente
    if (typeof fileContent === 'string' && fileContent.startsWith('http')) {
        // Se è un URL, possiamo aprire direttamente ShareCAD con il parametro url
        const shareCADUrl = `https://sharecad.org/cadframe/load?url=${encodeURIComponent(fileContent)}`;
        window.open(shareCADUrl, '_blank');
        return;
    }
    
    // Per i file locali, mostriamo una finestra modale con istruzioni
    const modal = createShareCADModal(fileName);
    document.body.appendChild(modal);
    
    // Gestisci azioni dei pulsanti
    modal.querySelector('.sharecad-cancel-btn').addEventListener('click', function() {
        modal.remove();
    });
    
    const viewBtn = modal.querySelector('.sharecad-view-btn');
    viewBtn.addEventListener('click', function() {
        // Apri ShareCAD in una nuova finestra
        window.open('https://sharecad.org', '_blank');
        
        // Aggiorna stato
        updateModalStatus(
            modal, 
            'Una nuova finestra è stata aperta con ShareCAD. Carica il tuo file manualmente usando il pulsante "SELECT FILE" nella pagina ShareCAD.', 
            'success'
        );
    });
    
    // Solo per i file locali in memoria
    if (fileContent instanceof File || (typeof fileContent === 'string' && !fileContent.startsWith('http'))) {
        // Mostra istruzioni per caricare manualmente il file
        updateModalStatus(modal, 'ShareCAD richiede che il file sia caricato manualmente. Fai clic su "Apri ShareCAD" e poi seleziona il file.', 'info');
    }
}

/**
 * Crea una finestra modale per ShareCAD
 * @param {String} fileName - Nome del file
 * @returns {HTMLElement} - Elemento DOM della modale
 */
function createShareCADModal(fileName) {
    const modal = document.createElement('div');
    modal.className = 'sharecad-modal';
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
        <div class="sharecad-modal-content" style="
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            width: 80%;
            max-width: 500px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        ">
            <h3 style="margin-top: 0;">Visualizza su ShareCAD</h3>
            <p>ShareCAD è un servizio gratuito per visualizzare file CAD online, inclusi file STEP.</p>
            
            <div class="sharecad-status" style="
                margin: 15px 0;
                padding: 10px;
                background-color: #f8f9fa;
                border-radius: 4px;
                display: none;
            "></div>
            
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <button class="sharecad-cancel-btn" style="
                    padding: 8px 12px;
                    background-color: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Annulla</button>
                <button class="sharecad-view-btn" style="
                    padding: 8px 12px;
                    background-color: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Apri ShareCAD</button>
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
    const statusElement = modal.querySelector('.sharecad-status');
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

// Esporta funzioni per l'uso esterno
window.ShareCADIntegration = {
    viewOnShareCAD
};
