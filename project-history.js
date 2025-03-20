/**
 * project-history.js
 * Script principale per la gestione della cronologia dei progetti
 */

// Funzione di inizializzazione per l'interfaccia utente
function initializeUI(projectId, historyAPI) {
    console.log("Inizializzazione UI di project-history con projectId:", projectId);
    
    // NON aggiungiamo qui l'event listener per il pulsante "Add Entry" 
    // perché viene già aggiunto in project-details.js
    
    // Esponi le funzioni globalmente per compatibilità con il codice esistente
    if (historyAPI) {
        window.showSharingModal = (entryId) => {
            historyAPI.showSharingModal(entryId, projectId);
        };
        
        window.fetchProjectHistory = (projectId) => {
            historyAPI.fetchProjectHistory(projectId);
        };
        
        window.downloadFile = (fileId) => {
            historyAPI.downloadFile(fileId);
        };
        
        window.deleteFile = (fileId) => {
            historyAPI.deleteFile(fileId, projectId, (entryId) => {
                historyAPI.updateFilesCell(entryId, projectId);
            });
        };
        
        window.updateFilesCell = (entryId) => {
            historyAPI.updateFilesCell(entryId, projectId);
        };
        
        window.editHistoryEntry = (entryId) => {
            historyAPI.editHistoryEntry(entryId, projectId);
        };
        
        window.confirmDelete = (entryId) => {
            historyAPI.confirmDelete(entryId, projectId);
        };
        
        window.deleteHistoryEntry = (entryId) => {
            historyAPI.deleteHistoryEntry(entryId, projectId);
        };
        
        window.saveNewHistoryEntry = (projectId, row) => {
            historyAPI.saveNewHistoryEntry(projectId, row);
        };
        
        // Esponi le funzioni di utilità
        if (historyAPI.isOnlyOfficeCompatible) window.isOnlyOfficeCompatible = historyAPI.isOnlyOfficeCompatible;
        if (historyAPI.normalizeFilePath) window.normalizeFilePath = historyAPI.normalizeFilePath;
        if (historyAPI.handleResponse) window.handleResponse = historyAPI.handleResponse;
    } else {
        console.error("API di project-history non disponibile");
    }
}

// Inizializza il modulo quando il DOM è caricato
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM caricato, tentativo di inizializzare project-history');
    
    /* Estrazione dell'ID progetto dall'URL
       Vengono verificati i parametri "projectId" e "id" */
    const urlParams = new URLSearchParams(window.location.search);
    let projectId = urlParams.get('projectId');
    if (!projectId) {
        projectId = urlParams.get('id');
    }
    if (!projectId) {
        console.error("projectId non definito nell'URL");
        document.body.innerHTML = "<h1>Errore: projectId non definito nell'URL</h1>";
        return; // Esce senza lanciare un errore per evitare crash
    }
    
    // Carica il modulo in modo asincrono con gestione completa degli errori
    import('./js/project-history/index.js')
        .then(module => {
            console.log('Modulo project-history caricato con successo');
            const initialize = module.default;
            
            try {
                // Inizializza il modulo con l'ID del progetto
                const historyAPI = initialize(projectId);
                
                // Memorizza l'API nella finestra e inizializza l'interfaccia
                window.ProjectHistory = historyAPI || window.ProjectHistory;
                initializeUI(projectId, window.ProjectHistory);
                
                console.log('Inizializzazione completata con successo');
            } catch (initError) {
                console.error('Errore durante l\'inizializzazione:', initError);
                document.getElementById('history-table')?.insertAdjacentHTML('beforebegin', `
                    <div style="color: red; background: #ffeeee; padding: 10px; margin: 10px; border: 1px solid #cc0000;">
                        <h3>Errore durante l'inizializzazione di project-history</h3>
                        <p>${initError.message}</p>
                    </div>
                `);
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento del modulo:', error);
            document.getElementById('history-table')?.insertAdjacentHTML('beforebegin', `
                <div style="color: red; background: #ffeeee; padding: 10px; margin: 10px; border: 1px solid #cc0000;">
                    <h3>Errore nel caricamento del modulo project-history</h3>
                    <p>${error.message}</p>
                </div>
            `);
        });
});
