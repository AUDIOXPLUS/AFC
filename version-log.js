// Dati del version log (ristrutturati per leggibilità)
const versionLogData = [
    // 15/08/25 - V4.4
    { 
        date: '15/08/25', 
        version: 'V4.4', 
        description: 'implemented global search'
    },
    // 14/06/25 - V4.3
    { 
        date: '14/06/25', 
        version: 'V4.3', 
        description: 'fixed clone merge function'
    },
    { 
        date: '14/06/25', 
        version: 'V4.3', 
        description: 'implemented Speaker Database menu section. now it\'s possible to compare speakers all together'
    },
    { 
        date: '14/06/25', 
        version: 'V4.3', 
        description: 'implemented "CC" when replying or forwarding tasks. use the CC button in "assigned to" column'
    },
    // 12/06/25 - V4.2
    { 
        date: '12/06/25', 
        version: 'V4.2', 
        description: 'all file preview can now show pdf etc'
    },
    { 
        date: '12/06/25', 
        version: 'V4.2', 
        description: 'graph viewer now is more intuitive'
    },
    // 29/05/25 - V4.1
    { 
        date: '29/05/25', 
        version: 'V4.1', 
        description: 'Implemented curves viewer for txt curves (no need anymore Clio for comparing curves)'
    },
    { 
        date: '29/05/25', 
        version: 'V4.1', 
        description: 'Implemented drag & drop directly from chat app messages (wechat, teams, etc)'
    },
    // 28/05/25 - V4.0
    { 
        date: '28/05/25', 
        version: 'V4.0', 
        description: 'Implemented 3D step file integrated preview/measurement'
    },
    // 18/04/25 - V3.9
    { 
        date: '18/04/25', 
        version: 'V3.9', 
        description: 'Implemented phase highlight feature'
    },
    { 
        date: '18/04/25', 
        version: 'V3.9', 
        description: 'Fixed page resizing issues'
    },
    { 
        date: '18/04/25', 
        version: 'V3.9', 
        description: 'Fixed various translation bugs'
    },
    // 13/04/25 - V3.8
    { 
        date: '13/04/25', 
        version: 'V3.8', 
        description: 'Implemented Chinese language support and translation system'
    },
    // 09/04/25 - V3.7
    { 
        date: '09/04/25', 
        version: 'V3.7', 
        description: `
            <strong>Progress Bar Squares: Colors and Interactions</strong>
            <div class="version-details">
                <p><strong>Understanding the Progress Bar</strong></p>
                <p>The progress bar displays squares that provide visual information about project phases:</p>
                <ul class="sub-list">
                    <li>Pulsating orange square: Indicates that a record has been recently updated in this phase</li>
                    <li>Different colored squares: Each color represents a specific status</li>
                    <li>Yellow: Phase has tasks "In Progress"</li>
                    <li>Green: Phase has "Completed" tasks with no "In Progress" tasks</li>
                    <li>Red: Phase has no activity but later phases are active</li>
                    <li>Grey: Phase has no activity and no later phases are active</li>
                </ul>
                <p><strong>New Interactive Features</strong></p>
                <p>The progress bar squares now offer two different interactions:</p>
                <ul class="sub-list">
                    <li><strong>Clicking on a pulsating square:</strong></li>
                    <li>Opens the project details page</li>
                    <li>Automatically highlights the recently updated entry in the history with an orange border</li>
                    <li>Helps you quickly identify which record was updated</li>
                    <li><strong>Clicking on a non-pulsating square:</strong></li>
                    <li>Opens the project details page</li>
                    <li>Automatically filters the history to show only entries from that phase</li>
                    <li>Eliminates the need to manually select filters</li>
                </ul>
                <p>This feature makes navigation more efficient by providing direct access to filtered information or highlighting recent updates with a single click.</p>
            </div>
        `
    },
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

    // Aggiungi stili CSS per le sottoliste e i dettagli
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
        }
        .version-text.new-version {
            animation: blink 1.5s infinite;
            color: #ff9900;
            font-weight: bold;
        }
        .version-details {
            margin-left: 0;
            margin-top: 5px;
            font-size: 0.95em;
        }
        
        .version-details p {
            margin: 8px 0;
        }
        
        .sub-list {
            margin-top: 5px;
            margin-bottom: 10px;
            padding-left: 20px;
        }
        
        .version-log li.feature-item {
            margin-bottom: 15px;
        }
    `;
    document.head.appendChild(styleElement);

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
    let contentHTML = `<h2>Change Log</h2>`;
    contentHTML += `<span class="version-close-btn">&times;</span>`;
    
    const today = new Date();
    const twoDaysLater = new Date();
    twoDaysLater.setDate(today.getDate() + 2);
    
    sortedVersions.forEach(group => {
        const dateFormatted = group.date;  // In futuro si potrebbe formattare meglio
        const [day, month, year] = group.date.split('/');
        const versionDate = new Date(Date.UTC(2000 + parseInt(year), 
                                            parseInt(month) - 1, 
                                            parseInt(day)));
        
            contentHTML += `
                <div class="version-header">[${group.version}] - ${dateFormatted}</div>
            <ul>
                ${group.items.map(item => `<li class="feature-item">${item}</li>`).join('')}
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

    // Get the most recent version (V4.4)
    const currentVersion = 'V4.4';
    versionTextElement.textContent = `${currentVersion} - ${userName}`;
}

// Inizializza il version log
function initializeVersionLog() {
    const userInfo = document.querySelector('.user-info');
    if (!userInfo) {
        console.error("Elemento .user-info non trovato nel DOM.");
        return; 
    }
    
    const versionText = document.createElement('div');
    versionText.id = 'version-text';
    versionText.className = 'version-text';
    
    // Inserisci il link versione come primo elemento nella user-info (prima della campanellina)
    const notificationBell = userInfo.querySelector('.notification-bell');
    if (notificationBell) {
        userInfo.insertBefore(versionText, notificationBell);
    } else {
        // Se non c'è la campanellina, inseriscilo come primo figlio
        userInfo.insertBefore(versionText, userInfo.firstChild);
    }

    updateVersionText();
    
    // Rimossa classe per effetto lampeggiante come richiesto
    // if (versionText) {
    //     versionText.classList.add('new-version');
    // }
    
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
