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

// Endpoint per ottenere tutte le pagine e azioni dalla tabella crud
router.get('/crud-actions', checkAuthentication, (req, res) => {
    const query = `
        SELECT DISTINCT page, action 
        FROM crud 
        ORDER BY page, action`;

    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero delle azioni CRUD:', err);
            return res.status(500).send('Errore del server');
        }

        // Organizza i risultati per pagina
        const pages = {};
        rows.forEach(row => {
            if (!pages[row.page]) {
                pages[row.page] = [];
            }
            pages[row.page].push(row.action);
        });

        res.json(pages);
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

// Endpoint per ottenere i permessi CRUD di un membro del team
router.get('/:id/crud-permissions', checkAuthentication, (req, res) => {
    const userId = req.params.id;
    const query = `SELECT c.page, c.action, c.properties 
                   FROM crud c
                   JOIN user_crud uc ON c.id = uc.crud_id
                   WHERE uc.user_id = ?`;
    req.db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero delle azioni CRUD:', err);
            return res.status(500).send('Errore del server');
        }
        const crud = {};
        rows.forEach(row => {
            if (!crud[row.page]) {
                crud[row.page] = {};
            }
            if (row.action === 'Read') {
                const properties = row.properties ? JSON.parse(row.properties) : { level: 'all' };
                crud[row.page].read = {
                    enabled: true,
                    level: properties.level
                };
            } else {
                crud[row.page][row.action.toLowerCase()] = true;
            }
        });
        res.json(crud);
    });
});

// Endpoint per aggiornare i permessi CRUD di un membro del team
router.put('/:id/crud-permissions', checkAuthentication, (req, res) => {
    const userId = req.params.id;
    const { crud } = req.body;

    if (typeof crud !== 'object' || crud === null) {
        return res.status(400).send('Valori CRUD non validi');
    }

    req.db.serialize(() => {
        req.db.run('BEGIN TRANSACTION');

        // Elimina i vecchi permessi dell'utente
        req.db.run('DELETE FROM user_crud WHERE user_id = ?', [userId], function(err) {
            if (err) {
                console.error('Errore nella cancellazione dei vecchi permessi:', err);
                req.db.run('ROLLBACK');
                return res.status(500).send('Errore del server');
            }

            // Prepara i nuovi permessi
            const permissions = [];
            Object.entries(crud).forEach(([page, actions]) => {
                Object.entries(actions).forEach(([action, value]) => {
                    if (action === 'read' && typeof value === 'object') {
                        if (value.enabled) {
                            permissions.push({
                                page,
                                action: 'Read',
                                properties: JSON.stringify({ level: value.level || 'all' })
                            });
                        }
                    } else if (value === true) {
                        permissions.push({
                            page,
                            action: action.charAt(0).toUpperCase() + action.slice(1),
                            properties: null
                        });
                    }
                });
            });

            if (permissions.length === 0) {
                req.db.run('COMMIT', (err) => {
                    if (err) {
                        req.db.run('ROLLBACK');
                        console.error('Errore durante il commit della transazione:', err);
                        return res.status(500).send('Errore del server');
                    }
                    res.status(200).send('CRUD actions updated successfully!');
                });
                return;
            }

            // Inserisci i nuovi permessi
            const stmt = req.db.prepare(`
                INSERT INTO user_crud (user_id, crud_id) 
                SELECT ?, id 
                FROM crud 
                WHERE page = ? AND action = ?
            `);
            let pending = permissions.length;

            permissions.forEach(perm => {
                console.log('Inserting permission:', perm);
                stmt.run([userId, perm.page, perm.action], function(err) {
                    if (err) {
                        console.error('Errore nell\'inserimento del permesso:', err);
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
                                res.status(200).send('CRUD actions updated successfully!');
                            });
                        });
                    }
                });
            });
        });
    });
});

// Endpoint per ottenere i tasks assegnati a un membro del team
router.get('/:id/tasks', checkAuthentication, (req, res) => {
    const userId = req.params.id;
    const query = `
        SELECT t.* 
        FROM project_history t 
        WHERE t.assigned_to = (
            SELECT username 
            FROM users 
            WHERE id = ?
        )`;

    req.db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero dei tasks:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per eliminare un membro del team
router.delete('/:id', checkAuthentication, (req, res) => {
    const userId = req.params.id;

    req.db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
            console.error('Errore nell\'eliminazione del team member:', err);
            return res.status(500).send('Errore del server');
        }
        if (this.changes === 0) {
            return res.status(404).send('Utente non trovato');
        }
        res.status(200).send('Utente eliminato con successo');
    });
});

module.exports = router;
