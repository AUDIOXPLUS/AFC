const express = require('express');
const router = express.Router();
const checkAuthentication = require('../middleware/auth');

// Timeout personalizzato per /api/tasks (10 secondi)
router.use('/', (req, res, next) => {
    res.setTimeout(10000, () => {
        console.error('Richiesta /api/tasks scaduta per:', req.ip);
        res.status(504).json({ error: 'Timeout della richiesta /api/tasks' });
    });
    next();
});

// Endpoint per ottenere le attività in base ai permessi specifici dell'utente
router.get('/', checkAuthentication, async (req, res) => {
    console.log(`[LOG DEBUG] GET / - Inizio richiesta per utente ID: ${req.session.user.id}, Nome: ${req.session.user.name}`);
    try {
        // Ottieni i permessi CRUD dell'utente per la pagina tasks
        const permissionsQuery = `
            SELECT c.properties, uc.properties as user_properties
            FROM crud c
            LEFT JOIN user_crud uc ON uc.crud_id = c.id AND uc.user_id = ?
            WHERE c.page = 'Tasks' 
            AND c.action = 'Read'
        `;
        
        console.log(`[LOG DEBUG] Esecuzione permissionsQuery per utente ID: ${req.session.user.id}`);
        const user = await new Promise((resolve, reject) => {
            req.db.get(permissionsQuery, [req.session.user.id], (err, row) => {
                if (err) {
                    console.error(`[LOG ERROR] Errore in permissionsQuery per utente ID: ${req.session.user.id}`, err);
                    reject(err);
                } else {
                    console.log(`[LOG DEBUG] Risultato permissionsQuery per utente ID: ${req.session.user.id}`, row);
                    resolve(row);
                }
            });
        });

        if (!user) {
            console.warn(`[LOG DEBUG] Utente non trovato o permessi base non trovati per Tasks Read per utente ID: ${req.session.user.id}`);
            return res.status(403).json({ error: 'Utente non trovato o permessi base mancanti' });
        }

        // Query base per i task
        let query = `
            SELECT 
                ph.id, 
                ph.project_id AS projectId, 
                p.factory,
                p.modelNumber, 
                ph.date, 
                ph.description, 
                ph.assigned_to AS assignedTo, 
                ph.status,
                ph.is_new,
                p.priority,
                ph.created_by AS createdBy
            FROM 
                project_history ph
            JOIN 
                projects p ON ph.project_id = p.id
            WHERE 1=1
        `;
        const queryParams = [];

        // Se non richiesto esplicitamente, escludi i task completati per migliorare le performance
        if (req.query.includeCompleted !== 'true') {
            console.log('[LOG DEBUG] Esclusione task completati.');
            query += ` AND ph.status != 'Completed'`;
        } else {
            console.log('[LOG DEBUG] Inclusione task completati.');
        }

        // Se user_properties è NULL, l'utente non ha permessi di lettura specifici per Tasks.Read
        if (!user.user_properties) {
            console.warn(`[LOG DEBUG] user_properties è NULL per Tasks Read per utente ID: ${req.session.user.id}. Permesso di lettura negato.`);
            return res.status(403).json({ error: 'Permesso di lettura negato' });
        }

        // Parsing dei permessi
        let permissions;
        try {
            console.log('[LOG DEBUG] User properties raw (user.user_properties):', user.user_properties); // Log raw properties
            permissions = JSON.parse(user.user_properties);
            console.log('[LOG DEBUG] Permessi Tasks Read parsati:', JSON.stringify(permissions, null, 2)); // Log parsed permissions
            
            // Verifica che i permessi siano abilitati
            // Modificato per gestire il caso in cui 'enabled' potrebbe non essere presente, assumendo true se non specificato o gestendo come errore
            if (permissions.enabled === undefined) {
                 console.warn(`[LOG DEBUG] Proprietà 'enabled' mancante nei permessi Tasks Read per utente ID: ${req.session.user.id}. Permessi: ${JSON.stringify(permissions)}. Assumendo non abilitato.`);
                 // Decidi se questo deve essere un errore o un default. Per sicurezza, trattiamolo come non abilitato se non esplicitamente true.
                 // Se vuoi che sia un errore fatale, cambia in res.status(500) o 403.
                 // Se vuoi un default (es. true se mancante), cambia la logica.
                 // Per ora, se non è esplicitamente true, neghiamo.
                 if (permissions.enabled !== true) { // Questo sarà sempre vero se enabled è undefined
                    return res.status(403).json({ error: "Proprietà 'enabled' mancante o non esplicitamente true nei permessi" });
                 }
            } else if (!permissions.enabled) {
                console.warn(`[LOG DEBUG] Permessi Tasks Read non abilitati (enabled: false) per utente ID: ${req.session.user.id}`);
                return res.status(403).json({ error: 'Permessi non abilitati' });
            }
        } catch (error) {
            console.error('[LOG ERROR] Errore nel parsing dei permessi (user.user_properties):', error);
            console.error('[LOG ERROR] JSON non valido (user.user_properties):', user.user_properties);
            return res.status(500).json({ error: 'Errore interno: Permessi Tasks Read non validi' });
        }

        // Applica i filtri in base al livello dei permessi
        const level = permissions.level || permissions.scope;
        console.log('[LOG DEBUG] Livello permessi Tasks Read applicato:', level); // Log permission level

        switch (level) {
            case 'own':
                query += ` AND ph.assigned_to = ?`;
                queryParams.push(req.session.user.name);
                break;
            case 'own-factory':
                // L'utente vede i task se:
                // 1. Il progetto appartiene alla sua factory OPPURE
                // 2. Il task è assegnato direttamente a lui/lei
                query += ` AND (
                    p.factory = (SELECT factory FROM users WHERE id = ?) 
                    OR 
                    ph.assigned_to = ?
                )`;
                // Aggiungiamo sia l'ID utente (per la factory) sia il nome utente (per l'assegnazione diretta)
                queryParams.push(req.session.user.id, req.session.user.name);
                break;
            case 'all-factories':
                // Ottieni tutti i task di tutte le factories
                query += ` AND EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.name = ph.assigned_to
                )`;
                break;
            case 'client':
            case 'own-client':
                query += ` AND p.client = (SELECT client_company_name FROM users WHERE id = ?)`;
                queryParams.push(req.session.user.id);
                break;
            case 'user-tasks':
                console.log('[LOG DEBUG] Caso permessi: user-tasks');
                // Recupera gli userIds dai permessi degli utenti
                const userPermsQuery = `
                    SELECT uc.properties
                    FROM crud c
                    JOIN user_crud uc ON c.id = uc.crud_id
                    WHERE c.page = 'Users'
                    AND c.action = 'Read'
                    AND uc.user_id = ?
                    AND uc.properties IS NOT NULL
                `;
                
                console.log(`[LOG DEBUG] Esecuzione userPermsQuery per utente ID: ${req.session.user.id}`);
                const userPerms = await new Promise((resolve, reject) => {
                    req.db.get(userPermsQuery, [req.session.user.id], (err, row) => {
                        if (err) {
                            console.error(`[LOG ERROR] Errore in userPermsQuery per utente ID: ${req.session.user.id}`, err);
                            reject(err);
                        } else {
                            console.log(`[LOG DEBUG] Risultato userPermsQuery per utente ID: ${req.session.user.id}`, row);
                            resolve(row);
                        }
                    });
                });

                if (userPerms && userPerms.properties) {
                    try {
                        console.log('[LOG DEBUG] User properties raw per Users Read (userPerms.properties):', userPerms.properties);
                        const userProps = JSON.parse(userPerms.properties);
                        console.log('[LOG DEBUG] Parsed userProps per Users Read:', JSON.stringify(userProps, null, 2));

                        if (Array.isArray(userProps.userIds) && userProps.userIds.length > 0) {
                            console.log('[LOG DEBUG] userProps.userIds per Users Read:', JSON.stringify(userProps.userIds));
                            query += ` AND EXISTS (
                                SELECT 1 FROM users u
                                WHERE u.name = ph.assigned_to
                                AND u.id IN (${userProps.userIds.map(() => '?').join(',')})
                            )`;
                            queryParams.push(...userProps.userIds);
                        } else {
                            console.warn('[LOG DEBUG] userProps.userIds per Users Read è vuoto o non un array. userIds:', userProps.userIds);
                            return res.status(403).json({ error: 'Nessun utente specifico definito nei permessi Users Read per la logica user-tasks' });
                        }
                    } catch (e) {
                        console.error('[LOG ERROR] Errore nel parsing delle properties degli utenti (userPerms.properties):', e);
                        console.error('[LOG ERROR] JSON non valido (userPerms.properties):', userPerms.properties);
                        return res.status(500).json({ error: 'Errore interno: Permessi Users Read non validi' });
                    }
                } else {
                    console.warn(`[LOG DEBUG] Nessun userPerms o userPerms.properties trovato per Users Read per utente ID: ${req.session.user.id}`);
                    return res.status(403).json({ error: 'Permessi Users Read non trovati per la logica user-tasks' });
                }
                break;
            case 'all':
                // Nessun filtro necessario
                break;
            default:
                console.warn('[LOG DEBUG] Scope/level non valido nei permessi Tasks Read:', level);
                return res.status(403).json({ error: 'Scope non valido' });
        }
        
        console.log('[LOG DEBUG] Query SQL finale:', query);
        console.log('[LOG DEBUG] Parametri query finali:', JSON.stringify(queryParams));
        console.log(`[LOG DEBUG] Esecuzione query principale per utente ID: ${req.session.user.id}, Nome: ${req.session.user.name}`);

        // Esegui la query con i parametri
        req.db.all(query, queryParams, (err, rows) => {
            if (err) {
                console.error(`[LOG ERROR] Errore nell'esecuzione della query principale per utente ID: ${req.session.user.id}`, err);
                return res.status(500).json({ error: 'Errore del server nel recupero delle attività' });
            }
            console.log(`[LOG DEBUG] Query principale completata. Numero di righe trovate: ${rows.length} per utente ID: ${req.session.user.id}`); // Log number of results
            if (rows && rows.length > 0) { // Aggiunto controllo per rows non null
                console.log('[LOG DEBUG] Prima riga risultato:', JSON.stringify(rows[0], null, 2)); // Log first result for sample
            }
            res.json(rows);
        });
    } catch (error) {
        console.error(`[LOG ERROR] Errore non gestito nel blocco try/catch principale di GET / per utente ID: ${req.session.user.id || 'sconosciuto'}`, error);
        res.status(500).json({ error: 'Errore del server non gestito' });
    }
});

// Endpoint per ottenere il conteggio dei task nuovi per l'utente corrente
router.get('/new-count', checkAuthentication, async (req, res) => {
    console.log(`[LOG DEBUG] GET /new-count - Inizio richiesta per utente ID: ${req.session.user.id}, Nome: ${req.session.user.name}`);
    try {
        const query = `
            SELECT COUNT(*) as count
            FROM project_history ph
            JOIN projects p ON ph.project_id = p.id
            WHERE ph.assigned_to = ?
            AND ph.is_new = 1
        `;
        
        console.log(`[LOG DEBUG] Esecuzione query per /new-count per utente: ${req.session.user.name}`);
        req.db.get(query, [req.session.user.name], (err, row) => {
            if (err) {
                console.error(`[LOG ERROR] Errore nel conteggio dei task nuovi per utente: ${req.session.user.name}`, err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            console.log(`[LOG DEBUG] Conteggio task nuovi per ${req.session.user.name}: ${row ? row.count : 'nessun risultato (row è null/undefined)'}`);
            res.json({ count: row ? row.count : 0 }); // Assicura che row esista e count sia un numero
        });
    } catch (error) {
        console.error(`[LOG ERROR] Errore non gestito in GET /new-count per utente ID: ${req.session.user.id || 'sconosciuto'}`, error);
        res.status(500).json({ error: 'Errore del server non gestito' });
    }
});

// Endpoint per aggiornare il campo is_new dei project history con status "In Progress"
router.post('/urge-project-tasks/:projectId', checkAuthentication, async (req, res) => {
    const { projectId } = req.params;
    console.log(`[LOG DEBUG] POST /urge-project-tasks/${projectId} - Inizio richiesta per utente ID: ${req.session.user.id}`);
    try {
        // Aggiorna tutti i project history con status "In Progress" per questo progetto
        // impostando il campo is_new a 1
        const query = `
            UPDATE project_history
            SET is_new = 1
            WHERE project_id = ? 
            AND status = 'In Progress'
        `;
        
        console.log(`[LOG DEBUG] Esecuzione query per /urge-project-tasks/${projectId}`);
        req.db.run(query, [projectId], function(err) { // Usare function() per accedere a this.changes
            if (err) {
                console.error(`[LOG ERROR] Errore nell'aggiornamento dei task urgenti per progetto ID: ${projectId}`, err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            
            console.log(`[LOG DEBUG] Task urgenti aggiornati per progetto ID: ${projectId}. Righe modificate: ${this.changes}`);
            // Restituisci il numero di righe aggiornate
            res.json({ 
                success: true, 
                message: 'Tasks aggiornati correttamente', 
                rowsAffected: this.changes 
            });
        });
    } catch (error) {
        console.error(`[LOG ERROR] Errore non gestito in POST /urge-project-tasks/${projectId} per utente ID: ${req.session.user.id || 'sconosciuto'}`, error);
        res.status(500).json({ error: 'Errore del server non gestito' });
    }
});

// Esporta il router come oggetto per mantenere la consistenza con gli altri router
module.exports = router;
