const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const morgan = require('morgan'); // Middleware di logging

const app = express();
const db = new sqlite3.Database('./database/AFC.db', (err) => {
    if (err) {
        console.error('Errore di connessione al database:', err);
    } else {
        console.log('Connessione al database riuscita');
    }
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev')); // Usa Morgan per loggare le richieste in modalità 'dev'

// **Definisci tutte le rotte API prima di servire i file statici**

// Endpoint per il login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`Tentativo di login con username: ${username}`);

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.get(query, [username, password], (err, row) => {
        if (err) {
            console.error('Errore del server:', err);
            return res.status(500).json({ success: false, message: 'Errore del server' });
        }
        if (row) {
            console.log('Login effettuato con successo!');
            console.log('Dati utente recuperati dal database:', row);
            res.json({ success: true, name: row.name });
        } else {
            console.log('Credenziali non valide.');
            res.json({ success: false, message: 'Credenziali non valide.' });
        }
    });
});

// Endpoint per ottenere i progetti
app.get('/api/projects', (req, res) => {
    const query = 'SELECT * FROM projects';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore del server:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere un progetto
app.post('/api/projects', (req, res) => {
    const { factory, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, status } = req.body;
    const query = `INSERT INTO projects (factory, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [factory, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, status], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Endpoint per aggiornare un progetto
app.put('/api/projects/:id', (req, res) => {
    const { factory, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, status } = req.body;
    const query = `UPDATE projects SET factory = ?, modelNumber = ?, factoryModelNumber = ?, productKind = ?, client = ?, startDate = ?, endDate = ?, status = ? WHERE id = ?`;
    db.run(query, [factory, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, status, req.params.id], function(err) {
        if (err) {
            console.error('Errore nell\'aggiornamento del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(200).send('Progetto aggiornato con successo');
    });
});

// Endpoint per eliminare un progetto
app.delete('/api/projects/:id', (req, res) => {
    const query = `DELETE FROM projects WHERE id = ?`;
    db.run(query, req.params.id, function(err) {
        if (err) {
            console.error('Errore nell\'eliminazione del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(200).send('Progetto eliminato con successo');
    });
});

// Endpoint per ottenere i membri del team
app.get('/api/team-members', (req, res) => {
    const query = 'SELECT id, name, role, email, color, username FROM users';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero dei team members:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere un membro del team
app.post('/api/team-members', (req, res) => {
    const { name, role, email, color, username, password } = req.body;
    const query = `INSERT INTO users (name, role, email, color, username, password) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(query, [name, role, email, color, username, password], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento del team member:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Endpoint per aggiornare un membro del team
app.put('/api/team-members/:id', (req, res) => {
    const { name, role, email, color } = req.body;
    const userId = req.params.id;

    console.log(`Tentativo di aggiornamento del team member con ID: ${userId}`);
    console.log(`Dati ricevuti: name=${name}, role=${role}, email=${email}, color=${color}`);

    const query = `UPDATE users SET name = ?, role = ?, email = ?, color = ? WHERE id = ?`;

    db.run(query, [name, role, email, color, userId], function(err) {
        if (err) {
            console.error('Errore nell\'aggiornamento del team member:', err);
            return res.status(500).send('Errore del server');
        }

        if (this.changes === 0) {
            console.log('Nessun utente aggiornato. Controlla l\'ID.');
            return res.status(404).send('Utente non trovato');
        }

        console.log('Membro del team aggiornato con successo');
        res.status(200).send('Membro del team aggiornato con successo');
    });
});

// Endpoint per ottenere i privilegi di un membro del team
app.get('/api/team-members/:id/privileges', (req, res) => {
    const userId = req.params.id;
    const query = `
        SELECT p.page, p.action 
        FROM privileges p
        JOIN user_privileges up ON p.id = up.privilege_id
        WHERE up.user_id = ?
    `;
    db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero dei privilegi:', err);
            return res.status(500).send('Errore del server');
        }
        const privileges = {};
        rows.forEach(row => {
            if (!privileges[row.page]) {
                privileges[row.page] = [];
            }
            privileges[row.page].push(row.action);
        });
        res.json(privileges);
    });
});

// Endpoint per aggiornare i privilegi di un membro del team
app.put('/api/team-members/:id/privileges', (req, res) => {
    const userId = req.params.id;
    const { privileges } = req.body; // Ci aspettiamo un array di oggetti { page, action }

    if (!Array.isArray(privileges)) {
        return res.status(400).send('Privilegi non validi');
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Rimuovi i privilegi esistenti
        db.run('DELETE FROM user_privileges WHERE user_id = ?', [userId], function(err) {
            if (err) {
                console.error('Errore nella cancellazione dei privilegi esistenti:', err);
                db.run('ROLLBACK');
                return res.status(500).send('Errore del server');
            }

            if (privileges.length === 0) {
                db.run('COMMIT', (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('Errore durante il commit della transazione:', err);
                        return res.status(500).send('Errore del server');
                    }
                    res.status(200).send('Privilegi aggiornati con successo');
                });
                return;
            }

            const stmt = db.prepare('INSERT INTO user_privileges (user_id, privilege_id) VALUES (?, ?)');
            let pending = privileges.length;

            privileges.forEach(priv => {
                // Ottieni l'ID del privilegio corrispondente a page e action
                db.get('SELECT id FROM privileges WHERE page = ? AND action = ?', [priv.page, priv.action], (err, row) => {
                    if (err) {
                        console.error('Errore nel recupero dell\'ID del privilegio:', err);
                        // Potresti gestire l'errore qui
                    } else if (row) {
                        stmt.run(userId, row.id, function(err) {
                            if (err) {
                                console.error('Errore nell\'inserimento del privilegio:', err);
                                // Potresti gestire l'errore qui
                            }
                        });
                    } else {
                        console.warn(`Privilegio non trovato: ${priv.page} - ${priv.action}`);
                        // Potresti gestire questo caso, ad esempio creando il privilegio se non esiste
                    }

                    pending--;
                    if (pending === 0) {
                        stmt.finalize((err) => {
                            if (err) {
                                console.error('Errore nella finalizzazione dello statement:', err);
                                db.run('ROLLBACK');
                                return res.status(500).send('Errore del server');
                            }
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    console.error('Errore durante il commit della transazione:', err);
                                    return res.status(500).send('Errore del server');
                                }
                                res.status(200).send('Privilegi aggiornati con successo');
                            });
                        });
                    }
                });
            });
        });
    });
});

// Endpoint per ottenere i dettagli di un singolo membro del team
app.get('/api/team-members/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'SELECT id, name, role, email, color, username FROM users WHERE id = ?';

    db.get(query, [userId], (err, row) => {
        if (err) {
            console.error('Errore nel recupero dei dettagli del membro del team:', err);
            return res.status(500).send('Errore del server');
        }
        if (!row) {
            console.log('Membro del team non trovato per ID:', userId);
            return res.status(404).send('Membro del team non trovato');
        }
        res.json(row);
    });
});

// Servire file statici
app.use(express.static(__dirname));

// Avviare il server alla fine dopo tutte le rotte
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);
});
