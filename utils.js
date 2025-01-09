// Funzione di utilità per gestire le richieste fetch con gestione del cursore
window.handleFetchWithCursor = async function(fetchPromise) {
    try {
        const response = await fetchPromise;
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Controlla il Content-Type della risposta
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
    } catch (error) {
        console.error('Errore nella richiesta:', error);
        throw error;
    }
};
