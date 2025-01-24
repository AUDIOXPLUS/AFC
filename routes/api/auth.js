const express = require('express');
const router = express.Router();

// Endpoint per il login
router.post('/login', (req, res) => {
    console.log('Tentativo di accesso ricevuto:', req.body);
    const { username, password } = req.body;

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    req.db.get(query, [username, password], (err, row) => {
        if (err) {
            console.error('Errore del server:', err);
            return res.status(500).json({ success: false, message: 'Errore del server' });
        }
        if (row) {
            console.log('Login effettuato con successo!');
            console.log('Dati utente recuperati dal database:', row);
            req.session.user = row;
            res.json({ success: true, name: row.name });
        } else {
            console.log('Credenziali non valide.');
            res.json({ success: false, message: 'Credenziali non valide.' });
        }
    });
});

// Endpoint per ottenere l'utente della sessione con ID
router.get('/session-user', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ 
            id: req.session.user.id, 
            username: req.session.user.username, 
            name: req.session.user.name 
        });
    } else {
        res.status(401).json({ error: 'Utente non autenticato' });
    }
});

// Endpoint per ottenere l'utente corrente
router.get('/current-user', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ 
            id: req.session.user.id, 
            username: req.session.user.username, 
            name: req.session.user.name 
        });
    } else {
        res.status(401).json({ error: 'Utente non autenticato' });
    }
});

module.exports = {
    router: router
};
