const express = require('express');
const router = express.Router();
const checkAuthentication = require('../middleware/auth');
const path = require('path');
const fs = require('fs-extra');

// Endpoint per ottenere i progetti in base ai permessi
router.get('/', checkAuthentication, async (req, res) => {
    try {
        const showArchived = req.query.showArchived === 'true';
        const showOnHold = req.query.showOnHold === 'true';
        const countOnly = req.query.countOnly === 'true';
        
        // Se viene richiesto solo il conteggio, restituisci i conteggi per categoria
        if (countOnly) {
            // Ottieni i permessi CRUD dell'utente per la pagina projects
            const permissionsQuery = `
                SELECT c.properties, uc.properties as user_properties
                FROM crud c
                LEFT JOIN user_crud uc ON uc.crud_id = c.id AND uc.user_id = ?
                WHERE c.page = 'Projects' 
                AND c.action = 'Read'
            `;
            
            const user = await new Promise((resolve, reject) => {
                req.db.get(permissionsQuery, [req.session.user.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!user || !user.user_properties) {
                return res.status(403).json({ error: 'Permesso di lettura negato' });
            }

            let permissions;
            try {
                permissions = JSON.parse(user.user_properties);
                
                if (!permissions.enabled) {
                    return res.status(403).json({ error: 'Permessi non abilitati' });
                }
            } catch (error) {
                console.error('Errore nel parsing dei permessi:', error);
                return res.status(403).json({ error: 'Permessi non validi' });
            }

            // Costruisci le query per contare i progetti per categoria
            const countParams = [];
            let permissionsFilter = '';
            const level = permissions.level || permissions.scope;
            
            // Applica i filtri di permesso in base al livello
            switch (level) {
                case 'own':
                    permissionsFilter = ` AND EXISTS (
                        SELECT 1 FROM project_history ph
                        WHERE ph.project_id = p.id
                        AND ph.assigned_to = ?
                    )`;
                    countParams.push(req.session.user.name);
                    break;
                case 'own-factory':
                    permissionsFilter = ` AND factory = (
                        SELECT factory FROM users WHERE id = ?
                    )`;
                    countParams.push(req.session.user.id);
                    break;
                case 'all-factories':
                    permissionsFilter = ` AND factory IS NOT NULL`;
                    break;
                case 'own-client':
                    permissionsFilter = ` AND client = (
                        SELECT client_company_name FROM users WHERE id = ?
                    )`;
                    countParams.push(req.session.user.id);
                    break;
                case 'all-clients':
                    permissionsFilter = ` AND client IS NOT NULL`;
                    break;
                case 'user-projects':
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
                                permissionsFilter = ` AND EXISTS (
                                    SELECT 1 FROM project_history ph
                                    JOIN users u ON ph.assigned_to = u.name
                                    WHERE ph.project_id = p.id
                                    AND u.id IN (${userProps.userIds.map(() => '?').join(',')})
                                )`;
                                countParams.push(...userProps.userIds);
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
                    // Nessun filtro aggiuntivo
                    break;
                default:
                    return res.status(403).json({ error: 'Scope non valido' });
            }

            // Query per contare i progetti archiviati
            const archivedQuery = `
                SELECT COUNT(*) as count
                FROM projects p
                LEFT JOIN (
                    SELECT ph1.*
                    FROM project_history ph1
                    LEFT JOIN project_history ph2 ON ph1.project_id = ph2.project_id AND 
                                                   (ph1.date < ph2.date OR (ph1.date = ph2.date AND ph1.id < ph2.id))
                    WHERE ph2.id IS NULL
                ) latest_history ON p.id = latest_history.project_id
                WHERE archived = 1
                ${permissionsFilter}
            `;

            // Query per contare i progetti on hold
            const onHoldQuery = `
                SELECT COUNT(*) as count
                FROM projects p
                LEFT JOIN (
                    SELECT ph1.*
                    FROM project_history ph1
                    LEFT JOIN project_history ph2 ON ph1.project_id = ph2.project_id AND 
                                                   (ph1.date < ph2.date OR (ph1.date = ph2.date AND ph1.id < ph2.id))
                    WHERE ph2.id IS NULL
                ) latest_history ON p.id = latest_history.project_id
                WHERE archived = 0 
                AND EXISTS (
                   SELECT 1 FROM project_history ph 
                   WHERE ph.project_id = p.id 
                   AND ph.status = 'On Hold'
                   AND NOT EXISTS (
                       SELECT 1 FROM project_history ph2
                       WHERE ph2.project_id = p.id
                       AND ph2.date > ph.date
                   )
                )
                ${permissionsFilter}
            `;

            // Query per contare i progetti attivi (non archiviati e non on hold)
            const activeQuery = `
                SELECT COUNT(*) as count
                FROM projects p
                LEFT JOIN (
                    SELECT ph1.*
                    FROM project_history ph1
                    LEFT JOIN project_history ph2 ON ph1.project_id = ph2.project_id AND 
                                                   (ph1.date < ph2.date OR (ph1.date = ph2.date AND ph1.id < ph2.id))
                    WHERE ph2.id IS NULL
                ) latest_history ON p.id = latest_history.project_id
                WHERE archived = 0
                AND NOT EXISTS (
                   SELECT 1 FROM project_history ph 
                   WHERE ph.project_id = p.id 
                   AND ph.status = 'On Hold'
                   AND NOT EXISTS (
                       SELECT 1 FROM project_history ph2
                       WHERE ph2.project_id = p.id
                       AND ph2.date > ph.date
                   )
                )
                ${permissionsFilter}
            `;

            // Esegui le query per ottenere i conteggi
            const [archivedCount, onHoldCount, activeCount] = await Promise.all([
                new Promise((resolve, reject) => {
                    req.db.get(archivedQuery, countParams, (err, row) => {
                        if (err) reject(err);
                        else resolve(row?.count || 0);
                    });
                }),
                new Promise((resolve, reject) => {
                    req.db.get(onHoldQuery, countParams, (err, row) => {
                        if (err) reject(err);
                        else resolve(row?.count || 0);
                    });
                }),
                new Promise((resolve, reject) => {
                    req.db.get(activeQuery, countParams, (err, row) => {
                        if (err) reject(err);
                        else resolve(row?.count || 0);
                    });
                })
            ]);

            // Restituisci i conteggi come JSON
            return res.json({
                archived: archivedCount,
                onHold: onHoldCount,
                active: activeCount,
                total: archivedCount + onHoldCount + activeCount
            });
        }
        // Ottieni i permessi CRUD dell'utente per la pagina projects
        const permissionsQuery = `
            SELECT c.properties, uc.properties as user_properties
            FROM crud c
            LEFT JOIN user_crud uc ON uc.crud_id = c.id AND uc.user_id = ?
            WHERE c.page = 'Projects' 
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

        const queryParams = [];
        
        // Costruisci la query in base allo stato dei toggle, includendo informazioni sullo status più recente
        let query = `
            SELECT p.*, 
                   latest_history.status as latest_status, 
                   latest_history.description as latest_description, 
                   latest_history.assigned_to as latest_assigned_to,
                   latest_history.private_by as latest_private_by
            FROM projects p
            LEFT JOIN (
                SELECT ph1.*
                FROM project_history ph1
                LEFT JOIN project_history ph2 ON ph1.project_id = ph2.project_id AND 
                                               (ph1.date < ph2.date OR (ph1.date = ph2.date AND ph1.id < ph2.id))
                WHERE ph2.id IS NULL
            ) latest_history ON p.id = latest_history.project_id
            WHERE 1=1`;
        
        // Gestisci i casi possibili per i toggle showArchived e showOnHold
        if (showArchived && !showOnHold) {
            // CASO 1: Mostra SOLO progetti archiviati
            query += ' AND archived = 1';
        } else if (!showArchived && showOnHold) {
            // CASO 2: Mostra SOLO progetti on hold
            query += ' AND archived = 0 AND EXISTS (';
            query += `   SELECT 1 FROM project_history ph 
                         WHERE ph.project_id = p.id 
                         AND ph.status = 'On Hold'
                         AND NOT EXISTS (
                             SELECT 1 FROM project_history ph2
                             WHERE ph2.project_id = p.id
                             AND ph2.date > ph.date
                         )
                    )`;
        } else if (showArchived && showOnHold) {
            // CASO 3: Mostra sia progetti archiviati che on hold
            query += ` AND (archived = 1 OR EXISTS (
                         SELECT 1 FROM project_history ph 
                         WHERE ph.project_id = p.id 
                         AND ph.status = 'On Hold'
                         AND NOT EXISTS (
                             SELECT 1 FROM project_history ph2
                             WHERE ph2.project_id = p.id
                             AND ph2.date > ph.date
                         )
                      ))`;
        } else {
            // CASO 4: Mostra solo progetti normali (non archiviati e non on hold)
            query += ' AND archived = 0';
            query += ` AND NOT EXISTS (
                         SELECT 1 FROM project_history ph 
                         WHERE ph.project_id = p.id 
                         AND ph.status = 'On Hold'
                         AND NOT EXISTS (
                             SELECT 1 FROM project_history ph2
                             WHERE ph2.project_id = p.id
                             AND ph2.date > ph.date
                         )
                      )`;
        }

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
            case 'own':
                // Progetti assegnati all'utente corrente
                query += ` AND EXISTS (
                    SELECT 1 FROM project_history ph
                    WHERE ph.project_id = p.id
                    AND ph.assigned_to = ?
                )`;
                queryParams.push(req.session.user.name);
                break;
            case 'own-factory':
                // Progetti della stessa factory dell'utente
                query += ` AND factory = (
                    SELECT factory 
                    FROM users 
                    WHERE id = ?
                )`;
                queryParams.push(req.session.user.id);
                break;
            case 'all-factories':
                // Progetti di tutte le factories
                query += ` AND factory IS NOT NULL`;
                break;
            case 'own-client':
                // Progetti dello stesso cliente dell'utente
                query += ` AND client = (
                    SELECT client_company_name 
                    FROM users 
                    WHERE id = ?
                )`;
                queryParams.push(req.session.user.id);
                break;
            case 'all-clients':
                // Progetti di tutti i clienti
                query += ` AND client IS NOT NULL`;
                break;
            case 'user-projects':
                // Se sono specificati utenti specifici nei permessi, recupera i loro progetti
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
                                SELECT 1 FROM project_history ph
                                JOIN users u ON ph.assigned_to = u.name
                                WHERE ph.project_id = p.id
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

        console.log('Query SQL:', query);
        console.log('Parametri query:', queryParams);

        req.db.all(query, queryParams, (err, rows) => {
            if (err) {
                console.error('Errore nel recupero dei progetti:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            console.log('Numero di righe trovate:', rows.length);
            console.log('Prima riga risultato:', rows[0]);
            if (err) {
                console.error('Errore nel recupero dei progetti:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            console.log('Numero di progetti trovati:', rows.length);
            // Se non ci sono progetti, restituisci un array vuoto
            if (rows.length === 0) {
                return res.json([]);
            }

            // Estrai gli ID dei progetti trovati
            const projectIds = rows.map(p => p.id);
            const placeholders = projectIds.map(() => '?').join(',');

            // Seconda query per recuperare i dati aggregati della cronologia per la progress bar
            const historySummaryQuery = `
                SELECT
                    ph.project_id,
                    ph.phase as phase_id,
                    MAX(CASE WHEN ph.status = 'In Progress' THEN 1 ELSE 0 END) as hasInProgress,
                    MAX(CASE WHEN ph.status = 'Completed' THEN 1 ELSE 0 END) as hasCompleted,
                    MAX(CASE WHEN ph.is_new = 1 THEN 1 ELSE 0 END) as hasNew
                FROM project_history ph
                WHERE ph.project_id IN (${placeholders})
                AND (
                    ph.private_by IS NULL 
                    OR ph.private_by = ? 
                    OR ph.private_by LIKE ? 
                    OR ph.private_by LIKE ? 
                    OR ph.private_by LIKE ?
                )
                GROUP BY ph.project_id, ph.phase
            `;

            // Prepara i parametri per la ricerca con separatore virgola per la visibilità
            const userId = req.session.user.id;
            const userIdStr = String(userId);
            const patterns = [
                `${userIdStr}`,           // ID singolo
                `${userIdStr},%`,         // Primo elemento della lista
                `%,${userIdStr},%`,       // Elemento in mezzo alla lista
                `%,${userIdStr}`          // Ultimo elemento della lista
            ];
            const historyParams = [...projectIds, userId, patterns[1], patterns[2], patterns[3]];

            req.db.all(historySummaryQuery, historyParams, (historyErr, summaryRows) => {
                if (historyErr) {
                    console.error('Errore nel recupero del sommario della cronologia:', historyErr);
                    return res.status(500).json({ error: 'Errore del server nel recupero del sommario della cronologia' });
                }

                // Raggruppa i sommari per project_id
                const summaryMap = {};
                summaryRows.forEach(s => {
                    if (!summaryMap[s.project_id]) {
                        summaryMap[s.project_id] = [];
                    }
                    summaryMap[s.project_id].push({
                        phaseId: s.phase_id,
                        hasInProgress: s.hasInProgress,
                        hasCompleted: s.hasCompleted,
                        hasNew: s.hasNew
                    });
                });

                // Aggiungi l'array di sommario a ciascun progetto
                rows.forEach(project => {
                    // Il campo si chiamerà 'historySummary' per non confonderlo con la cronologia completa
                    project.historySummary = summaryMap[project.id] || []; 
                });

                console.log('Prima riga risultato con sommario cronologia:', rows[0]);
                res.json(rows);
            });
        });
    } catch (error) {
        console.error('Errore generale nel recupero progetti:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Endpoint per ottenere un singolo progetto
router.get('/:id', checkAuthentication, (req, res) => {
    const projectId = req.params.id;
    const query = 'SELECT * FROM projects WHERE id = ?';
    req.db.get(query, [projectId], (err, row) => {
        if (err) {
            console.error('Errore nel recupero del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        if (row) {
            res.json(row);
        } else {
            res.status(404).send('Progetto non trovato');
        }
    });
});

// Endpoint per aggiungere un progetto
router.post('/', checkAuthentication, (req, res) => {
    const { factory, brand, range, line, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, priority } = req.body;
    
    // Prima query: inserimento del progetto
    const projectQuery = `INSERT INTO projects (factory, brand, range, line, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, priority) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    req.db.run(projectQuery, [factory, brand, range, line, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, priority], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        
        const projectId = this.lastID;
        
        // Ottieni l'ID della fase "Initial Brief"
        const getPhaseQuery = `SELECT id FROM phases WHERE name = 'Initial Brief' LIMIT 1`;
                
        req.db.get(getPhaseQuery, [], function(err, phaseRow) {
            if (err) {
                console.error('Errore nel recupero della fase:', err);
                return res.status(500).send('Errore del server');
            }

            const phaseId = phaseRow ? phaseRow.id : null;
            // Aggiunto created_by alla query e ai valori
            const historyQuery = `INSERT INTO project_history (project_id, date, phase, description, status, assigned_to, created_by)
                                VALUES (?, ?, ?, ?, ?, ?, ?)`; // Aggiunto ? per created_by

            const currentDate = new Date().toISOString().split('T')[0];
            const description = 'Project created';
            const userId = req.session.user.id; // Ottieni l'ID utente dalla sessione

            // Aggiunto userId come ultimo parametro per created_by
            req.db.run(historyQuery, [projectId, currentDate, phaseId, description, 'In Progress', req.session.user.name, userId], function(err) {
                if (err) {
                    console.error('Errore nell\'inserimento della cronologia:', err);
                    // Considera di restituire un errore JSON invece di solo testo
                    return res.status(500).json({ error: 'Errore del server nell\'inserimento della cronologia iniziale' });
                }
                res.status(201).json({ id: projectId });
            });
        });
    });
});

// Endpoint per aggiornare un progetto
router.put('/:id', checkAuthentication, (req, res) => {
    const { factory, brand, range, line, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, priority, status } = req.body;
    const query = `UPDATE projects SET factory = ?, brand = ?, range = ?, line = ?, modelNumber = ?, factoryModelNumber = ?, productKind = ?, client = ?, startDate = ?, endDate = ?, priority = ?, status = ? WHERE id = ?`;
    req.db.run(query, [factory, brand, range, line, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, priority, status, req.params.id], function(err) {
        if (err) {
            console.error('Errore nell\'aggiornamento del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(200).send('Progetto aggiornato con successo');
    });
});

// Endpoint per eliminare un progetto
router.delete('/:id', checkAuthentication, (req, res) => {
    const projectId = req.params.id;
    const forceDelete = req.query.force === 'true';

    // Prima verifichiamo se esistono voci di cronologia
    const checkHistoryQuery = `SELECT COUNT(*) as count FROM project_history WHERE project_id = ?`;
    req.db.get(checkHistoryQuery, [projectId], function(err, row) {
        if (err) {
            console.error('Errore nella verifica della cronologia:', err);
            return res.status(500).send('Server error');
        }

        // Se esistono voci di cronologia e non è stata forzata l'eliminazione
        if (row.count > 0 && !forceDelete) {
            return res.status(409).json({
                error: 'Non-empty Project',
                message: `This project contains ${row.count} history entries. Are you sure you want to delete it?`,
                requiresConfirmation: true,
                entriesCount: row.count
            });
        }

        // Se non ci sono voci di cronologia o è stata confermata l'eliminazione
        // Prima eliminiamo tutte le voci di cronologia associate al progetto
        const deleteHistoryQuery = `DELETE FROM project_history WHERE project_id = ?`;
        req.db.run(deleteHistoryQuery, [projectId], function(err) {
            if (err) {
                console.error('Errore nell\'eliminazione della cronologia del progetto:', err);
                return res.status(500).send('Server error');
            }

            // Poi eliminiamo il progetto
            const deleteProjectQuery = `DELETE FROM projects WHERE id = ?`;
            req.db.run(deleteProjectQuery, [projectId], function(err) {
                if (err) {
                    console.error('Errore nell\'eliminazione del progetto:', err);
                    return res.status(500).send('Server error');
                }
                res.status(200).send('Project and history successfully deleted');
            });
        });
    });
});

// Endpoint per ottenere le fasi di un progetto
router.get('/:id/phases', checkAuthentication, (req, res) => {
    const projectId = req.params.id;
    const query = 'SELECT * FROM phases WHERE project_id = ?';
    req.db.all(query, [projectId], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero delle fasi del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per ottenere la cronologia di un progetto
router.get('/:id/history', checkAuthentication, (req, res) => {
    const projectId = req.params.id;
    const userId = req.session.user.id;
    
    // Query modificata per mostrare tutti i record pubblici E i record privati visibili all'utente corrente
    // Include anche il nome dell'utente che ha creato il record e il parent_id
    const query = `
        SELECT ph.*, u.id as user_id, 
               u.name as creator_name,
               ph.parent_id
        FROM project_history ph
        LEFT JOIN users u ON ph.created_by = u.id
        WHERE ph.project_id = ? 
        AND (
            ph.private_by IS NULL 
            OR ph.private_by = ? 
            OR ph.private_by LIKE ? 
            OR ph.private_by LIKE ? 
            OR ph.private_by LIKE ?
        )
        ORDER BY ph.date DESC, ph.id DESC
    `;
    
    // Prepara i parametri per la ricerca con separatore virgola
    const userIdStr = String(userId);
    const patterns = [
        `${userIdStr}`,           // ID singolo
        `${userIdStr},%`,         // Primo elemento della lista
        `%,${userIdStr},%`,       // Elemento in mezzo alla lista
        `%,${userIdStr}`          // Ultimo elemento della lista
    ];
    
    // Imposta un timeout di 5 secondi per l'operazione
    req.db.configure('busyTimeout', 5000);
    req.db.all(query, [projectId, userId, patterns[1], patterns[2], patterns[3]], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero della cronologia:', err);
            return res.status(500).json({ error: 'Errore del server' });
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere una voce alla cronologia del progetto
router.post('/:id/history', checkAuthentication, (req, res) => {
    const projectId = req.params.id;
    const { date, phase, description, assignedTo, status, fileIds } = req.body;
    const userId = req.session.user.id;
    const userName = req.session.user.name;

    console.log('Dati ricevuti per la nuova voce di cronologia:', req.body);

    const query = `INSERT INTO project_history (project_id, date, phase, description, assigned_to, status, created_by, parent_id) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    // Il parent_id è null per le nuove voci che non sono risposte
    const parentId = req.body.parent_id || null;
    req.db.run(query, [projectId, date, phase, description, assignedTo, status, userId, parentId], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento della voce di cronologia:', err);
            return res.status(500).send('Errore del server');
        }
        const newHistoryId = this.lastID; // ID della nuova voce appena creata

        // Se ci sono file da associare, aggiorna il campo history_id nella tabella project_files
        if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
            const updateFileQuery = `UPDATE project_files SET history_id = ? WHERE id = ?`;
            let filesUpdated = 0;
            let filesErrors = 0;

            fileIds.forEach((fileId) => {
                req.db.run(updateFileQuery, [newHistoryId, fileId], function(fileErr) {
                    filesUpdated++;
                    if (fileErr) {
                        console.error(`Errore nell'associazione del file ${fileId} alla history entry ${newHistoryId}:`, fileErr);
                        filesErrors++;
                    }

                    // Quando tutti i file sono stati processati
                    if (filesUpdated === fileIds.length) {
                        console.log(`${filesUpdated - filesErrors} file associati con successo alla history entry ${newHistoryId}`);
                        
                        // Continua con la logica esistente per i forward
                        processParentFiles(newHistoryId, parentId, projectId, res);
                    }
                });
            });
        } else {
            // Se non ci sono file da associare, continua con la logica esistente
            processParentFiles(newHistoryId, parentId, projectId, res);
        }
    });

    // Funzione helper per processare i file del parent (forward)
    function processParentFiles(newHistoryId, parentId, projectId, res) {

        // Se la nuova voce ha un parent_id, verifica se è un forward (basato sulla descrizione)
        if (parentId) {
            // Verifica se la descrizione indica un forward
            const isForward = description && (description.toLowerCase().includes('forward-') || description.toLowerCase().startsWith('fwd:'));
            
            if (isForward) {
                // Copia i riferimenti ai file SOLO se è un forward
                console.log(`Copia dei riferimenti file da history_id ${parentId} a ${newHistoryId} (è un forward)`);
                // 1. Recupera i file del parent
                const getFilesQuery = 'SELECT * FROM project_files WHERE history_id = ?';
                req.db.all(getFilesQuery, [parentId], (fileErr, files) => {
                    if (fileErr) {
                        console.error(`Errore nel recupero dei file per la history_id ${parentId}:`, fileErr);
                        // Non bloccare la risposta, ma logga l'errore.
                    } else if (files && files.length > 0) {
                        // 2. Copia i riferimenti ai file per la nuova history entry
                        // Rimosso filesize e filetype dalla query e dai parametri
                        const insertFileQuery = `INSERT INTO project_files (project_id, history_id, filename, filepath, uploaded_by)
                                                 VALUES (?, ?, ?, ?, ?)`;
                        const fileInsertPromises = files.map(file => {
                            return new Promise((resolve, reject) => {
                                // Rimosso file.filesize e file.filetype dai parametri
                                req.db.run(insertFileQuery, [
                                    projectId, newHistoryId, file.filename, file.filepath, file.uploaded_by
                                ], function(fileInsertErr) {
                                    if (fileInsertErr) {
                                        console.error(`Errore nell'inserimento del file clonato ${file.filename} per la history_id ${newHistoryId}:`, fileInsertErr);
                                        reject(fileInsertErr); // Rifiuta la singola promise
                                    } else {
                                        console.log(`Riferimento file ${file.filename} copiato per history_id ${newHistoryId}`);
                                        resolve();
                                    }
                                });
                            });
                        });

                        // Aspetta che tutte le copie dei file siano completate (o fallite)
                        Promise.all(fileInsertPromises)
                            .then(() => {
                                console.log(`Tutti i ${files.length} riferimenti ai file copiati da history_id ${parentId} a ${newHistoryId}`);
                            })
                            .catch(err => {
                                console.error(`Errore durante la copia di alcuni riferimenti file da history_id ${parentId} a ${newHistoryId}:`, err);
                            });
                    } else {
                        console.log(`Nessun file trovato da copiare per history_id ${parentId}`);
                    }
                    // La risposta viene inviata dopo questo blocco asincrono
                });
            } else {
                // È un reply, non copiare i riferimenti ai file
                console.log(`Parent_id ${parentId} presente ma è un reply, non copio i riferimenti ai file`);
            }
        }
        // Invia la risposta dopo aver avviato (se necessario) la copia dei file
        res.status(201).json({ id: newHistoryId });
    }
});

// Endpoint per aggiornare la visibilità di una voce della cronologia
router.put('/:projectId/history/:historyId/privacy', checkAuthentication, (req, res) => {
    const { projectId, historyId } = req.params;
    const { private, sharedWith } = req.body;
    const userId = req.session.user.id;

    // Aggiorna il campo private_by nella tabella project_history
    const query = `UPDATE project_history SET private_by = ? WHERE id = ? AND project_id = ?`;

    let privateBy;
    if (private) {
        if (sharedWith && Array.isArray(sharedWith) && sharedWith.length > 0) {
            // Se è privato e condiviso con altri utenti, salva una stringa con l'utente corrente e gli utenti selezionati
            // Il primo ID è sempre il proprietario, seguito dagli ID degli utenti con cui è condiviso
            const uniqueUsers = [...new Set([userId, ...sharedWith])]; // Rimuove duplicati
            privateBy = uniqueUsers.join(',');
        } else {
            // Se è privato ma non condiviso, salva solo l'ID dell'utente corrente
            privateBy = String(userId);
        }
    } else {
        // Se non è privato, impostiamo private_by a NULL per rendere il record pubblico
        privateBy = null;
    }

    req.db.run(query, [privateBy, historyId, projectId], function(err) {
        if (err) {
            console.error('Errore durante l\'aggiornamento della visibilità:', err);
            return res.status(500).json({ error: 'Errore del server durante l\'aggiornamento della visibilità' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Record della cronologia non trovato' });
        }
        res.json({ private: private, private_by: privateBy, sharedWith: sharedWith });
    });
});

// Endpoint per ottenere gli utenti con cui è condivisa una voce della cronologia
router.get('/:projectId/history/:historyId/shared-users', checkAuthentication, (req, res) => {
    const { projectId, historyId } = req.params;
    const userId = req.session.user.id;

    // Prima verifica che l'utente sia il proprietario dell'entry
    const checkOwnerQuery = `
        SELECT private_by 
        FROM project_history 
        WHERE id = ? AND project_id = ?
    `;

    req.db.get(checkOwnerQuery, [historyId, projectId], (err, row) => {
        if (err) {
            console.error('Errore nel verificare la proprietà:', err);
            return res.status(500).json({ error: 'Errore del server' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Record della cronologia non trovato' });
        }

        let privateBy = row.private_by;
        let isOwner = false;
        let sharedUserIds = [];

        // Controlla se l'utente è il proprietario
        if (privateBy) {
            // Dividi la stringa per ottenere gli ID
            const privateByArray = privateBy.split(',');
            
            // Il primo ID è sempre il proprietario
            isOwner = privateByArray[0] == userId;
            
            // Gli altri ID sono gli utenti con cui è condiviso
            sharedUserIds = privateByArray.slice(1);
        }

        if (!isOwner) {
            return res.status(403).json({ error: 'Non sei autorizzato a vedere gli utenti condivisi' });
        }

        // Se non ci sono utenti condivisi, restituisci un array vuoto
        if (sharedUserIds.length === 0) {
            return res.json([]);
        }

        // Ottieni i dettagli degli utenti condivisi
        const placeholders = sharedUserIds.map(() => '?').join(',');
        const getUsersQuery = `
            SELECT id, name, username 
            FROM users 
            WHERE id IN (${placeholders})
        `;

        req.db.all(getUsersQuery, sharedUserIds, (err, users) => {
            if (err) {
                console.error('Errore nel recupero degli utenti condivisi:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            res.json(users);
        });
    });
});

// Endpoint per aggiornare una voce della cronologia del progetto
router.put('/:projectId/history/:historyId', checkAuthentication, (req, res) => {
    const { projectId, historyId } = req.params;
    const { date, phase, description, assignedTo, status } = req.body;

    const query = `UPDATE project_history SET date = ?, phase = ?, description = ?, assigned_to = ?, status = ? WHERE id = ? AND project_id = ?`;

    req.db.run(query, [date, phase, description, assignedTo, status, historyId, projectId], function(err) {
        if (err) {
            console.error('Errore nell\'aggiornamento della voce di cronologia:', err);
            return res.status(500).send('Errore del server');
        }
        if (this.changes === 0) {
            res.status(404).send('Voce di cronologia non trovata');
        } else {
            res.status(200).send('Voce di cronologia aggiornata con successo');
        }
    });
});

// Endpoint per eliminare una voce della cronologia del progetto
router.delete('/:projectId/history/:entryId', checkAuthentication, (req, res) => {
    const { projectId, entryId } = req.params;

    // Prima otteniamo i file associati alla voce di cronologia
    const getFilesQuery = `SELECT * FROM project_files WHERE project_id = ? AND history_id = ?`;
    
    req.db.all(getFilesQuery, [projectId, entryId], (err, files) => {
        if (err) {
            console.error('Errore nel recupero dei file associati:', err);
            return res.status(500).json({ error: 'Errore nel recupero dei file associati' });
        }

        // Per ogni file, verifichiamo se è condiviso con altri record prima di eliminarlo fisicamente
        const fileProcessingPromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const filename = path.basename(file.filepath);
                
                // Verifica se il file viene utilizzato da altri record
                req.db.get(
                    'SELECT COUNT(*) as count FROM project_files WHERE filepath LIKE ? AND (project_id != ? OR history_id != ?)',
                    ['%' + filename + '%', projectId, entryId],
                    (err, result) => {
                        if (err) {
                            console.error('Errore nel controllo di riferimenti multipli al file:', err);
                            reject(err);
                            return;
                        }
                        
                        // Se non ci sono altri riferimenti a questo file, lo eliminiamo fisicamente
                        if (result.count === 0) {
                            const filePath = path.join('/var/www/onlyoffice/Data', filename);
                            console.log(`File ${filename} non è condiviso con altri record. Eliminazione fisica:`, filePath);
                            
                            if (fs.existsSync(filePath)) {
                                fs.remove(filePath)
                                    .then(() => {
                                        console.log('File eliminato fisicamente con successo:', filePath);
                                        resolve(true);
                                    })
                                    .catch(err => {
                                        console.error('Errore nell\'eliminazione fisica del file:', err);
                                        // Continuiamo comunque anche se fallisce l'eliminazione fisica
                                        resolve(false);
                                    });
                            } else {
                                console.warn('File non trovato per eliminazione fisica:', filePath);
                                resolve(false);
                            }
                        } else {
                            // Il file è condiviso, quindi non lo eliminiamo fisicamente
                            console.log(`File ${filename} è condiviso con altri ${result.count} record. Non verrà eliminato fisicamente.`);
                            resolve(false);
                        }
                    }
                );
            });
        });

        // Attendiamo il completamento di tutte le operazioni sui file
        Promise.all(fileProcessingPromises)
            .then(() => {
                // Eliminiamo i riferimenti ai file dal database
                const deleteFilesQuery = `DELETE FROM project_files WHERE project_id = ? AND history_id = ?`;
                
                req.db.run(deleteFilesQuery, [projectId, entryId], function(err) {
                    if (err) {
                        console.error('Errore nell\'eliminazione dei riferimenti ai file:', err);
                        return res.status(500).json({ error: 'Errore nell\'eliminazione dei riferimenti ai file' });
                    }
                    
                    // Infine, eliminiamo la voce di cronologia
                    const deleteHistoryQuery = `DELETE FROM project_history WHERE project_id = ? AND id = ?`;
                    
                    req.db.run(deleteHistoryQuery, [projectId, entryId], function(err) {
                        if (err) {
                            console.error('Errore nell\'eliminazione della voce di cronologia:', err);
                            return res.status(500).json({ error: 'Errore del server' });
                        }
                        if (this.changes === 0) {
                            return res.status(404).json({ error: 'Voce di cronologia non trovata' });
                        }
                        res.status(200).json({ message: 'Voce di cronologia e riferimenti ai file eliminati con successo' });
                    });
                });
            })
            .catch(err => {
                console.error('Errore durante l\'elaborazione dei file:', err);
                return res.status(500).json({ error: 'Errore durante l\'elaborazione dei file' });
            });
    });
});

// Endpoint per resettare lo stato "nuovo" dei task di un progetto
router.post('/:id/reset-new-status', checkAuthentication, (req, res) => {
    const projectId = req.params.id;
    const { userId } = req.body;

    const query = `
        UPDATE project_history 
        SET is_new = 0 
        WHERE project_id = ? AND assigned_to = (
            SELECT name FROM users WHERE id = ?
        )
    `;

    // Imposta un timeout di 5 secondi per l'operazione
    req.db.configure('busyTimeout', 5000);
    req.db.run(query, [projectId, userId], function(err) {
        if (err) {
            console.error('Errore nel reset dello stato nuovo:', err);
            return res.status(500).json({ error: 'Errore del server' });
        }
        res.json({ message: 'Stato nuovo resettato con successo' });
    });
});

// Endpoint per archiviare/disarchiviare un progetto
router.post('/:id/archive', checkAuthentication, async (req, res) => {
    const projectId = req.params.id;
    const { archive } = req.body; // true per archiviare, false per disarchiviare

    try {
        // Verifica che il progetto sia completato se si sta tentando di archiviarlo
        if (archive) {
            const projectStatus = await new Promise((resolve, reject) => {
                req.db.get('SELECT * FROM project_history WHERE project_id = ? ORDER BY date DESC LIMIT 1', [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!projectStatus || projectStatus.status !== 'Completed') {
                return res.status(400).json({ 
                    error: 'Solo i progetti con stato "Completed" possono essere archiviati'
                });
            }
        }

        // Aggiorna lo stato di archiviazione
        const query = `UPDATE projects SET archived = ? WHERE id = ?`;
        req.db.run(query, [archive ? 1 : 0, projectId], function(err) {
            if (err) {
                console.error('Errore nell\'archiviazione del progetto:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Progetto non trovato' });
            }
            res.json({ 
                message: archive ? 'Progetto archiviato con successo' : 'Progetto disarchiviato con successo'
            });
        });
    } catch (error) {
        console.error('Errore:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Endpoint per clonare un progetto
router.post('/:id/clone', checkAuthentication, async (req, res) => {
    const originalProjectId = req.params.id;
    const userId = req.session.user.id;
    const userName = req.session.user.name;
    const currentDate = new Date().toISOString().split('T')[0];

    // Inizia una transazione
    req.db.serialize(() => {
        req.db.run('BEGIN TRANSACTION');

        // 1. Recupera i dati del progetto originale
        const getProjectQuery = 'SELECT * FROM projects WHERE id = ?';
        req.db.get(getProjectQuery, [originalProjectId], (err, originalProject) => {
            if (err) {
                console.error('Errore nel recupero del progetto originale:', err);
                req.db.run('ROLLBACK');
                return res.status(500).json({ error: 'Errore nel recupero del progetto originale' });
            }
            if (!originalProject) {
                req.db.run('ROLLBACK');
                return res.status(404).json({ error: 'Progetto originale non trovato' });
            }

            // 2. Crea il nuovo progetto (modifica il modelNumber per distinguerlo)
            const newModelNumber = `${originalProject.modelNumber} (Clone)`;
            const insertProjectQuery = `INSERT INTO projects (factory, brand, range, line, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, priority, archived) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`; // Nuovo progetto non è archiviato
            req.db.run(insertProjectQuery, [
                originalProject.factory, originalProject.brand, originalProject.range, originalProject.line,
                newModelNumber, originalProject.factoryModelNumber, originalProject.productKind, originalProject.client,
                originalProject.startDate, originalProject.endDate, originalProject.priority
            ], function(err) {
                if (err) {
                    console.error('Errore nell\'inserimento del progetto clonato:', err);
                    req.db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Errore nella creazione del clone del progetto' });
                }
                const newProjectId = this.lastID;

                // 3. Recupera la cronologia del progetto originale
                const getHistoryQuery = 'SELECT * FROM project_history WHERE project_id = ? ORDER BY date ASC, id ASC'; // Ordina per data per mantenere l'ordine
                req.db.all(getHistoryQuery, [originalProjectId], (err, historyEntries) => {
                    if (err) {
                        console.error('Errore nel recupero della cronologia originale:', err);
                        req.db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Errore nel recupero della cronologia originale' });
                    }

                    // 4. Inserisci la cronologia copiata per il nuovo progetto
                    const insertHistoryQuery = `INSERT INTO project_history (project_id, date, phase, description, assigned_to, status, created_by, private_by, parent_id, is_new) 
                                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                    // Usa Promise.all per gestire l'inserimento asincrono delle voci di cronologia
                    const historyInsertPromises = historyEntries.map(entry => {
                        return new Promise((resolve, reject) => {
                            req.db.run(insertHistoryQuery, [
                                newProjectId, entry.date, entry.phase, entry.description, entry.assigned_to,
                                entry.status, entry.created_by, entry.private_by, entry.parent_id, entry.is_new
                            ], function(err) {
                                if (err) {
                                    console.error('Errore nell\'inserimento di una voce di cronologia clonata:', err);
                                    reject(err);
                                } else {
                                    const newHistoryId = this.lastID;
                                    // 5. Recupera e copia i file associati a questa voce di cronologia (se presenti)
                                    const getFilesQuery = 'SELECT * FROM project_files WHERE history_id = ?';
                                    req.db.all(getFilesQuery, [entry.id], (fileErr, files) => {
                                        if (fileErr) {
                                            console.error('Errore nel recupero dei file originali:', fileErr);
                                            return reject(fileErr); // Rifiuta la promise se c'è errore nel recupero file
                                        }

                                        if (files.length === 0) {
                                            return resolve(); // Nessun file da copiare per questa entry
                                        }

                                        // Rimosso filesize e filetype dalla query e dai parametri
                                        const insertFileQuery = `INSERT INTO project_files (project_id, history_id, filename, filepath, uploaded_by) 
                                                                 VALUES (?, ?, ?, ?, ?)`;
                                        const fileInsertPromises = files.map(file => {
                                            // Qui dovremmo anche copiare fisicamente il file se necessario,
                                            // ma per ora copiamo solo il record nel DB assumendo che i percorsi siano gestiti altrove o siano relativi/condivisi.
                                            // Se i file sono in /uploads/project_id/history_id/, allora dobbiamo copiare la cartella.
                                            // Per semplicità, ora copiamo solo il record DB.
                                            // TODO: Implementare la copia fisica dei file se necessario.
                                            return new Promise((fileResolve, fileReject) => {
                                                // Rimosso file.filesize e file.filetype dai parametri
                                                req.db.run(insertFileQuery, [
                                                    newProjectId, newHistoryId, file.filename, file.filepath, file.uploaded_by
                                                ], function(fileInsertErr) {
                                                    if (fileInsertErr) {
                                                        console.error('Errore nell\'inserimento del record file clonato:', fileInsertErr);
                                                        fileReject(fileInsertErr);
                                                    } else {
                                                        fileResolve();
                                                    }
                                                });
                                            });
                                        });

                                        Promise.all(fileInsertPromises)
                                            .then(resolve) // Risolve la promise principale dell'entry di cronologia
                                            .catch(reject); // Rifiuta se una delle copie file fallisce
                                    });
                                }
                            });
                        });
                    });

                    Promise.all(historyInsertPromises)
                        .then(() => {
                            // 6. Aggiungi una voce di cronologia per registrare l'azione di clone (usa nome progetto originale)
                            const cloneHistoryQuery = `INSERT INTO project_history (project_id, date, description, status, assigned_to, created_by) 
                                                       VALUES (?, ?, ?, ?, ?, ?)`;
                            const cloneDescription = `Cloned from project: ${originalProject.client} - ${originalProject.modelNumber}`;
                            req.db.run(cloneHistoryQuery, [newProjectId, currentDate, cloneDescription, 'Cloned', userName, userId], function(err) {
                                if (err) {
                                    console.error('Errore nell\'inserimento della voce di cronologia per il clone:', err);
                                    req.db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Errore nella registrazione dell\'azione di clone' });
                                }

                                // Commit della transazione
                                req.db.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        console.error('Errore nel commit della transazione di clone:', commitErr);
                                        return res.status(500).json({ error: 'Errore nel salvataggio del clone' });
                                    }
                                    res.status(201).json({ id: newProjectId, message: 'Progetto clonato con successo' });
                                });
                            });
                        })
                        .catch(err => {
                            console.error('Errore durante la copia della cronologia o dei file:', err);
                            req.db.run('ROLLBACK');
                            res.status(500).json({ error: 'Errore durante la copia della cronologia o dei file' });
                        });
                });
            });
        });
    });
});

// Endpoint per unire più progetti
router.post('/merge', checkAuthentication, async (req, res) => {
    const { projectIds } = req.body;
    const userId = req.session.user.id;
    const userName = req.session.user.name;
    const currentDate = new Date().toISOString().split('T')[0];

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length < 2) {
        return res.status(400).json({ error: 'Selezionare almeno due progetti da unire.' });
    }

    // Inizia una transazione
    req.db.serialize(() => {
        req.db.run('BEGIN TRANSACTION');

        // 1. Recupera i dati del primo progetto come base per il nuovo progetto unito
        const getBaseProjectQuery = 'SELECT * FROM projects WHERE id = ?';
        req.db.get(getBaseProjectQuery, [projectIds[0]], (err, baseProject) => {
            if (err) {
                console.error('Errore nel recupero del progetto base per il merge:', err);
                req.db.run('ROLLBACK');
                return res.status(500).json({ error: 'Errore nel recupero del progetto base' });
            }
            if (!baseProject) {
                req.db.run('ROLLBACK');
                return res.status(404).json({ error: 'Progetto base non trovato' });
            }

            // 2. Crea il nuovo progetto unito (modifica il modelNumber)
            // Aggiungi il prefisso "MERGED-" al model number del primo progetto
            const newModelNumber = `MERGED-${baseProject.modelNumber}`; 
            const insertProjectQuery = `INSERT INTO projects (factory, brand, range, line, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, priority, archived) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`; // Nuovo progetto non è archiviato
            req.db.run(insertProjectQuery, [
                baseProject.factory, baseProject.brand, baseProject.range, baseProject.line,
                newModelNumber, baseProject.factoryModelNumber, baseProject.productKind, baseProject.client,
                baseProject.startDate, baseProject.endDate, baseProject.priority // Usa i dati del primo progetto come base
            ], function(err) {
                if (err) {
                    console.error('Errore nell\'inserimento del progetto unito:', err);
                    req.db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Errore nella creazione del progetto unito' });
                }
                const newProjectId = this.lastID;

                // 3. Recupera tutta la cronologia e i file da TUTTI i progetti selezionati
                const placeholders = projectIds.map(() => '?').join(',');
                const getHistoryQuery = `SELECT * FROM project_history WHERE project_id IN (${placeholders}) ORDER BY date ASC, id ASC`;
                
                req.db.all(getHistoryQuery, projectIds, (err, historyEntries) => {
                    if (err) {
                        console.error('Errore nel recupero delle cronologie originali:', err);
                        req.db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Errore nel recupero delle cronologie originali' });
                    }

                    if (historyEntries.length === 0) {
                        // Anche se non dovrebbe succedere se i progetti esistono, gestiamo il caso
                         // Aggiungi una voce di cronologia per registrare l'azione di merge
                        const mergeHistoryQuery = `INSERT INTO project_history (project_id, date, description, status, assigned_to, created_by) 
                                                   VALUES (?, ?, ?, ?, ?, ?)`;
                        // Descrizione più semplice che indica il numero di progetti uniti
                        const mergeDescription = `Merged from ${projectIds.length} projects`; 
                        req.db.run(mergeHistoryQuery, [newProjectId, currentDate, mergeDescription, 'Merged', userName, userId], function(err) {
                            if (err) {
                                console.error('Errore nell\'inserimento della voce di cronologia per il merge:', err);
                                req.db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Errore nella registrazione dell\'azione di merge' });
                            }
                            // Commit della transazione anche se non c'era cronologia da copiare
                            req.db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    console.error('Errore nel commit della transazione di merge (no history):', commitErr);
                                    return res.status(500).json({ error: 'Errore nel salvataggio del merge' });
                                }
                                return res.status(201).json({ id: newProjectId, message: 'Progetti uniti con successo (senza cronologia pregressa)' });
                            });
                        });
                        return; // Esce dalla funzione dopo aver gestito il caso senza cronologia
                    }

                    // 4. Inserisci la cronologia copiata per il nuovo progetto
                    const insertHistoryQuery = `INSERT INTO project_history (project_id, date, phase, description, assigned_to, status, created_by, private_by, parent_id, is_new) 
                                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    const historyInsertPromises = historyEntries.map(entry => {
                        return new Promise((resolve, reject) => {
                            req.db.run(insertHistoryQuery, [
                                newProjectId, entry.date, entry.phase, entry.description, entry.assigned_to,
                                entry.status, entry.created_by, entry.private_by, entry.parent_id, entry.is_new
                            ], function(err) {
                                if (err) {
                                    console.error('Errore nell\'inserimento di una voce di cronologia unita:', err);
                                    reject(err);
                                } else {
                                    const newHistoryId = this.lastID;
                                    const originalHistoryId = entry.id; // ID della vecchia entry per trovare i file

                                    // 5. Recupera e copia i file associati a questa voce di cronologia originale
                                    const getFilesQuery = 'SELECT * FROM project_files WHERE history_id = ?';
                                    req.db.all(getFilesQuery, [originalHistoryId], (fileErr, files) => {
                                        if (fileErr) {
                                            console.error('Errore nel recupero dei file originali per il merge:', fileErr);
                                            return reject(fileErr);
                                        }

                                        if (files.length === 0) {
                                            return resolve(); // Nessun file da copiare
                                        }

                                        // Rimosso filesize e filetype dalla query e dai parametri
                                        const insertFileQuery = `INSERT INTO project_files (project_id, history_id, filename, filepath, uploaded_by) 
                                                                 VALUES (?, ?, ?, ?, ?)`;
                                        const fileInsertPromises = files.map(file => {
                                            // TODO: Implementare la copia fisica dei file se necessario.
                                            return new Promise((fileResolve, fileReject) => {
                                                // Rimosso file.filesize e file.filetype dai parametri
                                                req.db.run(insertFileQuery, [
                                                    newProjectId, newHistoryId, file.filename, file.filepath, file.uploaded_by
                                                ], function(fileInsertErr) {
                                                    if (fileInsertErr) {
                                                        console.error('Errore nell\'inserimento del record file unito:', fileInsertErr);
                                                        fileReject(fileInsertErr);
                                                    } else {
                                                        fileResolve();
                                                    }
                                                });
                                            });
                                        });

                                        Promise.all(fileInsertPromises)
                                            .then(resolve)
                                            .catch(reject);
                                    });
                                }
                            });
                        });
                    });

                    Promise.all(historyInsertPromises)
                        .then(() => {
                            // 6. Aggiungi una voce di cronologia per registrare l'azione di merge
                            const mergeHistoryQuery = `INSERT INTO project_history (project_id, date, description, status, assigned_to, created_by) 
                                                       VALUES (?, ?, ?, ?, ?, ?)`;
                            // Descrizione più semplice che indica il numero di progetti uniti
                            const mergeDescription = `Merged from ${projectIds.length} projects`;
                            req.db.run(mergeHistoryQuery, [newProjectId, currentDate, mergeDescription, 'Merged', userName, userId], function(err) {
                                if (err) {
                                    console.error('Errore nell\'inserimento della voce di cronologia per il merge:', err);
                                    req.db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Errore nella registrazione dell\'azione di merge' });
                                }

                                // Commit della transazione
                                req.db.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        console.error('Errore nel commit della transazione di merge:', commitErr);
                                        return res.status(500).json({ error: 'Errore nel salvataggio del merge' });
                                    }
                                    res.status(201).json({ id: newProjectId, message: 'Progetti uniti con successo' });
                                });
                            });
                        })
                        .catch(err => {
                            console.error('Errore durante la copia della cronologia o dei file nel merge:', err);
                            req.db.run('ROLLBACK');
                            res.status(500).json({ error: 'Errore durante la copia della cronologia o dei file' });
                        });
                });
            });
        });
    });
});


/**
 * Endpoint per cercare nella cronologia dei progetti in base a una keyword, restituendo solo gli ID dei progetti
 * visibili all'utente loggato in base ai permessi CRUD.
 */
router.get('/history/search', checkAuthentication, async (req, res) => {
    try {
        const keyword = (req.query.keyword || '').trim().toLowerCase();
        if (!keyword) {
            return res.json([]);
        }

        // Recupera i permessi CRUD dell'utente per la pagina projects
        const permissionsQuery = `
            SELECT c.properties, uc.properties as user_properties
            FROM crud c
            LEFT JOIN user_crud uc ON uc.crud_id = c.id AND uc.user_id = ?
            WHERE c.page = 'Projects' AND c.action = 'Read'
        `;
        const user = await new Promise((resolve, reject) => {
            req.db.get(permissionsQuery, [req.session.user.id], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });

        if (!user || !user.user_properties) {
            return res.status(403).json({ error: 'Permesso di lettura negato' });
        }

        let permissions;
        try {
            permissions = JSON.parse(user.user_properties);
            if (!permissions.enabled) {
                return res.status(403).json({ error: 'Permessi non abilitati' });
            }
        } catch (err) {
            return res.status(403).json({ error: 'Permessi non validi' });
        }

        const level = permissions.level || permissions.scope;
        const queryParams = [];
        let permissionsFilter = '';

        switch (level) {
            case 'own':
                permissionsFilter = ` AND EXISTS (
                    SELECT 1 FROM project_history ph
                    WHERE ph.project_id = p.id AND ph.assigned_to = ?
                )`;
                queryParams.push(req.session.user.name);
                break;
            case 'own-factory':
                permissionsFilter = ` AND factory = (SELECT factory FROM users WHERE id = ?)`;
                queryParams.push(req.session.user.id);
                break;
            case 'all-factories':
                permissionsFilter = ` AND factory IS NOT NULL`;
                break;
            case 'own-client':
                permissionsFilter = ` AND client = (SELECT client_company_name FROM users WHERE id = ?)`;
                queryParams.push(req.session.user.id);
                break;
            case 'all-clients':
                permissionsFilter = ` AND client IS NOT NULL`;
                break;
            case 'user-projects':
                const userPermsQuery = `
                    SELECT uc.properties
                    FROM crud c
                    JOIN user_crud uc ON c.id = uc.crud_id
                    WHERE c.page = 'Users' AND c.action = 'Read'
                    AND uc.user_id = ? AND uc.properties IS NOT NULL
                `;
                const userPerms = await new Promise((resolve, reject) => {
                    req.db.get(userPermsQuery, [req.session.user.id], (err, row) => {
                        if (err) reject(err); else resolve(row);
                    });
                });

                if (userPerms && userPerms.properties) {
                    try {
                        const userProps = JSON.parse(userPerms.properties);
                        if (Array.isArray(userProps.userIds) && userProps.userIds.length > 0) {
                            permissionsFilter = ` AND EXISTS (
                                SELECT 1 FROM project_history ph
                                JOIN users u ON ph.assigned_to = u.name
                                WHERE ph.project_id = p.id
                                AND u.id IN (${userProps.userIds.map(() => '?').join(',')})
                            )`;
                            queryParams.push(...userProps.userIds);
                        } else {
                            return res.status(403).json({ error: 'Nessun utente specifico definito nei permessi' });
                        }
                    } catch (e) {
                        return res.status(403).json({ error: 'Permessi non validi' });
                    }
                } else {
                    return res.status(403).json({ error: 'Nessun utente specifico definito nei permessi' });
                }
                break;
            case 'all':
                break;
            default:
                return res.status(403).json({ error: 'Scope non valido' });
        }

        // Costruisci la query per cercare nei progetti e nella loro cronologia
        const searchQuery = `
            SELECT DISTINCT p.id
            FROM projects p
            JOIN project_history ph ON ph.project_id = p.id
            WHERE (
                LOWER(p.client) LIKE ? OR
                LOWER(p.productKind) LIKE ? OR
                LOWER(p.factory) LIKE ? OR
                LOWER(p.brand) LIKE ? OR
                LOWER(p.range) LIKE ? OR
                LOWER(p.line) LIKE ? OR
                LOWER(p.modelNumber) LIKE ? OR
                LOWER(p.factoryModelNumber) LIKE ? OR
                LOWER(ph.description) LIKE ? OR
                LOWER(ph.status) LIKE ? OR
                LOWER(ph.assigned_to) LIKE ?
            )
            ${permissionsFilter}
        `;

        const likeParam = `%${keyword}%`;
        const params = [
            likeParam, likeParam, likeParam, likeParam, likeParam,
            likeParam, likeParam, likeParam, likeParam, likeParam, likeParam,
            ...queryParams
        ];

        req.db.all(searchQuery, params, (err, rows) => {
            if (err) {
                console.error('Errore nella ricerca cronologia progetti:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            const ids = rows.map(r => r.id);
            res.json(ids);
        });

    } catch (error) {
        console.error('Errore generale nella ricerca cronologia progetti:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

module.exports = router;
