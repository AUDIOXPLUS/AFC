// Variabili globali condivise tra tutti i file del visualizzatore STEP

// Variabili Three.js
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let model = null;

// Opzioni di visualizzazione
let wireframeMode = false;
let orthographicMode = false;

// Metadati
let currentFileId = null;
let currentFileName = '';

// Messaggi di stato
const messages = {
    loading: 'Caricamento in corso...',
    ready: 'Pronto',
    error: 'Si è verificato un errore'
};

console.log('Variabili globali step-viewer inizializzate');
