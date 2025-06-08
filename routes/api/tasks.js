const express = require('express');
const router = express.Router();
const checkAuthentication = require('../middleware/auth');

// Endpoint per ottenere le attività in base ai permessi specifici dell'utente
router.get('/', checkAuthentication, async (req, res) => {
    try {
        // Ottieni i permessi CRUD dell'utente per la pagina tasks
        const permissionsQuery = `
            SELECT c.properties, uc.properties as user_properties
            FROM crud c
            LEFT JOIN user_crud uc ON uc.crud_id = c.id AND uc.user_id = ?
            WHERE c.page = 'Tasks' 
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
            query += ` AND ph.status != 'Completed'`;
        }

        // Se user_properties è NULL, l'utente non ha permessi di lettura
        if (!user.user_properties) {
            return res.status(403).json({ error: 'Permesso di lettura negato' });
        }

        // Parsing dei permessi
        let permissions;
        try {
            console.log('User properties raw:', user.user_properties); // Log raw properties
            permissions = JSON.parse(user.user_properties);
            console.log('Permessi parsati:', permissions); // Log parsed permissions
            
            // Verifica che i permessi siano abilitati
            if (!permissions.enabled) {
                return res.status(403).json({ error: 'Permessi non abilitati' });
            }
        } catch (error) {
            console.error('Errore nel parsing dei permessi:', error);
            console.error('JSON non valido:', user.user_properties);
            return res.status(403).json({ error: 'Permessi non validi' });
        }

        // Applica i filtri in base al livello dei permessi
        const level = permissions.level || permissions.scope;
        console.log('Livello permessi applicato:', level); // Log permission level

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
                
                const userPerms = await new Promise((resolve, reject) => {
                    req.db.get(userPermsQuery, [req.session.user.id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });

                if (userPerms && userPerms.properties) {
                    try {
                        const userProps = JSON.parse(userPerms.properties);
                        if (Array.isArray(userProps.userIds) && userProps.userIds.length > 0) {
                            query += ` AND EXISTS (
                                SELECT 1 FROM users u
                                WHERE u.name = ph.assigned_to
                                AND u.id IN (${userProps.userIds.map(() => '?').join(',')})
                            )`;
                            queryParams.push(...userProps.userIds);
                        } else {
                            return res.status(403).json({ error: 'Nessun utente specifico definito nei permessi' });
                        }
                    } catch (e) {
                        console.error('Errore nel parsing delle properties degli utenti:', e);
                        return res.status(403).json({ error: 'Permessi non validi' });
                    }
                } else {
                    return res.status(403).json({ error: 'Nessun utente specifico definito nei permessi' });
                }
                break;
            case 'all':
                // Nessun filtro necessario
                break;
            default:
                return res.status(403).json({ error: 'Scope non valido' });
        }
        // Log della query e dei parametri prima dell'esecuzione
        console.log('Query SQL:', query);
        console.log('Parametri query:', queryParams);
        console.log('User ID:', req.session.user.id);
        console.log('User Name:', req.session.user.name);

        // Esegui la query con i parametri
        req.db.all(query, queryParams, (err, rows) => {
            if (err) {
                console.error('Errore nel recupero delle attività:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            console.log('Numero di righe trovate:', rows.length); // Log number of results
            console.log('Prima riga risultato:', rows[0]); // Log first result for sample
            res.json(rows);
        });
    } catch (error) {
        console.error('Errore:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Endpoint per ottenere il conteggio dei task nuovi per l'utente corrente
router.get('/new-count', checkAuthentication, async (req, res) => {
    try {
        const query = `
            SELECT COUNT(*) as count
            FROM project_history ph
            JOIN projects p ON ph.project_id = p.id
            WHERE ph.assigned_to = ?
            AND ph.is_new = 1
        `;
        
        req.db.get(query, [req.session.user.name], (err, row) => {
            if (err) {
                console.error('Errore nel conteggio dei task nuovi:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            res.json({ count: row.count });
        });
    } catch (error) {
        console.error('Errore:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Endpoint per aggiornare il campo is_new dei project history con status "In Progress"
router.post('/urge-project-tasks/:projectId', checkAuthentication, async (req, res) => {
    try {
        const { projectId } = req.params;
        
        // Aggiorna tutti i project history con status "In Progress" per questo progetto
        // impostando il campo is_new a 1
        const query = `
            UPDATE project_history
            SET is_new = 1
            WHERE project_id = ? 
            AND status = 'In Progress'
        `;
        
        req.db.run(query, [projectId], function(err) {
            if (err) {
                console.error('Errore nell\'aggiornamento dei task urgenti:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            
            // Restituisci il numero di righe aggiornate
            res.json({ 
                success: true, 
                message: 'Tasks aggiornati correttamente', 
                rowsAffected: this.changes 
            });
        });
    } catch (error) {
        console.error('Errore:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Esporta il router come oggetto per mantenere la consistenza con gli altri router
module.exports = router;
