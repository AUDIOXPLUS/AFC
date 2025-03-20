const express = require('express');
const router = express.Router();
const checkAuthentication = require('../middleware/auth');
const path = require('path');
const fs = require('fs-extra');

// Endpoint per ottenere i progetti in base ai permessi
router.get('/', checkAuthentication, async (req, res) => {
    try {
        const showArchived = req.query.showArchived === 'true';
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
        let query = 'SELECT * FROM projects WHERE 1=1 AND (archived = ? OR archived IS NULL)';
        queryParams.push(showArchived ? 1 : 0);

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
                    WHERE ph.project_id = projects.id
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
                                WHERE ph.project_id = projects.id
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
            res.json(rows);
        });
    } catch (error) {
        console.error('Errore:', error);
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
            const historyQuery = `INSERT INTO project_history (project_id, date, phase, description, status, assigned_to) 
                                VALUES (?, ?, ?, ?, ?, ?)`;
            
            const currentDate = new Date().toISOString().split('T')[0];
            const description = 'Project created';
            
            req.db.run(historyQuery, [projectId, currentDate, phaseId, description, 'In Progress', req.session.user.name], function(err) {
                if (err) {
                    console.error('Errore nell\'inserimento della cronologia:', err);
                    return res.status(500).send('Errore del server');
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
        ORDER BY ph.date DESC
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
    const { date, phase, description, assignedTo, status } = req.body;
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
        res.status(201).json({ id: this.lastID });
    });
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

        // Rimuoviamo fisicamente i file dal filesystem
        files.forEach(file => {
            const filePath = path.join('/var/www/onlyoffice/Data', path.basename(file.filepath));
            console.log('Eliminazione file:', filePath);
            
            if (fs.existsSync(filePath)) {
                fs.remove(filePath, (err) => {
                    if (err) {
                        console.error('Errore nell\'eliminazione del file dal filesystem:', err);
                    } else {
                        console.log('File eliminato con successo:', filePath);
                    }
                });
            } else {
                console.warn('File non trovato per eliminazione:', filePath);
            }
        });

        // Poi eliminiamo i file dal database
        const deleteFilesQuery = `DELETE FROM project_files WHERE project_id = ? AND history_id = ?`;

        req.db.run(deleteFilesQuery, [projectId, entryId], function(err) {
            if (err) {
                console.error('Errore nell\'eliminazione dei file associati:', err);
                return res.status(500).json({ error: 'Errore nell\'eliminazione dei file associati' });
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
                res.status(200).json({ message: 'Voce di cronologia e file associati eliminati con successo' });
            });
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

module.exports = router;
