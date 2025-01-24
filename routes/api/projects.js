const express = require('express');
const router = express.Router();
const { checkAuthentication } = require('./auth');

// Endpoint per ottenere i progetti
router.get('/', checkAuthentication, (req, res) => {
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
    const query = `DELETE FROM projects WHERE id = ?`;
    req.db.run(query, req.params.id, function(err) {
        if (err) {
            console.error('Errore nell\'eliminazione del progetto:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(200).send('Progetto eliminato con successo');
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
    const query = 'SELECT * FROM project_history WHERE project_id = ?';
    req.db.all(query, [projectId], (err, rows) => {
        if (err) {
            console.error('Error fetching project history:', err);
            return res.status(500).send('Server error');
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere una voce alla cronologia del progetto
router.post('/:id/history', checkAuthentication, (req, res) => {
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

    req.db.run(query, [projectId, userId], function(err) {
        if (err) {
            console.error('Errore nel reset dello stato nuovo:', err);
            return res.status(500).json({ error: 'Errore del server' });
        }
        res.json({ message: 'Stato nuovo resettato con successo' });
    });
});

module.exports = router;
