document.addEventListener('DOMContentLoaded', function() {
    initializePasswordChange();
});

function initializePasswordChange() {
    const form = document.getElementById('change-password-form');
    const messageDiv = document.getElementById('password-message');
    
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Recupera i valori dai campi
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Validazione dei campi
        if (!currentPassword || !newPassword || !confirmPassword) {
            showMessage(messageDiv, 'All fields are required.', 'error');
            return;
        }
        
        // Verifica che le nuove password corrispondano
        if (newPassword !== confirmPassword) {
            showMessage(messageDiv, 'New passwords do not match.', 'error');
            return;
        }
        
        // Verifica che la password non sia vuota
        if (!validatePassword(newPassword)) {
            showMessage(
                messageDiv, 
                'Password cannot be empty.', 
                'error'
            );
            return;
        }
        
        try {
            // Recupera i dati dalla sessione corrente tramite API piuttosto che localStorage
            const sessionResponse = await fetch('/api/session-user', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!sessionResponse.ok) {
                // Se l'utente non è autenticato, reindirizza al login
                showMessage(messageDiv, 'Session expired, please return to login page.', 'error');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
                return;
            }
            
            // Invia la richiesta al server - utilizzo il percorso corretto dell'API
            const changeResponse = await fetch('/api/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                }),
            });
            
            const data = await changeResponse.json();
            
            if (data.success) {
                showMessage(messageDiv, 'Password changed successfully!', 'success');
                form.reset(); // Pulisce il form
                
                // Reindirizza alla pagina di login dopo 3 secondi
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            } else {
                showMessage(messageDiv, data.message || 'Error changing password.', 'error');
            }
        } catch (error) {
            console.error('Error during password change request:', error);
            showMessage(messageDiv, 'An error occurred while communicating with the server.', 'error');
        }
    });
}

// Funzione per validare la password
function validatePassword(password) {
    // Rimosse tutte le restrizioni - qualsiasi password è valida
    return password.length > 0; // Verifichiamo solo che non sia vuota
}

// Funzione per mostrare messaggi
function showMessage(element, message, type) {
    if (!element) return;
    
    element.textContent = message;
    element.className = 'message'; // Rimuove tutte le classi
    element.classList.add(type); // Aggiunge la classe appropriata
    element.style.display = 'block';
    
    // Rimuove il messaggio dopo 5 secondi se è un messaggio di successo
    if (type === 'success') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}
