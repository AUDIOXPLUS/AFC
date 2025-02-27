// Dati del version log
const versionLogData = [
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

// Inizializza il version log
function initializeVersionLog() {
    // Crea il testo della versione nel menu
    const nav = document.querySelector('nav');
    const versionText = document.createElement('div');
    versionText.id = 'version-text';
    versionText.className = 'version-text';
    versionText.textContent = 'V3.4';
    
    // Inserisci il testo della versione dopo il logo
    const logo = nav.querySelector('.logo');
    logo.parentNode.insertBefore(versionText, logo.nextSibling);

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
