// Dati del version log (ristrutturati per leggibilità)
const versionLogData = [
    // 09/04/25 - V3.7
    { date: '09/04/25', version: 'V3.7', description: 'Redesigned version log modal with improved readability' },
    
    // 07/04/25 - V3.6
    { date: '07/04/25', version: 'V3.6', description: 'Added highlight for new updates in phases for project page' },
    { date: '06/04/25', version: 'V3.6', description: 'Removed file delete icon for non-owner users' },
    { date: '06/04/25', version: 'V3.6', description: 'Added cancel button to project creation/edit form' },
    { date: '06/04/25', version: 'V3.6', description: 'Restricted Configuration page access for non-admin users' },
    { date: '06/04/25', version: 'V3.6', description: 'Implemented client/factory dropdowns for new projects' },
    { date: '06/04/25', version: 'V3.6', description: 'Ensured full filename visibility on hover' },
    { date: '06/04/25', version: 'V3.6', description: 'Enabled file forwarding in project history' },
    { date: '06/04/25', version: 'V3.6', description: 'Stabilized page load progress bar' },
    { date: '06/04/25', version: 'V3.6', description: 'Fixed Edge browser visibility issues' },
    { date: '06/04/25', version: 'V3.6', description: 'Added projects counting display' },
    
    // 03/04/25 - V3.5
    { date: '03/04/25', version: 'V3.5', description: 'Fixed duplicated projects issue' },
    { date: '03/04/25', version: 'V3.5', description: 'Fixed project history save bug' },
    { date: '02/04/25', version: 'V3.5', description: 'Implemented progress bar' },
    { date: '02/04/25', version: 'V3.5', description: 'Fixed minor bugs' },
    
    // 29/03/25 - V3.4
    { date: '29/03/25', version: 'V3.4', description: 'Improved project and history loading speed' },
    { date: '29/03/25', version: 'V3.4', description: 'Implemented clipboard synchronization' },
    
    // 28/03/25 - V3.3
    { date: '28/03/25', version: 'V3.3', description: 'Implemented change password form' },
    { date: '28/03/25', version: 'V3.3', description: 'Implemented urgent task prioritization' },
    { date: '28/03/25', version: 'V3.3', description: 'Separated autoassigned tasks from calculations' },
    { date: '28/03/25', version: 'V3.3', description: 'Enhanced visibility of new tasks' },
    
    // 21/03/25 - V3.2
    { date: '21/03/25', version: 'V3.2', description: 'Implemented reply and forward for project history records' },
    { date: '21/03/25', version: 'V3.2', description: 'Added global statistics for tasks' },
    
    // 27/02/25 - V3.1
    { date: '27/02/25', version: 'V3.1', description: 'Implemented private record sharing with other users' },
    { date: '27/02/25', version: 'V3.1', description: 'Fixed icon display bugs in project history' },
    { date: '27/02/25', version: 'V3.1', description: 'Improved mobile device display' },
    
    // 20/02/25 - V3.0
    { date: '20/02/25', version: 'V3.0', description: 'Added preview all and download all files' },
    { date: '19/02/25', version: 'V3.0', description: 'Fixed bugs for private records' },
    { date: '19/02/25', version: 'V3.0', description: 'Added version log feature' },
    { date: '19/02/25', version: 'V3.0', description: 'Fixed full screen view issue' },
    { date: '19/02/25', version: 'V3.0', description: 'Fixed priority sorting issue' },
    { date: '19/02/25', version: 'V3.0', description: 'Added priority column to tasks' }
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

    // Organizza i dati per versione
    const versionGroups = {};
    let currentVersion = null;
    
    versionLogData.forEach(entry => {
        if (!versionGroups[entry.version]) {
            versionGroups[entry.version] = {
                version: entry.version,
                date: entry.date,
                items: []
            };
        }
        
        versionGroups[entry.version].items.push(entry.description);
    });
    
    // Converti l'oggetto in array e ordina per versione (dalla più recente)
    const sortedVersions = Object.values(versionGroups).sort((a, b) => {
        // Estrai i numeri di versione (es. da "V3.7" prende "3.7")
        const versionA = parseFloat(a.version.substring(1));
        const versionB = parseFloat(b.version.substring(1));
        return versionB - versionA;
    });
    
    // Costruisci il contenuto HTML
    let contentHTML = `<h2>Version History</h2>`;
    contentHTML += `<span class="version-close-btn">&times;</span>`;
    
    sortedVersions.forEach(group => {
        const dateFormatted = group.date;  // In futuro si potrebbe formattare meglio
        
        contentHTML += `
            <div class="version-header">[${group.version}] - ${dateFormatted}</div>
            <ul>
                ${group.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
        `;
    });
    
    popup.innerHTML = contentHTML;
    document.body.appendChild(popup);
    
    // Gestione eventi
    const closeBtn = popup.querySelector('.version-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            popup.classList.remove('show');
            overlay.classList.remove('show');
        });
    }
    
    // Manteniamo anche la chiusura cliccando sull'overlay
    overlay.addEventListener('click', () => {
        popup.classList.remove('show');
        overlay.classList.remove('show');
    });
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

    // Prendi sempre la versione più recente
    const currentVersion = versionLogData[0].version;
    versionTextElement.textContent = `${currentVersion} - ${userName}`;
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
}

document.addEventListener('DOMContentLoaded', initializeVersionLog);
window.addEventListener('authChange', updateVersionText);
