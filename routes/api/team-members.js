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
    const query = `
        SELECT c.page, c.action, uc.properties, u.factory, u.client_company_name
        FROM crud c
        JOIN user_crud uc ON c.id = uc.crud_id
        JOIN users u ON uc.user_id = u.id
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
                let properties;
                try {
                    // Prima prova a leggere le properties da user_crud
                    properties = row.properties ? JSON.parse(row.properties) : {};
                } catch (e) {
                    console.error('Errore nel parsing delle properties:', e);
                    // Se fallisce, usa valori di default
                    properties = {
                        enabled: true,
                        scope: 'all',
                        level: 'all'
                    };
                }
                
                crud[row.page].read = {
                    enabled: properties.enabled !== false,
                    scope: properties.scope || 'all',
                    userIds: properties.userIds,
                    factory: row.factory,
                    client_company_name: row.client_company_name
                };
            } else {
                crud[row.page][row.action.toLowerCase()] = true;
            }
        });
        res.json(crud);
    });
});

// Endpoint per aggiornare i permessi CRUD di un membro del team
router.put('/:id/crud-permissions', checkAuthentication, async (req, res) => {
    const userId = req.params.id;
    const { crud } = req.body;

    if (typeof crud !== 'object' || crud === null) {
        return res.status(400).send('Valori CRUD non validi');
    }

    try {
        // Funzione per eseguire una query SQL come Promise
        const runQuery = (query, params = []) => {
            return new Promise((resolve, reject) => {
                req.db.run(query, params, function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });
        };

        // Funzione per ottenere gli ID delle azioni CRUD
        const getCrudId = (page, action) => {
            return new Promise((resolve, reject) => {
                req.db.get(
                    'SELECT id FROM crud WHERE page = ? AND action = ?',
                    [page, action],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row ? row.id : null);
                    }
                );
            });
        };

        // Inizia la transazione
        await runQuery('BEGIN TRANSACTION');

        // Elimina i vecchi permessi
        await runQuery('DELETE FROM user_crud WHERE user_id = ?', [userId]);

        // Prepara i nuovi permessi
        const permissions = [];
        
        // Processa le azioni CRUD
        for (const [page, actions] of Object.entries(crud)) {
            for (const [action, value] of Object.entries(actions)) {
                const actionName = action.charAt(0).toUpperCase() + action.slice(1);
                
                if (action === 'read' && typeof value === 'object') {
                    if (value.enabled) {
                        const crudId = await getCrudId(page, actionName);
                        if (crudId) {
                            const properties = {
                                enabled: true,
                                scope: value.scope || 'all',
                                level: value.scope || 'all'
                            };
                            
                            if (value.scope === 'specific-users' && Array.isArray(value.userIds)) {
                                properties.userIds = value.userIds;
                            }
                            
                            permissions.push({
                                userId,
                                crudId,
                                properties: JSON.stringify(properties)
                            });
                        }
                    }
                } else if (value === true) {
                    const crudId = await getCrudId(page, actionName);
                    if (crudId) {
                        permissions.push({
                            userId,
                            crudId,
                            properties: null
                        });
                    }
                }
            }
        }

        // Inserisci i nuovi permessi con properties
        for (const perm of permissions) {
            await runQuery(
                'INSERT INTO user_crud (user_id, crud_id, properties) VALUES (?, ?, ?)',
                [perm.userId, perm.crudId, perm.properties]
            );
        }

        // Commit della transazione
        await runQuery('COMMIT');
        
        res.status(200).send('CRUD actions updated successfully!');
    } catch (error) {
        console.error('Errore nell\'aggiornamento dei permessi:', error);
        await runQuery('ROLLBACK').catch(console.error);
        res.status(500).send('Errore del server');
    }
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
