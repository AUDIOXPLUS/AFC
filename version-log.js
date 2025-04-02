// Dati del version log
const versionLogData = [
    { date: '03/04/25', description: 'Fixed duplicated projects issue. Fixed project history save bug' },
    { date: '02/04/25', description: 'Implemented progress bar. Fixed minor bugs' },
    { date: '29/03/25', description: 'Improved project and history loading speed. Implemented clipboard synchronization' },
    { date: '28/03/25', description: 'Implemented change password form' },
    { date: '28/03/25', description: 'Implemented urgent task prioritization. Separated autoassigned tasks from calculations. Enhanced visibility of new tasks' },
    { date: '21/03/25', description: 'Implemented reply and forward for project history records. Added global statistics for tasks' },
    { date: '27/02/25', description: 'Implemented private record sharing with other users' },
    { date: '27/02/25', description: 'Fixed icon display bugs in project history' },
    { date: '27/02/25', description: 'Improved mobile device display' },
    { date: '20/02/25', description: 'Added preview all and download all files' },
    { date: '19/02/25', description: 'Fixed bugs for private records' },
    { date: '19/02/25', description: 'Added version log' },
    { date: '19/02/25', description: 'Fixed full screen view' },
    { date: '19/02/25', description: 'Fixed priority sorting' },
    { date: '19/02/25', description: 'Added column priority to tasks' }
];

// Crea il popup del version log
function createVersionLogPopup() {
    // Crea l'overlay
    const overlay = document.createElement('div');
    overlay.id = 'version-overlay';
    overlay.className = 'version-overlay';
    document.body.appendChild(overlay);

    // Crea il popup
    const popup = document.createElement('div');
    popup.id = 'version-log';
    popup.className = 'version-log';
    
    // Crea il contenuto del popup
    popup.innerHTML = `
        <h2>Version History</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                ${versionLogData.map(entry => `
                    <tr>
                        <td>${entry.date}</td>
                        <td>${entry.description}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    document.body.appendChild(popup);
}

// Funzione per aggiornare il testo della versione con il nome utente
function updateVersionText() {
    const versionTextElement = document.getElementById('version-text');
    if (!versionTextElement) {
        // Logga se l'elemento non viene trovato (potrebbe non essere ancora stato creato)
        // console.warn("Elemento #version-text non ancora disponibile per l'aggiornamento.");
        return;
    }

    // Recupera i dati dell'utente dal localStorage
    const userData = localStorage.getItem('user');
    let userName = 'User'; // Nome di default se non trovato o in caso di logout
    if (userData) {
        try {
            const user = JSON.parse(userData);
            if (user && user.name) {
                userName = user.name;
            }
        } catch (e) {
            // Logga l'errore nel parsing dei dati utente
            console.error("Errore nel parsing dei dati utente dal localStorage:", e);
        }
    }

    // Imposta il testo combinato: versione e nome utente
    versionTextElement.textContent = `V3.6 - ${userName}`;
}


// Inizializza il version log
function initializeVersionLog() {
    // Crea il testo della versione nel menu
    const nav = document.querySelector('nav');
     // Verifica se l'elemento nav esiste prima di procedere
    if (!nav) {
        console.error("Elemento <nav> non trovato nel DOM.");
        return; // Interrompi l'esecuzione se nav non è trovato
    }
    const versionText = document.createElement('div');
    versionText.id = 'version-text';
    versionText.className = 'version-text';
    
    // Inserisci l'elemento nel DOM prima di tentare di aggiornarlo
    const logo = nav.querySelector('.logo');
    if (logo && logo.parentNode) {
        logo.parentNode.insertBefore(versionText, logo.nextSibling);
    } else {
        console.error("Logo o suo parent non trovato, impossibile inserire #version-text.");
        return; // Interrompi se non si può inserire l'elemento
    }

    // Imposta il testo iniziale chiamando la funzione di aggiornamento
    updateVersionText(); 

    // Crea il popup
    createVersionLogPopup();

    // Gestione degli eventi
    const overlay = document.getElementById('version-overlay');
    const popup = document.getElementById('version-log');

    versionText.addEventListener('click', () => {
        popup.classList.add('show');
        overlay.classList.add('show');
    });

    overlay.addEventListener('click', () => {
        popup.classList.remove('show');
        overlay.classList.remove('show');
    });
}

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', initializeVersionLog);

// Ascolta i cambiamenti di autenticazione per aggiornare il nome utente
window.addEventListener('authChange', updateVersionText);
