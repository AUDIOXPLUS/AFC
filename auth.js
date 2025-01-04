// Funzione per verificare lo stato di autenticazione dell'utente
async function checkAuthStatus() {
    try {
        // Effettua una chiamata all'endpoint di verifica sessione
        const response = await fetch('/session-user');
        const data = await response.json();
        
        // Se la risposta contiene i dati dell'utente (id, username, name), l'utente è autenticato
        if (data.id && data.username && data.name) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Errore durante la verifica dell\'autenticazione:', error);
        return false;
    }
}
