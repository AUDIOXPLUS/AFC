// menu-utils.js

/**
 * Apre entrambe le finestre per il database degli speaker: Graph Viewer e Speaker Files.
 */
function openSpeakerDatabase() {
    // Ottiene l'ID del progetto dall'URL se disponibile
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id') || '';
    
    // Apre il Graph Viewer come nuova finestra
    window.open('graph-viewer.html', '_blank');
    
    // Apre la pagina Speaker Files come nuova finestra con l'ID del progetto se presente
    const speakerFilesUrl = projectId ? `speaker-files.html?id=${projectId}` : 'speaker-files.html';
    window.open(speakerFilesUrl, '_blank');
}
