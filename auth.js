// Funzione per verificare lo stato di autenticazione dell'utente
async function checkAuthStatus() {
    try {
        // Effettua una chiamata all'endpoint di verifica sessione
        const response = await fetch('/api/session-user');
        
        // Se la risposta è 401 (non autorizzato), l'utente non è autenticato
        if (response.status === 401) {
            return false;
        }
        
        // Per altri errori (es. 404, 500), reindirizza al login
        if (!response.ok) {
            window.location.href = '/login.html';
            return false;
        }

        const data = await response.json();
        
        // Se la risposta contiene i dati dell'utente (id, username, name), l'utente è autenticato
        if (data.id && data.username && data.name) {
            return true;
        }
        
        // Se non ci sono dati utente validi, reindirizza al login
        window.location.href = '/login.html';
        return false;
    } catch (error) {
        console.error('Errore durante la verifica dell\'autenticazione:', error);
        window.location.href = '/login.html';
        return false;
    }
}
