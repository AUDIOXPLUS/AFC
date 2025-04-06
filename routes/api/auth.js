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

// Endpoint per ottenere l'utente della sessione con ID e permessi CRUD
router.get('/session-user', (req, res) => {
    if (req.session && req.session.user && req.session.user.id) {
        const userId = req.session.user.id;
        // Query per recuperare i permessi CRUD dell'utente
        const query = `
            SELECT c.id as crud_id, c.page, c.action, uc.properties
            FROM crud c
            JOIN user_crud uc ON c.id = uc.crud_id
            WHERE uc.user_id = ?`;

        req.db.all(query, [userId], (err, rows) => {
            if (err) {
                console.error('Errore nel recupero dei permessi CRUD per la sessione:', err);
                // Invia comunque i dati utente base anche se i permessi falliscono
                return res.json({
                    id: req.session.user.id,
                    username: req.session.user.username,
                    name: req.session.user.name,
                    permissions: {} // Permessi vuoti in caso di errore
                });
            }

            // Elabora i permessi come nell'altro endpoint
            const permissions = {};
             // Inizializza le pagine note per assicurare che esistano nell'oggetto finale
            const knownPages = ['Projects', 'Users', 'Tasks', 'CRUD', 'Configuration'];
            knownPages.forEach(page => {
                // Inizializza Configuration con read: false, le altre come oggetti vuoti
                permissions[page] = page === 'Configuration' ? { read: false } : {};
                 // Inizializza anche CRUD con read: { enabled: false } per coerenza
                 if (page === 'CRUD') {
                     permissions[page] = { read: { enabled: false } };
                 }
            });


            rows.forEach(row => {
                 // Gestione speciale per CRUD visible (ID 17)
                if (row.crud_id === 17) {
                    // Assicurati che CRUD.read sia un oggetto prima di assegnare enabled
                    if (typeof permissions['CRUD']?.read !== 'object') {
                         permissions['CRUD'] = { read: {} };
                    }
                    permissions['CRUD'].read.enabled = true;
                    permissions['CRUD'].read.scope = 'all'; // Aggiungi scope per coerenza
                    permissions['CRUD'].read.crudId = 17;
                    return; // Passa alla riga successiva
                }

                // Assicurati che la pagina esista
                if (!permissions[row.page]) {
                    permissions[row.page] = {};
                }

                // Gestione specifica per Configuration.read
                if (row.page === 'Configuration' && row.action === 'Read') {
                     // Assicurati che Configuration.read esista come oggetto
                     if (typeof permissions[row.page] !== 'object') {
                         permissions[row.page] = {};
                     }
                    permissions[row.page].read = true; // Imposta a true se esiste il permesso
                } else if (row.action === 'Read') { // Gestione Read per altre pagine
                    let props;
                    try {
                        props = row.properties ? JSON.parse(row.properties) : {};
                    } catch (e) {
                        console.error(`Errore parsing properties per ${row.page} Read (ID: ${row.crud_id}):`, e);
                        props = { enabled: true, scope: 'all' }; // Fallback
                    }
                     // Assicurati che page.read sia un oggetto
                     if (typeof permissions[row.page]?.read !== 'object') {
                         permissions[row.page] = { ...permissions[row.page], read: {} };
                     }
                    permissions[row.page].read = {
                        enabled: props.enabled !== false,
                        scope: props.scope || props.level || 'all',
                        userIds: props.userIds
                    };
                } else { // Gestione Create, Update, Delete
                    permissions[row.page][row.action.toLowerCase()] = true;
                }
            });

             // Log dei permessi elaborati prima dell'invio
             console.log('Permessi elaborati per /session-user:', JSON.stringify(permissions, null, 2));

            // Invia i dati utente con i permessi elaborati
            res.json({
                id: req.session.user.id,
                username: req.session.user.username,
                name: req.session.user.name,
                permissions: permissions // Aggiungi i permessi alla risposta
            });
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
