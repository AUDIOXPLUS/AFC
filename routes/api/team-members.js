const express = require('express');
const router = express.Router();
const checkAuthentication = require('../middleware/auth');

// Endpoint per ottenere i membri del team
router.get('/', checkAuthentication, (req, res) => {
    const query = 'SELECT id, name, role, email, color, fontColor, username, factory, client_company_name FROM users';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero dei team members:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per ottenere i dettagli di un singolo membro del team
router.get('/:id', checkAuthentication, (req, res) => {
    const userId = req.params.id;
    const query = 'SELECT id, name, role, email, color, fontColor, username, factory, client_company_name FROM users WHERE id = ?';

    req.db.get(query, [userId], (err, row) => {
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

// Endpoint per aggiungere un membro del team
router.post('/', checkAuthentication, (req, res) => {
    const { name, role, email, color, fontColor, username, password, factory, client_company_name } = req.body;
    const query = `INSERT INTO users (name, role, email, color, fontColor, username, password, factory, client_company_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    req.db.run(query, [name, role, email, color, fontColor, username, password, factory, client_company_name], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento del team member:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Endpoint per aggiornare un membro del team
router.put('/:id', checkAuthentication, (req, res) => {
    const { name, role, email, color, fontColor, factory, client_company_name } = req.body;
    const userId = req.params.id;

    console.log(`Tentativo di aggiornamento del team member con ID: ${userId}`);
    console.log(`Dati ricevuti: name=${name}, role=${role}, email=${email}, color=${color}, fontColor=${fontColor}, factory=${factory}, client_company_name=${client_company_name}`);

    const query = `UPDATE users SET name = ?, role = ?, email = ?, color = ?, fontColor = ?, factory = ?, client_company_name = ? WHERE id = ?`;

    req.db.run(query, [name, role, email, color, fontColor, factory, client_company_name, userId], function(err) {
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
router.get('/:id/privileges', checkAuthentication, (req, res) => {
    const userId = req.params.id;
    const query = `SELECT p.page, p.action 
                   FROM privileges p
                   JOIN user_privileges up ON p.id = up.privilege_id
                   WHERE up.user_id = ?`;
    req.db.all(query, [userId], (err, rows) => {
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
router.put('/:id/privileges', checkAuthentication, (req, res) => {
    const userId = req.params.id;
    const { privileges } = req.body;

    if (!Array.isArray(privileges)) {
        return res.status(400).send('Privilegi non validi');
    }

    req.db.serialize(() => {
        req.db.run('BEGIN TRANSACTION');

        req.db.run('DELETE FROM user_privileges WHERE user_id = ?', [userId], function(err) {
            if (err) {
                console.error('Errore nella cancellazione dei privilegi esistenti:', err);
                req.db.run('ROLLBACK');
                return res.status(500).send('Errore del server');
            }

            if (privileges.length === 0) {
                req.db.run('COMMIT', (err) => {
                    if (err) {
                        req.db.run('ROLLBACK');
                        console.error('Errore durante il commit della transazione:', err);
                        return res.status(500).send('Errore del server');
                   }
                   res.status(200).send('Privilegi aggiornati con successo');
               });
               return;
           }

            const stmt = req.db.prepare('INSERT INTO user_privileges (user_id, privilege_id) VALUES (?, ?)');
            let pending = privileges.length;

            privileges.forEach(priv => {
                req.db.get('SELECT id FROM privileges WHERE page = ? AND action = ?', [priv.page, priv.action], (err, row) => {
                    if (err) {
                        console.error('Errore nel recupero dell\'ID del privilegio:', err);
                    } else if (row) {
                        stmt.run(userId, row.id, function(err) {
                            if (err) {
                                console.error('Errore nell\'inserimento del privilegio:', err);
                            }
                        });
                    } else {
                        console.warn(`Privilegio non trovato: ${priv.page} - ${priv.action}`);
                    }

                    pending--;
                    if (pending === 0) {
                        stmt.finalize((err) => {
                            if (err) {
                                console.error('Errore nella finalizzazione dello statement:', err);
                                req.db.run('ROLLBACK');
                                return res.status(500).send('Errore del server');
                            }
                            req.db.run('COMMIT', (err) => {
                                if (err) {
                                    req.db.run('ROLLBACK');
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

module.exports = router;
