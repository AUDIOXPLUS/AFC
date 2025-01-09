const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Funzione per convertire il path da Windows a Docker
function convertWindowsPathToDocker(windowsPath) {
    if (windowsPath.includes('C:\\Users\\Francesco\\AFC-V3\\')) {
        return windowsPath.split('AFC-V3\\')[1].replace(/\\/g, '/');
    }
    return windowsPath.replace(/\\/g, '/');
}

// Configurazione multer per il caricamento dei file
const onlyofficeDir = '/var/www/onlyoffice/Data';
console.log('Directory OnlyOffice configurata per multer:', onlyofficeDir);

// Assicurati che la directory esista e abbia i permessi corretti
try {
    fs.ensureDirSync(onlyofficeDir, { mode: 0o777 });
    fs.chmodSync(onlyofficeDir, 0o777);
    const stats = fs.statSync(onlyofficeDir);
    console.log('Directory OnlyOffice verificata:', {
        path: onlyofficeDir,
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid
    });
} catch (err) {
    console.error('Errore nella verifica della directory OnlyOffice:', err);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log('Directory di destinazione per upload:', onlyofficeDir);
        cb(null, onlyofficeDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Middleware di autenticazione migliorato
function checkAuthentication(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        if (req.path.startsWith('/')) {
            res.status(401).json({ error: 'Utente non autenticato' });
        } else {
            res.redirect('/login.html');
        }
    }
}

// Endpoint per il login
router.post('/login', (req, res) => {
    console.log('Tentativo di accesso ricevuto:', req.body);
    const { username, password } = req.body;

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    req.db.get(query, [username, password], (err, row) => {
        if (err) {
            console.error('Errore del server:', err);
            return res.status(500).json({ success: false, message: 'Errore del server' });
        }
        if (row) {
            console.log('Login effettuato con successo!');
            console.log('Dati utente recuperati dal database:', row);
            req.session.user = row;
            res.json({ success: true, name: row.name });
        } else {
            console.log('Credenziali non valide.');
            res.json({ success: false, message: 'Credenziali non valide.' });
        }
    });
});

// Endpoint per ottenere i progetti
router.get('/projects', checkAuthentication, (req, res) => {
    const query = 'SELECT * FROM projects';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore del server:', err);
            return res.status(500).send('Errore del server');
        }
       res.json(rows);
    });
});

// Endpoint per ottenere un singolo progetto
router.get('/projects/:id', checkAuthentication, (req, res) => {
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

// Endpoint per ottenere le fasi di un progetto
router.get('/projects/:id/phases', checkAuthentication, (req, res) => {
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
router.get('/projects/:id/history', checkAuthentication, (req, res) => {
    const projectId = req.params.id;
    const query = 'SELECT * FROM project_history WHERE project_id = ?';
    req.db.all(query, [projectId], (err, rows) => {
        if (err) {
            console.error('Error fetching project history:', err);
            return res.status(500).send('Server error');
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere un progetto
router.post('/projects', checkAuthentication, (req, res) => {
    const { factory, brand, range, line, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, priority, status } = req.body;
    const query = `INSERT INTO projects (factory, brand, range, line, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, priority, status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    req.db.run(query, [factory, brand, range, line, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, priority, status], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Endpoint per aggiornare un progetto
router.put('/projects/:id', checkAuthentication, (req, res) => {
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
router.delete('/projects/:id', checkAuthentication, (req, res) => {
    const query = `DELETE FROM projects WHERE id = ?`;
    req.db.run(query, req.params.id, function(err) {
        if (err) {
            console.error('Errore nell\'eliminazione del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(200).send('Progetto eliminato con successo');
    });
});


// Endpoint per ottenere le fasi
router.get('/phases', checkAuthentication, (req, res) => {
    const query = 'SELECT * FROM phases ORDER BY order_num';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero delle fasi:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere una nuova fase
router.post('/phases', checkAuthentication, (req, res) => {
    const { name, description, order_num } = req.body; // Modificato 'order' in 'order_num'
    const query = `INSERT INTO phases (name, description, order_num) VALUES (?, ?, ?)`;
    req.db.run(query, [name, description, order_num], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento della fase:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ 
            id: this.lastID,
            name,
            description,
            order_num
        });
    });
});

// Endpoint per aggiornare una fase
router.put('/phases/:id', checkAuthentication, (req, res) => {
    const { name, description, order_num } = req.body; // Modificato 'order' in 'order_num'
    const phaseId = req.params.id;
    const query = `UPDATE phases SET name = ?, description = ?, order_num = ? WHERE id = ?`;
    req.db.run(query, [name, description, order_num, phaseId], function(err) {
        if (err) {
            console.error('Errore nell\'aggiornamento della fase:', err);
            return res.status(500).send('Errore del server');
        }
        if (this.changes === 0) {
            return res.status(404).send('Fase non trovata');
        }
        res.status(200).json({
            id: phaseId,
            name,
            description,
            order_num
        });
    });
});

// Endpoint per eliminare una fase
router.delete('/phases/:id', checkAuthentication, (req, res) => {
    const phaseId = req.params.id;
    const query = `DELETE FROM phases WHERE id = ?`;
    req.db.run(query, [phaseId], function(err) {
        if (err) {
            console.error('Errore nell\'eliminazione della fase:', err);
            return res.status(500).send('Errore del server');
        }
        if (this.changes === 0) {
            return res.status(404).send('Fase non trovata');
        }
        res.status(200).send('Fase eliminata con successo');
    });
});

// Endpoint per ottenere i product kinds
router.get('/product-kinds', checkAuthentication, (req, res) => {
    const query = 'SELECT * FROM product_kinds ORDER BY order_num';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero dei product kinds:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere un nuovo product kind
router.post('/product-kinds', checkAuthentication, (req, res) => {
    const { name, description, order_num } = req.body;
    const query = `INSERT INTO product_kinds (name, description, order_num) VALUES (?, ?, ?)`;
    req.db.run(query, [name, description, order_num], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento del product kind:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ 
            id: this.lastID,
            name,
            description,
            order_num
        });
    });
});

// Endpoint per aggiornare un product kind
router.put('/product-kinds/:id', checkAuthentication, (req, res) => {
    const { name, description, order_num } = req.body;
    const productKindId = req.params.id;
    const query = `UPDATE product_kinds SET name = ?, description = ?, order_num = ? WHERE id = ?`;
    req.db.run(query, [name, description, order_num, productKindId], function(err) {
        if (err) {
            console.error('Errore nell\'aggiornamento del product kind:', err);
            return res.status(500).json({ error: 'Errore del server' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Product kind non trovato' });
        }

        // Dopo l'aggiornamento, recupera il record aggiornato
        req.db.get('SELECT * FROM product_kinds WHERE id = ?', [productKindId], (err, row) => {
            if (err) {
                console.error('Errore nel recupero del product kind aggiornato:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            if (!row) {
                return res.status(404).json({ error: 'Product kind non trovato' });
            }
            res.status(200).json(row);
        });
    });
});

// Endpoint per eliminare un product kind
router.delete('/product-kinds/:id', checkAuthentication, (req, res) => {
    const productKindId = req.params.id;
    
    // Ottieni l'ordine del product kind da eliminare
    req.db.get('SELECT order_num FROM product_kinds WHERE id = ?', [productKindId], (err, row) => {
        if (err) {
            console.error('Errore nel recupero del product kind:', err);
            return res.status(500).send('Errore del server');
        }
        if (!row) {
            return res.status(404).send('Product kind non trovato');
        }

        const deletedOrder = row.order_num;

        // Inizia una transazione
        req.db.serialize(() => {
            req.db.run('BEGIN TRANSACTION');

            // Elimina il product kind
            req.db.run('DELETE FROM product_kinds WHERE id = ?', [productKindId], function(err) {
                if (err) {
                    console.error('Errore nell\'eliminazione del product kind:', err);
                    req.db.run('ROLLBACK');
                    return res.status(500).send('Errore del server');
                }

                // Aggiorna gli ordini dei product kinds rimanenti
                req.db.run(
                    'UPDATE product_kinds SET order_num = order_num - 1 WHERE order_num > ?',
                    [deletedOrder],
                    function(err) {
                        if (err) {
                            console.error('Errore nell\'aggiornamento degli ordini:', err);
                            req.db.run('ROLLBACK');
                            return res.status(500).send('Errore del server');
                        }

                        // Commit della transazione
                        req.db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('Errore nel commit della transazione:', err);
                                req.db.run('ROLLBACK');
                                return res.status(500).send('Errore del server');
                            }
                            res.status(200).send('Product kind eliminato con successo');
                        });
                    }
                );
            });
        });
    });
});

// Endpoint per ottenere i membri del team
router.get('/team-members', checkAuthentication, (req, res) => {
    const query = 'SELECT id, name, role, email, color, fontColor, username FROM users';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero dei team members:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere un membro del team
router.post('/team-members', checkAuthentication, (req, res) => {
    const { name, role, email, color, fontColor, username, password } = req.body;
    const query = `INSERT INTO users (name, role, email, color, fontColor, username, password) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    req.db.run(query, [name, role, email, color, fontColor, username, password], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento del team member:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Endpoint per aggiornare un membro del team
router.put('/team-members/:id', checkAuthentication, (req, res) => {
    const { name, role, email, color, fontColor } = req.body;
    const userId = req.params.id;

    console.log(`Tentativo di aggiornamento del team member con ID: ${userId}`);
    console.log(`Dati ricevuti: name=${name}, role=${role}, email=${email}, color=${color}, fontColor=${fontColor}`);

    const query = `UPDATE users SET name = ?, role = ?, email = ?, color = ?, fontColor = ? WHERE id = ?`;

    req.db.run(query, [name, role, email, color, fontColor, userId], function(err) {
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
router.get('/team-members/:id/privileges', checkAuthentication, (req, res) => {
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
router.put('/team-members/:id/privileges', checkAuthentication, (req, res) => {
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

// Endpoint per ottenere i dettagli di un singolo membro del team
router.get('/team-members/:id', checkAuthentication, (req, res) => {
    const userId = req.params.id;
    const query = 'SELECT id, name, role, email, color, fontColor, username FROM users WHERE id = ?';

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

// Endpoint per ottenere l'utente della sessione con ID
router.get('/session-user', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ 
            id: req.session.user.id, 
            username: req.session.user.username, 
            name: req.session.user.name 
        });
    } else {
        res.status(401).json({ error: 'Utente non autenticato' });
    }
});

// Endpoint per ottenere l'utente corrente
router.get('/current-user', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ 
            id: req.session.user.id, 
            username: req.session.user.username, 
            name: req.session.user.name 
        });
    } else {
        res.status(401).json({ error: 'Utente non autenticato' });
    }
});

// Endpoint per aggiungere una voce alla cronologia del progetto
router.post('/projects/:id/history', checkAuthentication, (req, res) => {
    const projectId = req.params.id;
    const { date, phase, description, assignedTo, status } = req.body;

    console.log('Dati ricevuti per la nuova voce di cronologia:', req.body);

    const query = `INSERT INTO project_history (project_id, date, phase, description, assigned_to, status) 
                   VALUES (?, ?, ?, ?, ?, ?)`;
    
    req.db.run(query, [projectId, date, phase, description, assignedTo, status], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento della voce di cronologia:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Endpoint per aggiornare una voce della cronologia del progetto
router.put('/projects/:projectId/history/:historyId', checkAuthentication, (req, res) => {
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

router.delete('/projects/:projectId/history/:entryId', checkAuthentication, (req, res) => {
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

// Endpoint per ottenere tutte le attività
router.get('/tasks', checkAuthentication, (req, res) => {
    const query = `
        SELECT 
            ph.id, 
            ph.project_id AS projectId, 
            p.factory,
            p.modelNumber, 
            ph.date, 
            ph.description, 
            ph.assigned_to AS assignedTo, 
            ph.status,
            ph.is_new
        FROM 
            project_history ph
        JOIN 
            projects p ON ph.project_id = p.id
    `;
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero delle attività:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per resettare lo stato "nuovo" dei task di un progetto
router.post('/projects/:id/reset-new-status', checkAuthentication, (req, res) => {
    const projectId = req.params.id;
    const { userId } = req.body;

    const query = `
        UPDATE project_history 
        SET is_new = 0 
        WHERE project_id = ? AND assigned_to = (
            SELECT name FROM users WHERE id = ?
        )
    `;

    req.db.run(query, [projectId, userId], function(err) {
        if (err) {
            console.error('Errore nel reset dello stato nuovo:', err);
            return res.status(500).json({ error: 'Errore del server' });
        }
        res.json({ message: 'Stato nuovo resettato con successo' });
    });
});

// File Management Endpoints
router.post('/projects/:projectId/files', checkAuthentication, upload.array('files'), (req, res) => {
    const { projectId } = req.params;
    const { files } = req;
    const { historyId } = req.body;
    const uploadedBy = req.session.user.id;

    if (!files || files.length === 0) {
        console.error('Nessun file ricevuto nella richiesta');
        return res.status(400).json({ error: 'Nessun file ricevuto' });
    }

    const results = [];
    let completed = 0;

    files.forEach(file => {
        // Imposta i permessi del file appena caricato
        try {
            fs.chmodSync(file.path, 0o666);
            const stats = fs.statSync(file.path);
            console.log('File caricato:', {
                path: file.path,
                size: file.size,
                mode: stats.mode.toString(8),
                uid: stats.uid,
                gid: stats.gid
            });
        } catch (err) {
            console.error('Errore nell\'impostare i permessi del file:', err);
            return;
        }

        // Usa il percorso relativo per OnlyOffice
        const normalizedFilePath = path.basename(file.path);
        console.log('normalizedFilePath:', normalizedFilePath);

        const query = `INSERT INTO project_files (project_id, history_id, filename, filepath, uploaded_by) VALUES (?, ?, ?, ?, ?)`;
        
        req.db.run(query, [
            projectId,
            historyId,
            file.originalname,
            normalizedFilePath,
            uploadedBy
        ], function(err) {
            completed++;
            
            if (err) {
                console.error('Error uploading file:', err);
                results.push({
                    filename: file.originalname,
                    error: 'Failed to upload file'
                });
            } else {
                results.push({
                    id: this.lastID,
                    filename: file.originalname,
                    filepath: normalizedFilePath
                });
            }

            // Quando tutti i file sono stati processati, invia la risposta
            if (completed === files.length) {
                res.status(201).json(results);
            }
        });
    });
});

router.get('/projects/:projectId/files', checkAuthentication, (req, res) => {
    const { projectId } = req.params;
    const { historyId } = req.query;

    let query = `
        SELECT pf.*, u1.name as uploaded_by_name, u2.name as locked_by_name 
        FROM project_files pf 
        LEFT JOIN users u1 ON pf.uploaded_by = u1.id 
        LEFT JOIN users u2 ON pf.locked_by = u2.id 
        WHERE project_id = ?
    `;
    const params = [projectId];

    if (historyId) {
        query += ' AND history_id = ?';
        params.push(historyId);
    }

    req.db.all(query, params, (err, files) => {
        if (err) {
            console.error('Error fetching files:', err);
            return res.status(500).json({ error: 'Failed to fetch files' });
        }
        res.json(files);
    });
});

// Endpoint per visualizzare un file
router.get('/files/:fileId/view', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    
    req.db.get('SELECT * FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            console.error('Error fetching file:', err);
            return res.status(500).json({ error: 'Failed to fetch file' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Prima prova il percorso in OnlyOffice Data
        let filePath = path.join('/var/www/onlyoffice/Data', path.basename(file.filepath));
        console.log('Original filepath:', file.filepath);
        console.log('Provo percorso OnlyOffice:', filePath);
        
        // Se il file non esiste in OnlyOffice Data, prova il percorso originale
        if (!fs.existsSync(filePath)) {
            console.log('File non trovato in OnlyOffice Data, provo percorso originale');
            // Se il filepath inizia con 'uploads/', lo cerco nella root dell'app
            if (file.filepath.startsWith('uploads/')) {
                filePath = path.join(__dirname, file.filepath);
            } else {
                // Altrimenti uso il filepath così com'è (potrebbe essere un percorso assoluto)
                filePath = file.filepath;
            }
            console.log('Provo percorso alternativo:', filePath);
            
            if (!fs.existsSync(filePath)) {
                console.error('File non trovato in nessun percorso');
                return res.status(404).json({ error: 'File not found' });
            }
        }

        res.sendFile(filePath);
    });
});

// Endpoint per scaricare un file
router.get('/files/:fileId/download', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    
    req.db.get('SELECT * FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            console.error('Error fetching file:', err);
            return res.status(500).json({ error: 'Failed to fetch file' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Usa il percorso corretto per OnlyOffice
        const filePath = path.join('/var/www/onlyoffice/Data', path.basename(file.filepath));
        console.log('Original filepath:', file.filepath);
        console.log('File path per OnlyOffice:', filePath);
        
        // Verifica che il file esista
        if (!fs.existsSync(filePath)) {
            console.error('File non trovato:', filePath);
            return res.status(404).json({ error: 'File not found' });
        }

        res.download(filePath, file.filename);
    });
});

router.post('/files/:fileId/lock', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    const userId = req.session.user.id;
    
    req.db.get('SELECT locked_by FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        if (file.locked_by) {
            return res.status(403).json({ error: 'File is already locked' });
        }
        
        const query = `
            UPDATE project_files 
            SET locked_by = ?, lock_date = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        req.db.run(query, [userId, fileId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to lock file' });
            }
            res.json({ message: 'File locked successfully' });
        });
    });
});

router.post('/files/:fileId/unlock', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    const userId = req.session.user.id;
    
    req.db.get('SELECT locked_by FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        if (file.locked_by !== userId) {
            return res.status(403).json({ error: 'File is not locked by you' });
        }
        
        const query = `
            UPDATE project_files 
            SET locked_by = NULL, lock_date = NULL 
            WHERE id = ?
        `;
        
        req.db.run(query, [fileId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to unlock file' });
            }
            res.json({ message: 'File unlocked successfully' });
        });
    });
});

router.delete('/files/:fileId', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    
    req.db.get('SELECT * FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        if (file.locked_by) {
            return res.status(403).json({ error: 'Cannot delete locked file' });
        }
        
        req.db.run('DELETE FROM project_files WHERE id = ?', [fileId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete file' });
            }
            
            // Usa il percorso corretto per OnlyOffice
            const filePath = path.join('/var/www/onlyoffice/Data', path.basename(file.filepath));
            console.log('Original filepath:', file.filepath);
            console.log('File path per OnlyOffice:', filePath);
            
            // Verifica che il file esista
            if (!fs.existsSync(filePath)) {
                console.error('File non trovato:', filePath);
                return res.status(404).json({ error: 'File not found' });
            }

            fs.remove(filePath)
                .then(() => {
                    res.json({ message: 'File deleted successfully' });
                })
                .catch(err => {
                    console.error('Error deleting file from disk:', err);
                    res.status(500).json({ error: 'Failed to delete file from disk' });
                });
        });
    });
});

router.get('/projects/:projectId/history/:historyId/files', checkAuthentication, (req, res) => {
    const { projectId, historyId } = req.params;
    const query = `
        SELECT pf.*, u1.name as uploaded_by_name, u2.name as locked_by_name 
        FROM project_files pf 
        LEFT JOIN users u1 ON pf.uploaded_by = u1.id 
        LEFT JOIN users u2 ON pf.locked_by = u2.id 
        WHERE project_id = ? AND history_id = ?
    `;
    
    req.db.all(query, [projectId, historyId], (err, files) => {
        if (err) {
            console.error('Error fetching files:', err);
            return res.status(500).json({ error: 'Failed to fetch files' });
        }
        res.json(files);
    });
});

module.exports = router;
