/**
 * Modulo per la gestione della privacy e condivisione delle voci della cronologia
 * Contiene funzioni per impostare la privacy e condividere le voci con altri utenti
 */

import { handleNetworkError, handleResponse } from './utils.js';
import { fetchProjectHistory } from './entries.js';

/**
 * Mostra un modale per la condivisione di un'entry privata con altri utenti
 * @param {number} entryId - L'ID dell'entry da condividere
 * @param {number} projectId - L'ID del progetto
 */
export async function showSharingModal(entryId, projectId) {
    // Crea il modale
    const modal = document.createElement('div');
    modal.className = 'sharing-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';
    
    // Crea il contenuto del modale
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '500px';
    modalContent.style.maxWidth = '90%';
    modalContent.style.maxHeight = '80%';
    modalContent.style.overflowY = 'auto';
    
    // Titolo del modale
    const title = document.createElement('h2');
    title.textContent = 'Share with other users';
    title.style.marginBottom = '20px';
    modalContent.appendChild(title);
    
    // Caricamento degli utenti
    const loadingMessage = document.createElement('p');
    loadingMessage.textContent = 'Loading users...';
    modalContent.appendChild(loadingMessage);
    
    // Aggiungi il modale al body
    document.body.appendChild(modal);
    modal.appendChild(modalContent);
    
    // Funzione per chiudere il modale
    const closeModal = () => {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
    };
    
    // Funzione per mostrare un messaggio di errore
    const showError = (message) => {
        if (modalContent.contains(loadingMessage)) {
            modalContent.removeChild(loadingMessage);
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.marginBottom = '20px';
        errorDiv.textContent = message;
        modalContent.appendChild(errorDiv);
        
        // Pulsante di chiusura
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.padding = '5px 10px';
        closeBtn.addEventListener('click', closeModal);
        modalContent.appendChild(closeBtn);
    };
    
    try {
        // Verifica se il record è privato
        const entry = document.querySelector(`tr[data-entry-id='${entryId}']`);
        const isPrivate = entry && entry.querySelector('.privacy-btn').classList.contains('text-danger');
        
        // Recupera gli utenti disponibili
        let users = [];
        try {
            const usersResponse = await fetch('/api/team-members');
            if (usersResponse.status === 401) {
                // Reindirizza alla pagina di login se non autenticato
                alert("Your session has expired. Please log in again.");
                window.location.replace('login.html');
                return;
            }
            if (!usersResponse.ok) {
                throw new Error(`HTTP error! status: ${usersResponse.status}`);
            }
            users = await usersResponse.json();
        } catch (error) {
            console.error('Error loading team members:', error);
            showError('Error loading users. Please check your connection and try again.');
            return;
        }
        
        let sharedUsers = [];
        // Recupera gli utenti con cui è già condiviso solo se il record è privato
        if (isPrivate) {
            try {
                const sharedResponse = await fetch(`/api/projects/${projectId}/history/${entryId}/shared-users`);
                if (sharedResponse.status === 401) {
                    // Reindirizza alla pagina di login se non autenticato
                    alert("Your session has expired. Please log in again.");
                    window.location.replace('login.html');
                    return;
                }
                if (sharedResponse.ok) {
                    sharedUsers = await sharedResponse.json();
                } else {
                    console.warn(`Error loading shared users: ${sharedResponse.status}`);
                    // Continua comunque, potrebbe essere un record appena reso privato
                }
            } catch (error) {
                console.warn('Non è stato possibile recuperare gli utenti condivisi:', error);
                // Continua comunque, potrebbe essere un record appena reso privato
            }
        }
        
        // Rimuovi il messaggio di caricamento
        if (modalContent.contains(loadingMessage)) {
            modalContent.removeChild(loadingMessage);
        }
        
        // Crea la lista degli utenti
        const usersList = document.createElement('div');
        usersList.style.marginBottom = '20px';
        usersList.style.maxHeight = '300px';
        usersList.style.overflowY = 'auto';
        
        // Filtra l'utente corrente dalla lista
        const filteredUsers = users.filter(user => String(user.id) !== window.currentUserId);
        
        if (filteredUsers.length === 0) {
            const noUsersMessage = document.createElement('p');
            noUsersMessage.textContent = 'No other users available to share with.';
            usersList.appendChild(noUsersMessage);
        } else {
            // Crea un array di ID degli utenti con cui è già condiviso
            const sharedUserIds = sharedUsers.map(user => String(user.id));
            
            // Aggiungi ogni utente alla lista
            filteredUsers.forEach(user => {
                const userItem = document.createElement('div');
                userItem.style.display = 'flex';
                userItem.style.alignItems = 'center';
                userItem.style.marginBottom = '10px';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `user-${user.id}`;
                checkbox.value = user.id;
                checkbox.checked = sharedUserIds.includes(String(user.id));
                checkbox.style.marginRight = '10px';
                
                const label = document.createElement('label');
                label.htmlFor = `user-${user.id}`;
                label.textContent = user.name;
                
                userItem.appendChild(checkbox);
                userItem.appendChild(label);
                usersList.appendChild(userItem);
            });
        }
        
        modalContent.appendChild(usersList);
        
        // Pulsanti di azione
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.justifyContent = 'flex-end';
        buttonsContainer.style.gap = '10px';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', closeModal);
        
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', async () => {
            // Disabilita i pulsanti durante il salvataggio
            saveBtn.disabled = true;
            cancelBtn.disabled = true;
            
            // Raccogli gli ID degli utenti selezionati
            const selectedUsers = Array.from(usersList.querySelectorAll('input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            
            // Crea un div per i messaggi di stato
            const statusDiv = document.createElement('div');
            statusDiv.style.marginTop = '10px';
            statusDiv.style.padding = '5px';
            statusDiv.style.borderRadius = '3px';
            buttonsContainer.parentNode.insertBefore(statusDiv, buttonsContainer);
            
            // Mostra un messaggio di caricamento
            statusDiv.style.backgroundColor = '#e6f7ff';
            statusDiv.style.border = '1px solid #91d5ff';
            statusDiv.textContent = 'Saving privacy settings...';
            
            try {
                console.log('Sending privacy update request:', {
                    private: true,
                    sharedWith: selectedUsers
                });
                
                // Aggiorna la privacy con gli utenti selezionati
                const response = await fetch(`/api/projects/${projectId}/history/${entryId}/privacy`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        private: true,
                        sharedWith: selectedUsers
                    })
                });
                
                console.log('Privacy update response status:', response.status);
                
                if (response.status === 401) {
                    // Reindirizza alla pagina di login se non autenticato
                    alert("Your session has expired. Please log in again.");
                    window.location.replace('login.html');
                    return;
                }
                
                // Ottieni il testo della risposta per il debug
                const responseText = await response.text();
                console.log('Privacy update response text:', responseText);
                
                // Prova a parsare la risposta come JSON
                let result;
                try {
                    result = JSON.parse(responseText);
                    console.log('Privacy updated:', result);
                } catch (parseError) {
                    console.error('Error parsing response as JSON:', parseError);
                    throw new Error(`Invalid JSON response: ${responseText}`);
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}, message: ${result.error || responseText}`);
                }
                
                // Aggiorna lo stato del modale
                statusDiv.style.backgroundColor = '#f6ffed';
                statusDiv.style.border = '1px solid #b7eb8f';
                statusDiv.textContent = 'Privacy settings saved successfully!';
                
                // Aggiorna l'UI
                const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
                if (row) {
                    const privacyBtn = row.querySelector('.privacy-btn');
                    if (privacyBtn) {
                        privacyBtn.className = 'privacy-btn text-danger';
                        const privacyIcon = privacyBtn.querySelector('i');
                        if (privacyIcon) {
                            privacyIcon.className = 'fas fa-lock';
                        }
                    }
                }
                
                // Chiudi il modale dopo un breve ritardo
                setTimeout(() => {
                    closeModal();
                    
                    // Aggiorna il phase summary
                    if (typeof window.updatePhaseSummary === 'function') {
                        window.updatePhaseSummary();
                    }
                }, 1000);
            } catch (e) {
                console.error('Error updating privacy:', e);
                
                // Aggiorna lo stato del modale
                statusDiv.style.backgroundColor = '#fff1f0';
                statusDiv.style.border = '1px solid #ffa39e';
                statusDiv.textContent = `Error: ${e.message || 'Failed to update privacy settings'}`;
                
                // Riabilita i pulsanti
                saveBtn.disabled = false;
                cancelBtn.disabled = false;
            }
        });
        
        const makePublicBtn = document.createElement('button');
        makePublicBtn.textContent = 'Make Public';
        makePublicBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to make this record public?')) {
                // Disabilita i pulsanti durante il salvataggio
                makePublicBtn.disabled = true;
                cancelBtn.disabled = true;
                saveBtn.disabled = true;
                
                // Crea un div per i messaggi di stato
                const statusDiv = document.createElement('div');
                statusDiv.style.marginTop = '10px';
                statusDiv.style.padding = '5px';
                statusDiv.style.borderRadius = '3px';
                buttonsContainer.parentNode.insertBefore(statusDiv, buttonsContainer);
                
                // Mostra un messaggio di caricamento
                statusDiv.style.backgroundColor = '#e6f7ff';
                statusDiv.style.border = '1px solid #91d5ff';
                statusDiv.textContent = 'Making record public...';
                
                try {
                    console.log('Sending make public request');
                    
                    // Rendi pubblico il record
                    const response = await fetch(`/api/projects/${projectId}/history/${entryId}/privacy`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            private: false
                        })
                    });
                    
                    console.log('Make public response status:', response.status);
                    
                    if (response.status === 401) {
                        // Reindirizza alla pagina di login se non autenticato
                        alert("Your session has expired. Please log in again.");
                        window.location.replace('login.html');
                        return;
                    }
                    
                    // Ottieni il testo della risposta per il debug
                    const responseText = await response.text();
                    console.log('Make public response text:', responseText);
                    
                    // Prova a parsare la risposta come JSON
                    let result;
                    try {
                        result = JSON.parse(responseText);
                        console.log('Privacy updated:', result);
                    } catch (parseError) {
                        console.error('Error parsing response as JSON:', parseError);
                        throw new Error(`Invalid JSON response: ${responseText}`);
                    }
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}, message: ${result.error || responseText}`);
                    }
                    
                    // Aggiorna lo stato del modale
                    statusDiv.style.backgroundColor = '#f6ffed';
                    statusDiv.style.border = '1px solid #b7eb8f';
                    statusDiv.textContent = 'Record is now public!';
                    
                    // Aggiorna l'UI
                    const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
                    if (row) {
                        const privacyBtn = row.querySelector('.privacy-btn');
                        if (privacyBtn) {
                            privacyBtn.className = 'privacy-btn text-dark';
                            const privacyIcon = privacyBtn.querySelector('i');
                            if (privacyIcon) {
                                privacyIcon.className = 'fas fa-unlock';
                            }
                        }
                    }
                    
                    // Chiudi il modale dopo un breve ritardo
                    setTimeout(() => {
                        closeModal();
                        
                        // Aggiorna il phase summary
                        if (typeof window.updatePhaseSummary === 'function') {
                            window.updatePhaseSummary();
                        }
                    }, 1000);
                } catch (e) {
                    console.error('Error updating privacy:', e);
                    
                    // Aggiorna lo stato del modale
                    statusDiv.style.backgroundColor = '#fff1f0';
                    statusDiv.style.border = '1px solid #ffa39e';
                    statusDiv.textContent = `Error: ${e.message || 'Failed to make record public'}`;
                    
                    // Riabilita i pulsanti
                    makePublicBtn.disabled = false;
                    cancelBtn.disabled = false;
                    saveBtn.disabled = false;
                }
            }
        });
        
        // Se il record è già privato, mostra il pulsante "Make Public"
        if (isPrivate) {
            buttonsContainer.appendChild(makePublicBtn);
        }
        
        buttonsContainer.appendChild(cancelBtn);
        buttonsContainer.appendChild(saveBtn);
        modalContent.appendChild(buttonsContainer);
    } catch (e) {
        console.error('Error in sharing modal:', e);
        showError('An unexpected error occurred. Please try again later.');
    }
}

/**
 * Aggiorna le impostazioni di privacy di una voce della cronologia
 * @param {number} entryId - L'ID della voce della cronologia
 * @param {number} projectId - L'ID del progetto
 * @param {boolean} isPrivate - Se la voce deve essere privata o pubblica
 * @param {Array<string>} sharedWith - Array di ID utenti con cui condividere la voce (solo se isPrivate è true)
 * @returns {Promise<Object>} - Risposta del server
 */
export async function updatePrivacy(entryId, projectId, isPrivate, sharedWith = []) {
    try {
        const requestBody = {
            private: isPrivate
        };
        
        if (isPrivate) {
            requestBody.sharedWith = sharedWith;
        }
        
        const response = await fetch(`/api/projects/${projectId}/history/${entryId}/privacy`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestBody)
        });
        
        if (response.status === 401) {
            // Reindirizza alla pagina di login se non autenticato
            alert("Your session has expired. Please log in again.");
            window.location.replace('login.html');
            throw new Error('Unauthorized');
        }
        
        const result = await handleResponse(response);
        
        // Aggiorna l'UI
        const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
        if (row) {
            const privacyBtn = row.querySelector('.privacy-btn');
            if (privacyBtn) {
                privacyBtn.className = isPrivate ? 'privacy-btn text-danger' : 'privacy-btn text-dark';
                const privacyIcon = privacyBtn.querySelector('i');
                if (privacyIcon) {
                    privacyIcon.className = isPrivate ? 'fas fa-lock' : 'fas fa-unlock';
                }
            }
        }
        
        // Aggiorna la cronologia
        await fetchProjectHistory(projectId);
        
        return result;
    } catch (error) {
        handleNetworkError(error);
        throw error;
    }
}

/**
 * Recupera gli utenti con cui è condivisa una voce della cronologia
 * @param {number} entryId - L'ID della voce della cronologia
 * @param {number} projectId - L'ID del progetto
 * @returns {Promise<Array>} - Array di oggetti utente
 */
export async function getSharedUsers(entryId, projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history/${entryId}/shared-users`);
        return await handleResponse(response);
    } catch (error) {
        handleNetworkError(error);
        return [];
    }
}
