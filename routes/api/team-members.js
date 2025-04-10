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

        // Aggiungi manualmente Configuration se non presente, con solo azione Read
        if (!pages['Configuration']) {
            pages['Configuration'] = ['Read'];
        } else if (!pages['Configuration'].includes('Read')) {
            // Assicurati che Read sia presente se Configuration esiste già
            pages['Configuration'].push('Read');
        }


        res.json(pages);
    });
});

// Endpoint per ottenere i nomi univoci delle factory (filtrate per permessi)
router.get('/factories', checkAuthentication, async (req, res) => {
    try {
        // Ottieni i permessi CRUD dell'utente per la pagina users (necessari per determinare il filtro)
        const permissionsQuery = `
            SELECT uc.properties as user_properties
            FROM crud c
            LEFT JOIN user_crud uc ON uc.crud_id = c.id AND uc.user_id = ?
            WHERE c.page = 'Users'
            AND c.action = 'Read'
        `;

        const userPermissions = await new Promise((resolve, reject) => {
            req.db.get(permissionsQuery, [req.session.user.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!userPermissions || !userPermissions.user_properties) {
            console.warn(`Nessun permesso di lettura 'Users' trovato per l'utente ${req.session.user.id}. Restituisco array vuoto.`); // Log in italiano
            return res.json([]); // Restituisce array vuoto se non ci sono permessi di lettura
        }

        let permissions;
        try {
            permissions = JSON.parse(userPermissions.user_properties);
            if (!permissions.enabled) {
                console.warn(`Permessi di lettura 'Users' disabilitati per l'utente ${req.session.user.id}. Restituisco array vuoto.`); // Log in italiano
                return res.json([]);
            }
        } catch (error) {
            console.error('Errore nel parsing dei permessi per le factory:', error); // Log in italiano
            return res.status(500).json({ error: 'Invalid permissions configuration' }); // Messaggio in inglese
        }

        let query = `
            SELECT DISTINCT factory
            FROM users
            WHERE factory IS NOT NULL AND factory != ''
            AND factory NOT IN ('FLT', 'FLT_FINANCIAL')
        `;
        const queryParams = [];
        const level = permissions.level || permissions.scope;
        console.log(`Livello permessi per factory: ${level}`); // Log in italiano

        switch (level) {
            case 'all':
            case 'all-factories':
            case 'all-clients': // Per le factory, all-clients equivale a vedere tutte le factory
                // Nessun filtro aggiuntivo necessario
                break;
            case 'own-factory':
                // Filtra per la factory dell'utente corrente
                query += ` AND factory = (SELECT factory FROM users WHERE id = ?)`;
                queryParams.push(req.session.user.id);
                break;
            case 'own-client':
                 // Per le factory, own-client non limita direttamente le factory visibili,
                 // ma potremmo voler limitare alle factory degli utenti dello stesso client.
                 // Per semplicità attuale, restituiamo tutte le factory o solo quella dell'utente se definita.
                 // Se l'utente ha una factory definita, mostra solo quella. Altrimenti tutte?
                 // Rivediamo: la logica più coerente è mostrare le factory degli utenti visibili.
                 query += ` AND id IN (
                     SELECT id FROM users WHERE client_company_name = (SELECT client_company_name FROM users WHERE id = ?)
                 )`;
                 queryParams.push(req.session.user.id);
                 // Questa logica potrebbe essere troppo restrittiva se un utente client deve vedere progetti di altre factory.
                 // Manteniamo la logica precedente per ora: mostrare tutte le factory se il permesso è legato al client.
                 // query = `SELECT DISTINCT factory FROM users WHERE factory IS NOT NULL AND factory != ''`;
                 // queryParams = [];
                 // TODO: Chiarire la logica desiderata per own-client rispetto alle factory.
                 // Per ora, si comporta come 'all'.
                 console.warn("Logica permessi 'own-client' per le factory da rivedere. Attualmente mostra tutte."); // Log in italiano
                 query = `SELECT DISTINCT factory FROM users WHERE factory IS NOT NULL AND factory != '' AND factory NOT IN ('FLT', 'FLT_FINANCIAL')`; // Reset query a "mostra tutte"
                 queryParams.length = 0; // Svuota parametri
                break;
            case 'specific-users':
                // Filtra per le factory degli utenti specifici
                if (permissions.userIds && Array.isArray(permissions.userIds) && permissions.userIds.length > 0) {
                    query += ` AND id IN (${permissions.userIds.map(() => '?').join(',')})`;
                    queryParams.push(...permissions.userIds);
                } else {
                    console.warn(`Permessi 'specific-users' senza userIds validi per utente ${req.session.user.id}. Restituisco array vuoto.`); // Log in italiano
                    return res.json([]); // Nessun utente specificato, nessuna factory da mostrare
                }
                break;
            default:
                console.warn(`Livello permessi non riconosciuto '${level}' per utente ${req.session.user.id}. Restituisco array vuoto.`); // Log in italiano
                return res.json([]); // Livello non valido o non gestito
        }

        query += ` ORDER BY factory ASC`; // Aggiungi ordinamento alla fine

        console.log('Query SQL per factory filtrate:', query); // Log in italiano
        console.log('Parametri query per factory:', queryParams); // Log in italiano

        req.db.all(query, queryParams, (err, rows) => {
            if (err) {
                console.error('Errore nel recupero delle factory filtrate:', err); // Log in italiano
                return res.status(500).json({ error: 'Server error fetching filtered factories' }); // Messaggio in inglese
            }
            const factoryNames = rows.map(row => row.factory).filter(Boolean); // Estrai e rimuovi eventuali null/undefined residui
            console.log('Factory filtrate restituite:', factoryNames); // Log in italiano
            res.json(factoryNames);
        });

    } catch (error) {
        console.error('Errore generale nel recupero delle factory filtrate:', error); // Log in italiano
        res.status(500).json({ error: 'Internal server error' }); // Messaggio in inglese
    }
});

// Endpoint per ottenere i nomi univoci dei client (filtrati per permessi)
router.get('/clients', checkAuthentication, async (req, res) => {
    try {
        // Ottieni i permessi CRUD dell'utente per la pagina users (necessari per determinare il filtro)
        const permissionsQuery = `
            SELECT uc.properties as user_properties
            FROM crud c
            LEFT JOIN user_crud uc ON uc.crud_id = c.id AND uc.user_id = ?
            WHERE c.page = 'Users'
            AND c.action = 'Read'
        `;

        const userPermissions = await new Promise((resolve, reject) => {
            req.db.get(permissionsQuery, [req.session.user.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!userPermissions || !userPermissions.user_properties) {
            console.warn(`Nessun permesso di lettura 'Users' trovato per l'utente ${req.session.user.id} per i client. Restituisco array vuoto.`); // Log in italiano
            return res.json([]);
        }

        let permissions;
        try {
            permissions = JSON.parse(userPermissions.user_properties);
            if (!permissions.enabled) {
                console.warn(`Permessi di lettura 'Users' disabilitati per l'utente ${req.session.user.id} per i client. Restituisco array vuoto.`); // Log in italiano
                return res.json([]);
            }
        } catch (error) {
            console.error('Errore nel parsing dei permessi per i client:', error); // Log in italiano
            return res.status(500).json({ error: 'Invalid permissions configuration' }); // Messaggio in inglese
        }

        let query = `
            SELECT DISTINCT client_company_name
            FROM users
            WHERE client_company_name IS NOT NULL AND client_company_name != ''
        `;
        const queryParams = [];
        const level = permissions.level || permissions.scope;
        console.log(`Livello permessi per client: ${level}`); // Log in italiano

        switch (level) {
            case 'all':
            case 'all-clients':
            case 'all-factories': // Per i client, all-factories equivale a vedere tutti i client
                // Nessun filtro aggiuntivo necessario
                break;
            case 'own-client':
                // Filtra per il client dell'utente corrente
                query += ` AND client_company_name = (SELECT client_company_name FROM users WHERE id = ?)`;
                queryParams.push(req.session.user.id);
                break;
             case 'own-factory':
                 // Mostra solo i client associati agli utenti della stessa factory
                 query += ` AND factory = (SELECT factory FROM users WHERE id = ?)`;
                 queryParams.push(req.session.user.id);
                 break;
            case 'specific-users':
                // Filtra per i client degli utenti specifici
                if (permissions.userIds && Array.isArray(permissions.userIds) && permissions.userIds.length > 0) {
                    query += ` AND id IN (${permissions.userIds.map(() => '?').join(',')})`;
                    queryParams.push(...permissions.userIds);
                } else {
                    console.warn(`Permessi 'specific-users' senza userIds validi per utente ${req.session.user.id} per i client. Restituisco array vuoto.`); // Log in italiano
                    return res.json([]);
                }
                break;
            default:
                console.warn(`Livello permessi non riconosciuto '${level}' per utente ${req.session.user.id} per i client. Restituisco array vuoto.`); // Log in italiano
                return res.json([]);
        }

        query += ` ORDER BY client_company_name ASC`; // Aggiungi ordinamento

        console.log('Query SQL per client filtrati:', query); // Log in italiano
        console.log('Parametri query per client:', queryParams); // Log in italiano

        req.db.all(query, queryParams, (err, rows) => {
            if (err) {
                console.error('Errore nel recupero dei client filtrati:', err); // Log in italiano
                return res.status(500).json({ error: 'Server error fetching filtered clients' }); // Messaggio in inglese
            }
            const clientNames = rows.map(row => row.client_company_name).filter(Boolean);
            console.log('Client filtrati restituiti:', clientNames); // Log in italiano
            res.json(clientNames);
        });

    } catch (error) {
        console.error('Errore generale nel recupero dei client filtrati:', error); // Log in italiano
        res.status(500).json({ error: 'Internal server error' }); // Messaggio in inglese
    }
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
        // Inizializza tutte le pagine conosciute (incluse Configuration) a false/oggetti vuoti
        // Questo assicura che anche se non ci sono permessi salvati, la struttura base esista
        const knownPages = ['Projects', 'Users', 'Tasks', 'CRUD', 'Configuration'];
        knownPages.forEach(page => {
            crud[page] = page === 'Configuration' ? { read: false } : {};
        });


        rows.forEach(row => {
            // Gestione speciale per il permesso CRUD visible (ID 17)
            if (row.id === 17) {
                 // Log per debug
                console.log(`Trovato permesso CRUD visible (ID: ${row.id}) per utente ${userId}`);
                crud['CRUD'] = {
                    read: {
                        enabled: true,
                        scope: 'all',
                        crudId: 17 // Manteniamo l'ID per riferimento se necessario
                    }
                };
                 console.log('Permesso CRUD visible impostato:', crud['CRUD']);
                return; // Passa alla prossima riga
            }

            // Assicurati che la pagina esista nell'oggetto crud
            if (!crud[row.page]) {
                 console.log(`Inizializzazione pagina ${row.page} nell'oggetto crud`);
                crud[row.page] = {};
            }

            // Gestione specifica per Configuration.read
            if (row.page === 'Configuration' && row.action === 'Read') {
                 console.log(`Trovato permesso Configuration Read (ID: ${row.id}) per utente ${userId}`);
                crud[row.page].read = true; // Imposta semplicemente a true se la riga esiste
                 console.log('Permesso Configuration Read impostato:', crud[row.page]);
            } else if (row.action === 'Read') { // Gestione Read per altre pagine
                 console.log(`Trovato permesso Read per ${row.page} (ID: ${row.id})`);
                let properties;
                try {
                    properties = row.properties ? JSON.parse(row.properties) : {};
                     console.log(`Properties per ${row.page} Read:`, properties);
                } catch (e) {
                    console.error(`Errore nel parsing delle properties per ${row.page} Read (ID: ${row.id}):`, e);
                    properties = { enabled: true, scope: 'all', level: 'all' }; // Fallback
                }

                crud[row.page].read = {
                    enabled: properties.enabled !== false,
                    scope: properties.scope || properties.level || 'all', // Usa scope o level come fallback
                    userIds: properties.userIds,
                    factory: row.factory, // Aggiunto per contesto
                    client_company_name: row.client_company_name // Aggiunto per contesto
                };
                 console.log(`Permesso ${row.page} Read impostato:`, crud[row.page].read);
            } else { // Gestione Create, Update, Delete
                 console.log(`Trovato permesso ${row.action} per ${row.page} (ID: ${row.id})`);
                crud[row.page][row.action.toLowerCase()] = true;
                 console.log(`Permesso ${row.page} ${row.action.toLowerCase()} impostato:`, crud[row.page][row.action.toLowerCase()]);
            }
        });

         // Log finale dell'oggetto crud prima dell'invio
        console.log(`Oggetto CRUD finale per utente ${userId}:`, JSON.stringify(crud, null, 2));
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
        
        // Processa le azioni CRUD ricevute dal frontend
        for (const [page, actions] of Object.entries(crud)) {
             console.log(`Processando pagina: ${page}, Azioni:`, actions); // Log

            // Gestione speciale per il permesso CRUD visible (inviato come 'crud_visible')
            if (page === 'crud_visible' && actions.id === 17 && actions.enabled) {
                 console.log(`Aggiungendo permesso CRUD visible (ID: 17) per utente ${userId}`); // Log
                permissions.push({
                    userId,
                    crudId: 17,
                    properties: null // Nessuna proprietà necessaria per questo
                });
                continue; // Passa alla prossima pagina
            }

            // Gestione specifica per Configuration
            if (page === 'Configuration') {
                if (actions.read === true) {
                    const crudId = await getCrudId(page, 'Read');
                    if (crudId) {
                         console.log(`Aggiungendo permesso Configuration Read (ID: ${crudId}) per utente ${userId}`); // Log
                        permissions.push({
                            userId,
                            crudId,
                            properties: null // Nessuna proprietà necessaria per Configuration.read
                        });
                    } else {
                         console.warn(`CRUD ID non trovato per ${page}/Read`); // Log avviso
                    }
                }
                continue; // Configuration ha solo 'read'
            }

            // Gestione per le altre pagine (Projects, Users, Tasks, CRUD)
            for (const [action, value] of Object.entries(actions)) {
                const actionName = action.charAt(0).toUpperCase() + action.slice(1); // Es. 'read' -> 'Read'
                 console.log(`Processando azione: ${actionName} per pagina ${page}, Valore:`, value); // Log

                if (action === 'read' && typeof value === 'object') { // Gestione Read con scope/properties
                    if (value.enabled) {
                        const crudId = await getCrudId(page, actionName);
                        if (crudId) {
                             console.log(`Aggiungendo permesso ${page} ${actionName} (ID: ${crudId}) con properties`); // Log
                            // Prepara le properties da salvare
                            const properties = {
                                enabled: true,
                                scope: value.scope || 'all',
                                level: value.scope || 'all', // Mantieni 'level' per compatibilità se necessario
                                userIds: value.userIds || [] // Assicura che userIds sia sempre un array
                            };

                            // Logica per mantenere userIds esistenti se non forniti (come prima)
                            if ((value.scope === 'specific-users' || value.scope === 'user-tasks') && !Array.isArray(value.userIds)) {
                                 console.log(`Recupero userIds esistenti per ${page}/${actionName}`); // Log
                                const existingPerms = await new Promise((resolve, reject) => {
                                    req.db.get('SELECT properties FROM user_crud WHERE user_id = ? AND crud_id = ?', [userId, crudId], (err, row) => {
                                        if (err) reject(err); else resolve(row);
                                    });
                                });
                                if (existingPerms && existingPerms.properties) {
                                    try {
                                        const existingProps = JSON.parse(existingPerms.properties);
                                        if (Array.isArray(existingProps.userIds)) {
                                            properties.userIds = existingProps.userIds;
                                             console.log(`UserIds esistenti recuperati: ${properties.userIds}`); // Log
                                        }
                                    } catch (e) { console.error('Errore parsing properties esistenti:', e); }
                                }
                            }

                            permissions.push({
                                userId,
                                crudId,
                                properties: JSON.stringify(properties)
                            });
                             console.log(`Permesso ${page} ${actionName} aggiunto con properties:`, properties); // Log
                        } else {
                             console.warn(`CRUD ID non trovato per ${page}/${actionName}`); // Log avviso
                        }
                    }
                } else if (value === true) { // Gestione Create, Update, Delete (e potenzialmente Read per CRUD se non ha properties)
                    const crudId = await getCrudId(page, actionName);
                    if (crudId) {
                         console.log(`Aggiungendo permesso ${page} ${actionName} (ID: ${crudId}) senza properties`); // Log
                        permissions.push({
                            userId,
                            crudId,
                            properties: null // Nessuna proprietà per azioni semplici
                        });
                    } else {
                         console.warn(`CRUD ID non trovato per ${page}/${actionName}`); // Log avviso
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
