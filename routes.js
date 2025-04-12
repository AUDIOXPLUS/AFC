const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

// Importa i router e i middleware necessari
const checkAuthentication = require('./routes/middleware/auth');
const { router: authRouter } = require('./routes/api/auth');
const projectsRouter = require('./routes/api/projects');
const phasesRouter = require('./routes/api/phases');
const productKindsRouter = require('./routes/api/product-kinds');
const teamMembersRouter = require('./routes/api/team-members');
const tasksRouter = require('./routes/api/tasks');
const translationsRouter = require('./routes/api/translations'); // Rotte per traduzioni GUI
const translateRouter = require('./routes/api/translate'); // Rotte per traduzione on-demand Baidu
const { router: filesRouter, upload } = require('./routes/api/files');
const { backupDatabase, syncToOneDrive } = require('./database/backup-database');
const backupCron = require('./database/setup-backup-cron');

// Endpoint per avviare un backup manuale
router.post('/backup/manual', checkAuthentication, async (req, res) => {
    // Invia l'header per supportare SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        // Invia aggiornamento iniziale
        res.write(`data: ${JSON.stringify({ progress: 0, status: 'Starting backup...' })}\n\n`);

        // Backup del database
        res.write(`data: ${JSON.stringify({ progress: 30, status: 'Creating database backup...' })}\n\n`);
        const backupPath = await backupDatabase('daily');
        
        // Sincronizzazione con OneDrive
        res.write(`data: ${JSON.stringify({ progress: 60, status: 'Syncing with OneDrive...' })}\n\n`);
        const syncResult = await syncToOneDrive();
        
        console.log('Sync result:', syncResult); // Log del risultato della sincronizzazione

        if (syncResult.success) {
            // Backup completato con successo
            console.log('Sending success message to client');
            res.write(`data: ${JSON.stringify({ 
                progress: 100, 
                status: 'Backup completed successfully', 
                success: true,
                path: backupPath 
            })}\n\n`);
        } else {
            // Backup completato ma sincronizzazione fallita
            console.log('Sending warning message to client:', syncResult.error);
            res.write(`data: ${JSON.stringify({ 
                progress: 100, 
                status: 'Backup completed with warnings', 
                success: true,
                path: backupPath,
                warning: true,
                warningMessage: syncResult.error
            })}\n\n`);
        }
        
        res.end();
    } catch (error) {
        console.error('Errore durante il backup manuale:', error);
        res.write(`data: ${JSON.stringify({ 
            progress: 100,
            status: 'Backup failed: ' + error.message,
            success: false
        })}\n\n`);
        res.end();
    }
});

// Monta i router sulle rispettive route
router.use('/', authRouter);
router.use('/projects', projectsRouter);
router.use('/phases', phasesRouter);
router.use('/product-kinds', productKindsRouter);
router.use('/team-members', teamMembersRouter);
router.use('/tasks', tasksRouter);
router.use('/translations', translationsRouter); // Rotte per traduzioni GUI
router.use('/translate', translateRouter); // Rotte per traduzione on-demand Baidu
router.use('/files', filesRouter);

// Endpoint per il caricamento dei file di progetto
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
            console.log('=== File Upload Debug ===');
            console.log('File originale:', {
                originalname: file.originalname,
                path: file.path,
                destination: file.destination,
                size: file.size
            });

            fs.chmodSync(file.path, 0o666);
            const stats = fs.statSync(file.path);
            console.log('File dopo chmod:', {
                path: file.path,
                absolutePath: path.resolve(file.path),
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
        console.log('Percorsi file:', {
            original: file.path,
            normalized: normalizedFilePath,
            onlyoffice: path.join('/var/www/onlyoffice/Data', normalizedFilePath),
            uploads: path.join('uploads', normalizedFilePath)
        });

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

// Endpoint per ottenere i file di una voce di cronologia
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

// Endpoint per ottenere lo stato attuale dei backup
router.get('/backup/settings', checkAuthentication, (req, res) => {
    try {
        const backupStatus = backupCron.getBackupStatus();
        res.json({ enabled: backupStatus });
    } catch (error) {
        console.error('Errore durante il recupero delle impostazioni di backup:', error);
        res.status(500).json({ error: 'Errore durante il recupero delle impostazioni di backup' });
    }
});

// Endpoint per aggiornare lo stato dei backup
router.post('/backup/settings', checkAuthentication, (req, res) => {
    try {
        const { enabled } = req.body;
        
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'Il parametro "enabled" deve essere un booleano' });
        }
        
        const newStatus = backupCron.setBackupStatus(enabled);
        res.json({ enabled: newStatus });
    } catch (error) {
        console.error('Errore durante l\'aggiornamento delle impostazioni di backup:', error);
        res.status(500).json({ error: 'Errore durante l\'aggiornamento delle impostazioni di backup' });
    }
});

module.exports = router;
