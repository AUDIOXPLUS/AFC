const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Configurazione multer per il caricamento dei file
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const projectDir = path.join(uploadsDir, req.params.projectId);
        fs.ensureDirSync(projectDir);
        cb(null, projectDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Middleware di autenticazione migliorato
function checkAuthentication(req, res, next) {
    console.log('checkAuthentication chiamato per', req.path);
    if (req.session && req.session.user) {
        return next();
    } else {
        if (req.path.startsWith('/api/')) {
            res.status(401).json({ error: 'Utente non autenticato' });
        } else {
            res.redirect('/login.html');
        }
    }
}

// Endpoint per il login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`Tentativo di login con username: ${username}`);

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
router.get('/api/projects', (req, res) => {
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
router.get('/api/projects/:id', (req, res) => {
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
router.get('/api/projects/:id/phases', (req, res) => {
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
router.get('/api/projects/:id/history', (req, res) => {
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
router.post('/api/projects', (req, res) => {
    const { factory, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, status } = req.body;
    const query = `INSERT INTO projects (factory, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    req.db.run(query, [factory, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, status], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Endpoint per aggiornare un progetto
router.put('/api/projects/:id', (req, res) => {
    const { factory, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, status } = req.body;
    const query = `UPDATE projects SET factory = ?, modelNumber = ?, factoryModelNumber = ?, productKind = ?, client = ?, startDate = ?, endDate = ?, status = ? WHERE id = ?`;
    req.db.run(query, [factory, modelNumber, factoryModelNumber, productKind, client, startDate, endDate, status, req.params.id], function(err) {
        if (err) {
            console.error('Errore nell\'aggiornamento del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(200).send('Progetto aggiornato con successo');
    });
});

// Endpoint per eliminare un progetto
router.delete('/api/projects/:id', (req, res) => {
    const query = `DELETE FROM projects WHERE id = ?`;
    req.db.run(query, req.params.id, function(err) {
        if (err) {
            console.error('Errore nell\'eliminazione del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(200).send('Progetto eliminato con successo');
    });
});

// Endpoint per ottenere i membri del team
router.get('/api/team-members', (req, res) => {
    const query = 'SELECT id, name, role, email, color, username FROM users';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero dei team members:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere un membro del team
router.post('/api/team-members', (req, res) => {
    const { name, role, email, color, username, password } = req.body;
    const query = `INSERT INTO users (name, role, email, color, username, password) VALUES (?, ?, ?, ?, ?, ?)`;
    req.db.run(query, [name, role, email, color, username, password], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento del team member:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Endpoint per aggiornare un membro del team
router.put('/api/team-members/:id', (req, res) => {
    const { name, role, email, color } = req.body;
    const userId = req.params.id;

    console.log(`Tentativo di aggiornamento del team member con ID: ${userId}`);
    console.log(`Dati ricevuti: name=${name}, role=${role}, email=${email}, color=${color}`);

    const query = `UPDATE users SET name = ?, role = ?, email = ?, color = ? WHERE id = ?`;

    req.db.run(query, [name, role, email, color, userId], function(err) {
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
router.get('/api/team-members/:id/privileges', (req, res) => {
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
router.put('/api/team-members/:id/privileges', (req, res) => {
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
router.get('/api/team-members/:id', (req, res) => {
    const userId = req.params.id;
    const query = 'SELECT id, name, role, email, color, username FROM users WHERE id = ?';

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
router.get('/api/session-user', (req, res) => {
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
router.post('/api/projects/:id/history', (req, res) => {
    const projectId = req.params.id;
    const { date, phase, description, assignedTo, status } = req.body;

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
router.put('/api/projects/:projectId/history/:historyId', (req, res) => {
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

router.delete('/api/projects/:projectId/history/:entryId', (req, res) => {
    const { projectId, entryId } = req.params;
    const query = `DELETE FROM project_history WHERE project_id = ? AND id = ?`;
    
    req.db.run(query, [projectId, entryId], function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Failed to delete history entry' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'History entry not found' });
        }
        res.status(200).json({ message: 'History entry deleted successfully' });
    });
});

// Endpoint per ottenere tutte le attività
router.get('/api/tasks', (req, res) => {
    const query = `
        SELECT 
            ph.id, 
            ph.project_id AS projectId, 
            p.modelNumber, 
            ph.date, 
            ph.description, 
            ph.assigned_to AS assignedTo, 
            ph.status
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

// File Management Endpoints
router.post('/api/projects/:projectId/files', checkAuthentication, upload.single('file'), (req, res) => {
    const { projectId } = req.params;
    const { file } = req;
    const { historyId } = req.body;
    const uploadedBy = req.session.user.id;

    const query = `INSERT INTO project_files (project_id, history_id, filename, filepath, uploaded_by) VALUES (?, ?, ?, ?, ?)`;
    
    req.db.run(query, [
        projectId,
        historyId,
        file.originalname,
        file.path,
        uploadedBy
    ], function(err) {
        if (err) {
            console.error('Error uploading file:', err);
            return res.status(500).json({ error: 'Failed to upload file' });
        }
        res.status(201).json({
            id: this.lastID,
            filename: file.originalname,
            filepath: file.path
        });
    });
});

router.get('/api/projects/:projectId/files', checkAuthentication, (req, res) => {
    const { projectId } = req.params;
    const query = `
        SELECT pf.*, u1.name as uploaded_by_name, u2.name as locked_by_name 
        FROM project_files pf 
        LEFT JOIN users u1 ON pf.uploaded_by = u1.id 
        LEFT JOIN users u2 ON pf.locked_by = u2.id 
        WHERE project_id = ?
    `;
    
    req.db.all(query, [projectId], (err, files) => {
        if (err) {
            console.error('Error fetching files:', err);
            return res.status(500).json({ error: 'Failed to fetch files' });
        }
        res.json(files);
    });
});

router.get('/api/files/:fileId/download', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    
    req.db.get('SELECT * FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            console.error('Error fetching file:', err);
            return res.status(500).json({ error: 'Failed to fetch file' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        res.download(file.filepath, file.filename);
    });
});

router.post('/api/files/:fileId/lock', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    const userId = req.session.user.id;
    
    req.db.get('SELECT locked_by FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        if (file.locked_by && file.locked_by !== userId) {
            return res.status(403).json({ error: 'File is locked by another user' });
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

router.post('/api/files/:fileId/unlock', checkAuthentication, (req, res) => {
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

router.delete('/api/files/:fileId', checkAuthentication, (req, res) => {
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
            
            fs.remove(file.filepath)
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

router.get('/api/projects/:projectId/history/:historyId/files', checkAuthentication, (req, res) => {
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