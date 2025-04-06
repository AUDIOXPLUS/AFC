// Function to check user authentication status
async function checkAuthStatus() {
    try {
        // Make a call to the session verification endpoint
        const response = await fetch('/api/session-user', { cache: 'no-store' });
        
        // Log per debug
        console.log('Auth check response:', {
            status: response.status,
            ok: response.ok
        });
        
        // If response is 401 (unauthorized), user is not authenticated
        if (response.status === 401) {
            console.log('Auth check: Unauthorized');
            return false;
        }
        
        // For other errors (e.g., 404, 500), redirect to login
        if (!response.ok) {
            console.log('Auth check: Server error');
            window.location.href = '/login.html';
            return false;
        }

        const data = await response.json();
        
        // Log per debug
        console.log('Auth check data:', data);
        
        // If response contains user data (id, username, name, permissions), user is authenticated
        if (data.id && data.username && data.name && data.permissions) { // Aggiunto controllo per data.permissions
            console.log('Auth check: User authenticated with permissions');
             console.log('Permissions received:', data.permissions); // Log dei permessi ricevuti
            // Salva i dati dell'utente (inclusi i permessi) nel localStorage
            localStorage.setItem('user', JSON.stringify(data));
            // Invia un evento per notificare il cambio di stato dell'autenticazione
            window.dispatchEvent(new CustomEvent('authChange', { detail: data }));
            return true;
        } else if (data.id && data.username && data.name) {
             // Caso fallback se l'API non restituisce i permessi (per sicurezza)
             console.warn('Auth check: User authenticated but permissions missing in response.');
             localStorage.setItem('user', JSON.stringify({ ...data, permissions: {} })); // Salva con permessi vuoti
             window.dispatchEvent(new CustomEvent('authChange', { detail: { ...data, permissions: {} } }));
             return true;
        }
        
        // Se non ci sono dati utente validi, pulisci localStorage e invia evento
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('authChange', { detail: null }));
        console.log('Auth check: Invalid user data');
        window.location.href = '/login.html';
        return false;
    } catch (error) {
        // In caso di errore, pulisci localStorage e invia evento
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('authChange', { detail: null }));
        console.error('Errore durante la verifica dell\'autenticazione:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// Function to check authentication on page load
async function checkAuthOnLoad() {
    // Don't check auth on login page
    if (window.location.pathname === '/login.html') {
        return;
    }
    
    const isAuthenticated = await checkAuthStatus();
    if (!isAuthenticated) {
        window.location.href = '/login.html';
    }
}

// Export functions for use in other files
window.checkAuthStatus = checkAuthStatus;
window.checkAuthOnLoad = checkAuthOnLoad;

// Funzione per controllare un permesso specifico (es. 'Configuration.read')
function checkPermission(permissionName) {
    const userDataString = localStorage.getItem('user');
    if (!userDataString) {
        console.warn('Dati utente non trovati nel localStorage per il controllo permessi.');
        return false; // Nessun utente, nessun permesso
    }
    try {
        const userData = JSON.parse(userDataString);
        // Naviga nell'oggetto permessi. Es: 'Configuration.read' -> userData.permissions['Configuration']?.read
        const keys = permissionName.split('.');
        let currentPerm = userData.permissions;
        for (const key of keys) {
            if (currentPerm && typeof currentPerm === 'object' && key in currentPerm) {
                currentPerm = currentPerm[key];
            } else {
                currentPerm = undefined; // Permesso non trovato
                break;
            }
        }
        const hasPermission = currentPerm === true;
        console.log(`Controllo permesso per ${permissionName}: ${hasPermission}`); // Log del controllo
        return hasPermission;
    } catch (error) {
        console.error('Errore nel parsing dei dati utente o controllo permessi:', error);
        return false; // Errore, nega l'accesso per sicurezza
    }
}

// Funzione per aggiornare la visibilità degli elementi di navigazione in base ai permessi
function updateNavigationMenu() {
    console.log('Aggiornamento menu di navigazione...'); // Log
    // Nasconde/Mostra il link Configuration
    const configLink = document.querySelector('a[href="configuration.html"]');
    if (configLink) {
        // Controlliamo il permesso di lettura per la pagina Configuration
        if (checkPermission('Configuration.read')) {
            console.log('Permesso Configuration.read accordato, mostra link.'); // Log
            configLink.style.display = ''; // Mostra (rimuove lo stile inline 'display: none')
        } else {
            console.log('Permesso Configuration.read negato, nascondi link.'); // Log
            configLink.style.display = 'none'; // Nascondi
        }
    } else {
        console.warn('Link configuration.html non trovato nel DOM.'); // Log se il link non esiste
    }

    // Aggiungere qui logica per altri link/elementi basati sui permessi se necessario
}


// Check authentication when page loads and update UI based on permissions
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthOnLoad(); // Assicurati che l'autenticazione sia verificata prima
    updateNavigationMenu(); // Aggiorna il menu in base ai permessi iniziali
});

// Aggiorna il menu anche quando i dati dell'utente cambiano (es. dopo login/logout)
window.addEventListener('authChange', (event) => {
    console.log('Evento authChange ricevuto, aggiornamento menu...'); // Log
    updateNavigationMenu();
});
