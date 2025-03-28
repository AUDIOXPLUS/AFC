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
            return res.status(500).json({ success: false, message: 'Server error' });
        }
        if (row) {
            console.log('Login effettuato con successo!');
            console.log('Dati utente recuperati dal database:', row);
            // Salva solo i dati necessari nella sessione
            req.session.user = {
                id: row.id,
                name: row.name,
                username: row.username
            };
            res.json({ 
                success: true, 
                name: row.name,
                id: row.id
            });
        } else {
            console.log('Credenziali non valide.');
            res.json({ success: false, message: 'Invalid credentials.' });
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

// Endpoint per il cambio password
router.post('/change-password', (req, res) => {
    // Verifica che l'utente sia autenticato
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;

    // Verifica che la password corrente sia corretta
    const checkQuery = 'SELECT password FROM users WHERE id = ?';
    req.db.get(checkQuery, [userId], (err, row) => {
        if (err) {
            console.error('Errore del server:', err);
            return res.status(500).json({ success: false, message: 'Errore del server' });
        }
        
        if (!row) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Verifica che la password corrente sia corretta
        if (row.password !== currentPassword) {
            return res.json({ success: false, message: 'Current password is invalid' });
        }
        
        // Nessuna verifica sulla nuova password: l'utente può impostare qualsiasi password desideri
        // Non verifichiamo lunghezza minima, caratteri speciali, ecc.
        
        // Aggiorna la password
        const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
        req.db.run(updateQuery, [newPassword, userId], function(err) {
            if (err) {
                console.error('Errore nell\'aggiornamento della password:', err);
                return res.status(500).json({ success: false, message: 'Error updating password' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'User not found or no changes made' });
            }
            
            console.log('Password aggiornata con successo per l\'utente ID:', userId);
            res.json({ success: true, message: 'Password successfully updated' });
        });
    });
});

module.exports = {
    router: router
};
