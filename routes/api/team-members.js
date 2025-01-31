const express = require('express');
const router = express.Router();
const checkAuthentication = require('../middleware/auth');

// Endpoint per ottenere i membri del team in base ai permessi
router.get('/', checkAuthentication, async (req, res) => {
    try {
        // Ottieni i permessi CRUD dell'utente per la pagina users
        const permissionsQuery = `
            SELECT c.properties, uc.properties as user_properties
            FROM crud c
            LEFT JOIN user_crud uc ON uc.crud_id = c.id AND uc.user_id = ?
            WHERE c.page = 'Users' 
            AND c.action = 'Read'
        `;
        
        const user = await new Promise((resolve, reject) => {
            req.db.get(permissionsQuery, [req.session.user.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(403).json({ error: 'Utente non trovato' });
        }

        let query = `
            SELECT 
                id,
                username,
                name,
                role,
                email,
                color,
                fontColor,
                factory,
                client_company_name
            FROM 
                users
            WHERE 1=1
        `;
        const queryParams = [];

        if (!user.user_properties) {
            return res.status(403).json({ error: 'Permesso di lettura negato' });
        }

        let permissions;
        try {
            console.log('User properties raw:', user.user_properties);
            permissions = JSON.parse(user.user_properties);
            console.log('Permessi parsati:', permissions);
            
            if (!permissions.enabled) {
                return res.status(403).json({ error: 'Permessi non abilitati' });
            }
        } catch (error) {
            console.error('Errore nel parsing dei permessi:', error);
            console.error('JSON non valido:', user.user_properties);
            return res.status(403).json({ error: 'Permessi non validi' });
        }

        const level = permissions.level || permissions.scope;
        console.log('Livello permessi applicato:', level);

        switch (level) {
            case 'all':
                // Nessun filtro necessario
                break;
            case 'own-factory':
                // Ottieni tutti gli utenti della stessa factory dell'utente corrente
                // o che lavorano su progetti della factory dell'utente
                query += ` AND (
                    factory = (
                        SELECT factory 
                        FROM users 
                        WHERE id = ?
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM project_history ph
                        JOIN projects p ON ph.project_id = p.id
                        WHERE ph.assigned_to = users.name
                        AND p.factory = (
                            SELECT factory 
                            FROM users 
                            WHERE id = ?
                        )
                    )
                )`;
                queryParams.push(req.session.user.id, req.session.user.id);
                break;
            case 'all-factories':
                // Ottieni tutti gli utenti di tutte le factories
                query += ` AND factory IS NOT NULL`;
                break;
            case 'own-client':
                // Ottieni tutti gli utenti dello stesso client dell'utente corrente
                // o che lavorano su progetti del client dell'utente
                query += ` AND (
                    client_company_name = (
                        SELECT client_company_name 
                        FROM users 
                        WHERE id = ?
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM project_history ph
                        JOIN projects p ON ph.project_id = p.id
                        WHERE ph.assigned_to = users.name
                        AND p.client = (
                            SELECT client_company_name 
                            FROM users 
                            WHERE id = ?
                        )
                    )
                )`;
                queryParams.push(req.session.user.id, req.session.user.id);
                break;
            case 'all-clients':
                // Ottieni tutti gli utenti di tutti i client
                query += ` AND client_company_name IS NOT NULL`;
                break;
            case 'specific-users':
                // Se sono specificati utenti specifici nei permessi
                if (permissions.userIds && Array.isArray(permissions.userIds)) {
                    query += ` AND id IN (${permissions.userIds.map(() => '?').join(',')})`;
                    queryParams.push(...permissions.userIds);
                } else {
                    return res.status(403).json({ error: 'Nessun utente specifico definito nei permessi' });
                }
                break;
            default:
                return res.status(403).json({ error: 'Livello non valido' });
        }

        console.log('Query SQL:', query);
        console.log('Parametri query:', queryParams);
        console.log('User ID:', req.session.user.id);
        console.log('User Name:', req.session.user.name);

        req.db.all(query, queryParams, (err, rows) => {
            if (err) {
                console.error('Errore nel recupero dei team members:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            
            const sanitizedRows = rows.map(({ password, ...rest }) => rest);
            
            console.log('Numero di righe trovate:', sanitizedRows.length);
            console.log('Prima riga risultato:', sanitizedRows[0]);
            res.json(sanitizedRows);
        });
    } catch (error) {
        console.error('Errore:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
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
        SELECT c.id, c.page, c.action, uc.properties, u.factory, u.client_company_name
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
            // Gestione speciale per il permesso CRUD visible (ID 17)
            if (row.id === 17) {
                crud['CRUD'] = {
                    read: {
                        enabled: true,
                        scope: 'all',
                        crudId: 17
                    }
                };
                return;
            }

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
            // Gestione speciale per il permesso CRUD visible
            if (page === 'crud_visible' && actions.id === 17 && actions.enabled) {
                permissions.push({
                    userId,
                    crudId: 17,
                    properties: null
                });
                continue;
            }
            for (const [action, value] of Object.entries(actions)) {
                const actionName = action.charAt(0).toUpperCase() + action.slice(1);
                
                if (action === 'read' && typeof value === 'object') {
                    if (value.enabled) {
                        const crudId = await getCrudId(page, actionName);
                        if (crudId) {
                            // Mantieni gli userIds quando si passa da specific-users a user-tasks e viceversa
                            const properties = {
                                enabled: true,
                                scope: value.scope || 'all',
                                level: value.scope || 'all',
                                userIds: value.userIds || [] // Mantieni sempre userIds se presente
                            };
                            
                            // Se non ci sono userIds ma è un permesso che li richiede, usa quelli esistenti
                            if ((value.scope === 'specific-users' || value.scope === 'user-tasks') && !Array.isArray(value.userIds)) {
                                // Cerca i permessi esistenti per questo utente
                                const existingPerms = await new Promise((resolve, reject) => {
                                    req.db.get(
                                        'SELECT properties FROM user_crud WHERE user_id = ? AND crud_id = (SELECT id FROM crud WHERE page = ? AND action = ?)',
                                        [userId, page, actionName],
                                        (err, row) => {
                                            if (err) reject(err);
                                            else resolve(row);
                                        }
                                    );
                                });

                                if (existingPerms && existingPerms.properties) {
                                    try {
                                        const existingProps = JSON.parse(existingPerms.properties);
                                        if (Array.isArray(existingProps.userIds)) {
                                            properties.userIds = existingProps.userIds;
                                        }
                                    } catch (e) {
                                        console.error('Errore nel parsing delle properties esistenti:', e);
                                    }
                                }
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
