/**
 * Modulo di utilità per project-history
 * Contiene funzioni di utilità generiche utilizzate in tutto il progetto
 */

// Funzione di utilità per gestire gli errori di rete
export function handleNetworkError(error) {
    console.error('Network error:', error);
    // Se l'errore è di tipo network (offline) o 401 (non autorizzato)
    if (!navigator.onLine || (error.response && error.response.status === 401)) {
        window.location.replace('login.html');
    }
}

// Funzione per gestire le risposte delle API
export async function handleResponse(response) {
    if (response.status === 401) {
        window.location.replace('login.html');
        throw new Error('Unauthorized');
    }
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Verifica se c'è contenuto da processare
    const contentType = response.headers.get('content-type');
    
    // Se non c'è content-type o è vuoto, restituisci un oggetto vuoto
    if (!contentType || contentType.trim() === '') {
        console.log('Risposta senza content-type, assumo risposta vuota');
        return {};
    }
    
    // Se è JSON, usa json()
    if (contentType.includes('application/json')) {
        try {
            return await response.json();
        } catch (error) {
            console.error('Errore nel parsing JSON della risposta:', error);
            return {};
        }
    }
    
    // Se è testo, usa text()
    if (contentType.includes('text/')) {
        return { text: await response.text() };
    }
    
    // Per altri tipi, restituisci un oggetto con le informazioni di base
    return { 
        status: response.status, 
        statusText: response.statusText, 
        contentType 
    };
}

/**
 * Verifica se un file è compatibile con OnlyOffice
 * @param {string} filename - Nome del file da verificare
 * @returns {boolean} - true se il file è compatibile, false altrimenti
 */
export function isOnlyOfficeCompatible(filename) {
    const supportedExtensions = [
        '.docx', '.doc', '.odt', '.rtf', '.txt',
        '.xlsx', '.xls', '.ods',
        '.pptx', '.ppt', '.odp'
    ];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return supportedExtensions.includes(extension);
}

/**
 * Normalizza il percorso del file per l'URL di OnlyOffice
 * @param {string} filepath - Percorso completo del file
 * @returns {string} - Percorso normalizzato
 */
export function normalizeFilePath(filepath) {
    // Trova l'indice di 'uploads' nel percorso
    const uploadsIndex = filepath.indexOf('uploads');
    if (uploadsIndex === -1) return filepath;
    
    // Prendi la parte del percorso dopo 'uploads'
    const relativePath = filepath.slice(uploadsIndex);
    
    // Sostituisci tutti i backslash con forward slash
    return relativePath.split('\\').join('/');
}
