// Inizializzazione dell'applicazione
console.log('Applicazione di gestione aziendale avviata');

// Gestione autenticazione
const loginForm = document.getElementById('loginForm');
const message = document.getElementById('message');

loginForm.addEventListener('submit', function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Simulazione autenticazione
    if (username === 'admin' && password === 'admin') {
        message.textContent = 'Login effettuato con successo!';
        message.style.color = 'green';
        window.location.href = 'dashboard.html';
    } else {
        message.textContent = 'Credenziali non valide.';
        message.style.color = 'red';
    }
});