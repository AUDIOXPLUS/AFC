// Funzione di utilità per gestire le richieste fetch con gestione del cursore
window.handleFetchWithCursor = async function(fetchPromise) {
    try {
        const response = await fetchPromise;
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Errore nella richiesta:', error);
        throw error;
    }
};
