const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

// Importa i router
const { router: authRouter } = require('./routes/api/auth');
const projectsRouter = require('./routes/api/projects');
const phasesRouter = require('./routes/api/phases');
const productKindsRouter = require('./routes/api/product-kinds');
const teamMembersRouter = require('./routes/api/team-members');
const tasksRouter = require('./routes/api/tasks');
const { router: filesRouter, upload } = require('./routes/api/files');

// Monta i router sulle rispettive route
router.use('/', authRouter);
router.use('/projects', projectsRouter);
router.use('/phases', phasesRouter);
router.use('/product-kinds', productKindsRouter);
router.use('/team-members', teamMembersRouter);
router.use('/tasks', tasksRouter);
router.use('/files', filesRouter);

// Endpoint per il caricamento dei file di progetto
router.post('/projects/:projectId/files', upload.array('files'), (req, res) => {
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

// Endpoint per ottenere i file di un progetto
router.get('/projects/:projectId/files', (req, res) => {
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

// Endpoint per ottenere i file di una voce di cronologia
router.get('/projects/:projectId/history/:historyId/files', (req, res) => {
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
