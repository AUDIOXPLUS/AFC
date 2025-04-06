// Dati del version log (ristrutturati per leggibilità)
const versionLogData = [
    // 06/04/25
    { date: '06/04/25', description: 'Added cancel button to project creation/edit form' },
    { date: '06/04/25', description: 'Restricted Configuration page access for non-admin users' },
    { date: '06/04/25', description: 'Implemented client/factory dropdowns for new projects' },
    { date: '06/04/25', description: 'Ensured full filename visibility on hover' },
    { date: '06/04/25', description: 'Enabled file forwarding in project history' },
    { date: '06/04/25', description: 'Stabilized page load progress bar' },
    { date: '06/04/25', description: 'Fixed Edge browser visibility issues' },
    { date: '06/04/25', description: 'Added projects counting display' },
    // 03/04/25
    { date: '03/04/25', description: 'Fixed duplicated projects issue' },
    { date: '03/04/25', description: 'Fixed project history save bug' },
    // 02/04/25
    { date: '02/04/25', description: 'Implemented progress bar' },
    { date: '02/04/25', description: 'Fixed minor bugs' },
    // 29/03/25
    { date: '29/03/25', description: 'Improved project and history loading speed' },
    { date: '29/03/25', description: 'Implemented clipboard synchronization' },
    // 28/03/25
    { date: '28/03/25', description: 'Implemented change password form' },
    { date: '28/03/25', description: 'Implemented urgent task prioritization' },
    { date: '28/03/25', description: 'Separated autoassigned tasks from calculations' },
    { date: '28/03/25', description: 'Enhanced visibility of new tasks' },
    // 21/03/25
    { date: '21/03/25', description: 'Implemented reply and forward for project history records' },
    { date: '21/03/25', description: 'Added global statistics for tasks' },
    // 27/02/25
    { date: '27/02/25', description: 'Implemented private record sharing with other users' },
    { date: '27/02/25', description: 'Fixed icon display bugs in project history' },
    { date: '27/02/25', description: 'Improved mobile device display' },
    // 20/02/25
    { date: '20/02/25', description: 'Added preview all and download all files' },
    // 19/02/25
    { date: '19/02/25', description: 'Fixed bugs for private records' },
    { date: '19/02/25', description: 'Added version log feature' }, // Riformulato
    { date: '19/02/25', description: 'Fixed full screen view issue' }, // Riformulato
    { date: '19/02/25', description: 'Fixed priority sorting issue' }, // Riformulato
    { date: '19/02/25', description: 'Added priority column to tasks' } // Riformulato
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

    let tableBodyContent = '';
    let lastDate = null;

    versionLogData.forEach((entry, index) => {
        // Aggiungi un separatore se la data è cambiata (e non è la prima riga)
        if (lastDate !== null && entry.date !== lastDate) {
            tableBodyContent += `<tr class="date-separator"><td colspan="2"></td></tr>`;
        }
        // Aggiungi la riga del log
        tableBodyContent += `
            <tr>
                <td>${entry.date === lastDate ? '' : entry.date}</td>
                <td>${entry.description}</td>
            </tr>
        `;
        lastDate = entry.date; // Aggiorna l'ultima data vista
    });
    
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
                ${tableBodyContent}
            </tbody>
        </table>
    `;
    
    document.body.appendChild(popup);
}

// Funzione per aggiornare il testo della versione con il nome utente
function updateVersionText() {
    const versionTextElement = document.getElementById('version-text');
    if (!versionTextElement) {
        return;
    }

    const userData = localStorage.getItem('user');
    let userName = 'User'; 
    if (userData) {
        try {
            const user = JSON.parse(userData);
            if (user && user.name) {
                userName = user.name;
            }
        } catch (e) {
            console.error("Errore nel parsing dei dati utente dal localStorage:", e);
        }
    }

    versionTextElement.textContent = `V3.6 - ${userName}`;
}


// Inizializza il version log
function initializeVersionLog() {
    const nav = document.querySelector('nav');
    if (!nav) {
        console.error("Elemento <nav> non trovato nel DOM.");
        return; 
    }
    const versionText = document.createElement('div');
    versionText.id = 'version-text';
    versionText.className = 'version-text';
    
    const logo = nav.querySelector('.logo');
    if (logo && logo.parentNode) {
        logo.parentNode.insertBefore(versionText, logo.nextSibling);
    } else {
        console.error("Logo o suo parent non trovato, impossibile inserire #version-text.");
        return; 
    }

    updateVersionText(); 
    createVersionLogPopup();

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

document.addEventListener('DOMContentLoaded', initializeVersionLog);
window.addEventListener('authChange', updateVersionText);
