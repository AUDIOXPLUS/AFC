// Integrazione con CAD Exchanger per visualizzazione file STEP
// Questo script gestisce l'interazione con il servizio CAD Exchanger Web Viewer (accessibile globalmente)

/**
 * Visualizza un file STEP su CAD Exchanger
 * @param {File|Blob|String} fileContent - Il contenuto del file o un URL per il download
 * @param {String} fileName - Nome del file
 */
function viewOnCADExchanger(fileContent, fileName) {
    // CAD Exchanger supporta il caricamento manuale di file
    const modal = createCADExchangerModal(fileName);
    document.body.appendChild(modal);
    
    // Gestisci azioni dei pulsanti
    modal.querySelector('.cadexchanger-cancel-btn').addEventListener('click', function() {
        modal.remove();
    });
    
    const viewBtn = modal.querySelector('.cadexchanger-view-btn');
    viewBtn.addEventListener('click', function() {
        // Apri CAD Exchanger in una nuova finestra - uso l'applicazione web
        window.open('https://cadexchanger.com/online-cad-viewer/', '_blank');
        
        // Aggiorna stato
        updateModalStatus(
            modal, 
            'Una nuova finestra è stata aperta con CAD Exchanger. Carica il tuo file manualmente usando il pulsante "UPLOAD YOUR FILE" nella pagina CAD Exchanger.', 
            'success'
        );
    });
    
    // Solo per i file locali in memoria
    if (fileContent instanceof File || (typeof fileContent === 'string' && !fileContent.startsWith('http'))) {
        // Mostra istruzioni per caricare manualmente il file
        updateModalStatus(modal, 'CAD Exchanger richiede che il file sia caricato manualmente. Fai clic su "Apri CAD Exchanger" e poi carica il file.', 'info');
    }
}

/**
 * Crea una finestra modale per CAD Exchanger
 * @param {String} fileName - Nome del file
 * @returns {HTMLElement} - Elemento DOM della modale
 */
function createCADExchangerModal(fileName) {
    const modal = document.createElement('div');
    modal.className = 'cadexchanger-modal';
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
        <div class="cadexchanger-modal-content" style="
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            width: 80%;
            max-width: 500px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        ">
            <h3 style="margin-top: 0;">Visualizza su CAD Exchanger</h3>
            <p>CAD Exchanger è un servizio per visualizzare file CAD online, accessibile globalmente senza restrizioni geografiche.</p>
            <p>Funziona in qualsiasi paese, inclusa la Cina, senza necessità di VPN.</p>
            
            <div class="cadexchanger-status" style="
                margin: 15px 0;
                padding: 10px;
                background-color: #f8f9fa;
                border-radius: 4px;
                display: none;
            "></div>
            
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <button class="cadexchanger-cancel-btn" style="
                    padding: 8px 12px;
                    background-color: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Annulla</button>
                <button class="cadexchanger-view-btn" style="
                    padding: 8px 12px;
                    background-color: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Apri CAD Exchanger</button>
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
    const statusElement = modal.querySelector('.cadexchanger-status');
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
window.CADExchangerIntegration = {
    viewOnCADExchanger
};
