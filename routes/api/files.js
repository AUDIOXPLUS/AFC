const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const checkAuthentication = require('../middleware/auth');

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

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Decodifica il nome del file da Buffer a stringa UTF-8
        const decodedFilename = Buffer.from(file.originalname, 'binary').toString('utf8');
        // Sostituisce il nome originale con quello decodificato
        file.originalname = decodedFilename;
        cb(null, true);
    }
});

// Endpoint per ottenere tutti i file .txt dei progetti autorizzati per la pagina Speaker Files
router.get('/speaker-files', checkAuthentication, async (req, res) => {
    console.log('========== RICHIESTA SPEAKER FILES ==========');
    
    try {
        // Prima otteniamo l'elenco degli ID dei progetti visibili replicando la logica dell'API projects
        const projectsResponse = await new Promise((resolve, reject) => {
            // Ottieni i permessi CRUD per replicare la logica projects
            const permissionsQuery = `
                SELECT c.properties, uc.properties as user_properties
                FROM crud c
                LEFT JOIN user_crud uc ON uc.crud_id = c.id AND uc.user_id = ?
                WHERE c.page = 'Projects' 
                AND c.action = 'Read'
            `;
            
            req.db.get(permissionsQuery, [req.session.user.id], async (err, user) => {
                if (err || !user || !user.user_properties) {
                    return reject(new Error('Permessi non validi'));
                }

                let permissions;
                try {
                    permissions = JSON.parse(user.user_properties);
                    if (!permissions.enabled) {
                        return reject(new Error('Permessi non abilitati'));
                    }
                } catch (error) {
                    return reject(new Error('Errore nel parsing dei permessi'));
                }

                // Costruisci la query per i progetti visibili (stessa logica di projects.js)
                let projectQuery = `
                    SELECT p.id
                    FROM projects p
                    LEFT JOIN (
                        SELECT ph1.*
                        FROM project_history ph1
                        LEFT JOIN project_history ph2 ON ph1.project_id = ph2.project_id AND 
                                                       (ph1.date < ph2.date OR (ph1.date = ph2.date AND ph1.id < ph2.id))
                        WHERE ph2.id IS NULL
                    ) latest_history ON p.id = latest_history.project_id
                    WHERE p.archived = 0
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
                `;

                const projectQueryParams = [];
                const level = permissions.level || permissions.scope;

                // Applica filtri di permesso
                switch (level) {
                    case 'own':
                        projectQuery += ` AND EXISTS (
                            SELECT 1 FROM project_history ph
                            WHERE ph.project_id = p.id
                            AND ph.assigned_to = ?
                        )`;
                        projectQueryParams.push(req.session.user.name);
                        break;
                    case 'own-factory':
                        projectQuery += ` AND p.factory = (
                            SELECT factory FROM users WHERE id = ?
                        )`;
                        projectQueryParams.push(req.session.user.id);
                        break;
                    case 'all-factories':
                        projectQuery += ` AND p.factory IS NOT NULL`;
                        break;
                    case 'own-client':
                        projectQuery += ` AND p.client = (
                            SELECT client_company_name FROM users WHERE id = ?
                        )`;
                        projectQueryParams.push(req.session.user.id);
                        break;
                    case 'all-clients':
                        projectQuery += ` AND p.client IS NOT NULL`;
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
                                    projectQuery += ` AND EXISTS (
                                        SELECT 1 FROM project_history ph
                                        JOIN users u ON ph.assigned_to = u.name
                                        WHERE ph.project_id = p.id
                                        AND u.id IN (${userProps.userIds.map(() => '?').join(',')})
                                    )`;
                                    projectQueryParams.push(...userProps.userIds);
                                } else {
                                    return reject(new Error('Nessun utente specifico definito nei permessi'));
                                }
                            } catch (e) {
                                return reject(new Error('Errore nel parsing delle properties degli utenti'));
                            }
                        } else {
                            return reject(new Error('Nessun utente specifico definito nei permessi'));
                        }
                        break;
                    case 'all':
                        // Nessun filtro aggiuntivo
                        break;
                    default:
                        return reject(new Error('Scope non valido'));
                }

                console.log('Query progetti visibili:', projectQuery);
                console.log('Parametri progetti:', projectQueryParams);

                // Esegui la query per ottenere gli ID dei progetti visibili
                req.db.all(projectQuery, projectQueryParams, (err, projects) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(projects.map(p => p.id));
                });
            });
        });

        console.log(`Progetti visibili all'utente: ${projectsResponse.length}`);
        
        if (projectsResponse.length === 0) {
            return res.json([]); // Nessun progetto visibile = nessun file
        }

        // Ora recupera i file .txt solo per i progetti visibili
        const projectIds = projectsResponse;
        const placeholders = projectIds.map(() => '?').join(',');

            const filesQuery = `
                SELECT pf.*, 
                       p.client,
                       p.productKind,
                       p.brand,
                       p.range,
                       p.line,
                       p.modelNumber,
                       ph.description,
                       CASE 
                           WHEN p.client IS NOT NULL AND p.modelNumber IS NOT NULL 
                           THEN p.client || ' - ' || p.modelNumber
                           WHEN p.client IS NOT NULL 
                           Then p.client
                           ELSE 'Progetto senza nome'
                       END as project_name,
                       CASE 
                           WHEN p.brand IS NOT NULL OR p.range IS NOT NULL OR p.line IS NOT NULL OR p.productKind IS NOT NULL OR p.status IS NOT NULL
                           THEN 
                               COALESCE(p.brand, '') ||
                               CASE WHEN p.brand IS NOT NULL AND (p.range IS NOT NULL OR p.line IS NOT NULL OR p.productKind IS NOT NULL OR p.status IS NOT NULL) THEN ' | ' ELSE '' END ||
                               COALESCE(p.range, '') ||
                               CASE WHEN p.range IS NOT NULL AND (p.line IS NOT NULL OR p.productKind IS NOT NULL OR p.status IS NOT NULL) THEN ' | ' ELSE '' END ||
                               COALESCE(p.line, '') ||
                               CASE WHEN p.line IS NOT NULL AND (p.productKind IS NOT NULL OR p.status IS NOT NULL) THEN ' | ' ELSE '' END ||
                               COALESCE(p.productKind, '') ||
                               CASE WHEN p.productKind IS NOT NULL AND p.status IS NOT NULL THEN ' | ' ELSE '' END ||
                               COALESCE(p.status, '')
                           ELSE 'Nessuna descrizione disponibile'
                       END as project_description
            FROM project_files pf
            LEFT JOIN projects p ON pf.project_id = p.id
            LEFT JOIN project_history ph ON pf.history_id = ph.id
            WHERE pf.filename LIKE '%.txt'
            AND pf.project_id IN (${placeholders})
            ORDER BY pf.upload_date DESC
        `;

        console.log('Query file per progetti autorizzati:', filesQuery);
        console.log('ID progetti autorizzati:', projectIds);

        req.db.all(filesQuery, projectIds, async (err, files) => {
            if (err) {
                console.error('Error fetching speaker files:', err);
                return res.status(500).json({ error: 'Failed to fetch speaker files' });
            }
            
            console.log(`Trovati ${files.length} file .txt nei progetti autorizzati. Inizio analisi contenuto...`);
            
            try {
                // Processa i file in parallelo per leggere il contenuto e filtrare
                const processedFiles = await Promise.all(files.map(async (file) => {
                    const filePath = resolveFilePath(file);
                    if (!filePath) {
                        return null; // File non trovato su disco
                    }

                    try {
                        const content = await fs.readFile(filePath, 'utf8');
                        
                        // Verifica se è un file valido (TS o Graph)
                        const hasTS = checkForTSParameters(content);
                        const { dataType } = analyzeFileContent(content);
                        const isGraph = dataType === 'db' || dataType === 'ohm';

                        if (hasTS || isGraph) {
                            return {
                                ...file,
                                content: content // Includiamo il contenuto per il client
                            };
                        }
                    } catch (readErr) {
                        console.warn(`Errore lettura file ${file.filename}:`, readErr);
                    }
                    return null;
                }));

                // Filtra via i null (file non trovati o non validi)
                const validFiles = processedFiles.filter(f => f !== null);
                
                console.log(`Restituiti ${validFiles.length} file validi (TS/Graph) su ${files.length} totali`);
                res.json(validFiles);

            } catch (processErr) {
                console.error('Errore nel processamento dei file:', processErr);
                res.status(500).json({ error: 'Errore nel processamento dei file' });
            }
        });

    } catch (error) {
        console.error('Errore generale nel recupero speaker files:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Endpoint per visualizzare un file
// Endpoint per ottenere le informazioni di un file
router.get('/:fileId', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    
    req.db.get('SELECT * FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            console.error('Error fetching file info:', err);
            return res.status(500).json({ error: 'Failed to fetch file information' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Rimuovi il percorso completo per sicurezza
        const fileInfo = {
            id: file.id,
            filename: file.filename,
            project_id: file.project_id,
            history_id: file.history_id,
            upload_date: file.upload_date,
            locked_by: file.locked_by,
            lock_date: file.lock_date
        };
        
        res.json(fileInfo);
    });
});

router.get('/:fileId/view', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    
    req.db.get('SELECT * FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            console.error('Error fetching file:', err);
            return res.status(500).json({ error: 'Failed to fetch file' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Informazioni di debug migliorate
        console.log('========== RICHIESTA FILE STEP ==========');
        console.log(`File richiesto: ID=${fileId}, Nome=${file.filename}, Percorso DB=${file.filepath}`);
        
        let filePath;
        
        // NUOVO APPROCCIO: verifichiamo PRIMA il percorso originale del file
        // 1. Primo tentativo: percorso originale dal database
        if (file.filepath) {
            // Se è un percorso relativo alle uploads, lo trasformo in assoluto
            if (file.filepath.startsWith('uploads/')) {
                filePath = path.join(__dirname, '../../', file.filepath);
            } else {
                // Se è già un percorso assoluto, lo uso così com'è
                filePath = file.filepath;
            }
            
            console.log('1. Tentativo primario (percorso originale):', filePath);
            if (fs.existsSync(filePath)) {
                console.log(`✓ Successo! File trovato al percorso originale: ${filePath}`);
                return res.sendFile(filePath);
            } else {
                console.log(`✗ File non trovato al percorso originale: ${filePath}`);
            }
        }
        
        // 2. Secondo tentativo: in OnlyOffice con ID nel nome
        const onlyOfficePath1 = path.join('/var/www/onlyoffice/Data', `${fileId}-${path.basename(file.filepath)}`);
        console.log('2. Tentativo in OnlyOffice con ID:', onlyOfficePath1);
        if (fs.existsSync(onlyOfficePath1)) {
            console.log(`✓ Successo! File trovato in OnlyOffice con ID: ${onlyOfficePath1}`);
            return res.sendFile(onlyOfficePath1);
        } else {
            console.log(`✗ File non trovato in OnlyOffice con ID: ${onlyOfficePath1}`);
        }
        
        // 3. Terzo tentativo: in OnlyOffice senza ID
        const onlyOfficePath2 = path.join('/var/www/onlyoffice/Data', path.basename(file.filepath));
        console.log('3. Tentativo in OnlyOffice senza ID:', onlyOfficePath2);
        if (fs.existsSync(onlyOfficePath2)) {
            console.log(`✓ Successo! File trovato in OnlyOffice senza ID: ${onlyOfficePath2}`);
            return res.sendFile(onlyOfficePath2);
        } else {
            console.log(`✗ File non trovato in OnlyOffice senza ID: ${onlyOfficePath2}`);
        }
        
        // Se non si trova in nessun percorso, restituiamo un errore 404
        console.error('File non trovato in nessun percorso');
        return res.status(404).json({ error: 'File not found' });
    });
});

// Endpoint per scaricare un file
router.get('/:fileId/download', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    
    req.db.get('SELECT * FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            console.error('Error fetching file:', err);
            return res.status(500).json({ error: 'Failed to fetch file' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Informazioni di debug migliorate
        console.log('========== DOWNLOAD FILE ==========');
        console.log(`File richiesto: ID=${fileId}, Nome=${file.filename}, Percorso DB=${file.filepath}`);
        
        let filePath;
        
        // Utilizziamo la stessa logica migliorata dell'endpoint view
        // 1. Primo tentativo: percorso originale dal database
        if (file.filepath) {
            // Se è un percorso relativo alle uploads, lo trasformo in assoluto
            if (file.filepath.startsWith('uploads/')) {
                filePath = path.join(__dirname, '../../', file.filepath);
            } else {
                // Se è già un percorso assoluto, lo uso così com'è
                filePath = file.filepath;
            }
            
            console.log('1. Tentativo primario (percorso originale):', filePath);
            if (fs.existsSync(filePath)) {
                console.log(`✓ Successo! File trovato al percorso originale: ${filePath}`);
                
                // Forza il download del file invece di aprirlo nel browser
                res.setHeader('Content-Type', 'application/octet-stream');
                
                // Gestione corretta dei caratteri non ASCII nel nome del file
                const encodedFilename = encodeURIComponent(file.filename).replace(/['()]/g, escape);
                res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
                
                return res.sendFile(filePath);
            } else {
                console.log(`✗ File non trovato al percorso originale: ${filePath}`);
            }
        }
        
        // 2. Secondo tentativo: in OnlyOffice con ID nel nome
        const onlyOfficePath1 = path.join('/var/www/onlyoffice/Data', `${fileId}-${path.basename(file.filepath)}`);
        console.log('2. Tentativo in OnlyOffice con ID:', onlyOfficePath1);
        if (fs.existsSync(onlyOfficePath1)) {
            console.log(`✓ Successo! File trovato in OnlyOffice con ID: ${onlyOfficePath1}`);
            
            // Forza il download del file invece di aprirlo nel browser
            res.setHeader('Content-Type', 'application/octet-stream');
            
            // Gestione corretta dei caratteri non ASCII nel nome del file
            const encodedFilename = encodeURIComponent(file.filename).replace(/['()]/g, escape);
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
            
            return res.sendFile(onlyOfficePath1);
        } else {
            console.log(`✗ File non trovato in OnlyOffice con ID: ${onlyOfficePath1}`);
        }
        
        // 3. Terzo tentativo: in OnlyOffice senza ID
        const onlyOfficePath2 = path.join('/var/www/onlyoffice/Data', path.basename(file.filepath));
        console.log('3. Tentativo in OnlyOffice senza ID:', onlyOfficePath2);
        if (fs.existsSync(onlyOfficePath2)) {
            console.log(`✓ Successo! File trovato in OnlyOffice senza ID: ${onlyOfficePath2}`);
            
            // Forza il download del file invece di aprirlo nel browser
            res.setHeader('Content-Type', 'application/octet-stream');
            
            // Gestione corretta dei caratteri non ASCII nel nome del file
            const encodedFilename = encodeURIComponent(file.filename).replace(/['()]/g, escape);
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
            
            return res.sendFile(onlyOfficePath2);
        } else {
            console.log(`✗ File non trovato in OnlyOffice senza ID: ${onlyOfficePath2}`);
        }
        
        // Se non si trova in nessun percorso, restituiamo un errore 404
        console.error('File non trovato in nessun percorso');
        return res.status(404).json({ error: 'File not found' });
    });
});

// Endpoint per bloccare un file
router.post('/:fileId/lock', checkAuthentication, (req, res) => {
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

// Endpoint per sbloccare un file
router.post('/:fileId/unlock', checkAuthentication, (req, res) => {
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

// Endpoint per eliminare un file
router.delete('/:fileId', checkAuthentication, (req, res) => {
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
        
        // Prima di eliminare il file fisico, controlliamo se altre entry utilizzano lo stesso file
        // Prendi il filename dal percorso del file
        const filename = path.basename(file.filepath);
        
        // Verifica se il file viene utilizzato da altri record
        req.db.get(
            'SELECT COUNT(*) as count FROM project_files WHERE filepath LIKE ? AND id != ?',
            ['%' + filename + '%', fileId],
            (err, result) => {
                if (err) {
                    console.error('Errore nel controllo di riferimenti multipli al file:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                // Elimina il riferimento dal database
                req.db.run('DELETE FROM project_files WHERE id = ?', [fileId], function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to delete file reference' });
                    }
                    
                    // Se ci sono altre entry che utilizzano questo file, non eliminarlo fisicamente
                    if (result.count > 0) {
                        console.log(`File ${filename} è condiviso con altri ${result.count} record. Non verrà eliminato fisicamente.`);
                        return res.json({ 
                            message: 'File reference deleted successfully',
                            note: 'File is shared with other records and was not physically deleted'
                        });
                    }
                    
                    // Altrimenti, elimina fisicamente il file
                    const filePath = path.join('/var/www/onlyoffice/Data', filename);
                    console.log('Original filepath:', file.filepath);
                    console.log('File path per OnlyOffice:', filePath);
                    
                    // Verifica che il file esista
                    if (!fs.existsSync(filePath)) {
                        console.error('File non trovato:', filePath);
                        return res.status(200).json({ 
                            message: 'File reference deleted successfully',
                            note: 'Physical file not found on disk'
                        });
                    }

                    fs.remove(filePath)
                        .then(() => {
                            res.json({ message: 'File deleted successfully' });
                        })
                        .catch(err => {
                            console.error('Error deleting file from disk:', err);
                            // Il riferimento è già stato rimosso, quindi restituisci un messaggio parziale di successo
                            res.status(207).json({ 
                                message: 'File reference deleted successfully',
                                error: 'Failed to delete physical file from disk' 
                            });
                        });
                });
            }
        );
    });
});

// Endpoint per ottenere il contenuto testuale di un file
router.get('/:fileId/content', checkAuthentication, (req, res) => {
    const { fileId } = req.params;
    
    req.db.get('SELECT * FROM project_files WHERE id = ?', [fileId], (err, file) => {
        if (err) {
            console.error('Error fetching file:', err);
            return res.status(500).json({ error: 'Failed to fetch file' });
        }
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Verifica che il file sia di tipo testo
        if (!file.filename.toLowerCase().endsWith('.txt')) {
            return res.status(400).json({ error: 'File is not a text file' });
        }

        // Informazioni di debug per content endpoint
        console.log('========== RICHIESTA FILE CONTENT ==========');
        console.log(`File richiesto: ID=${fileId}, Nome=${file.filename}, Percorso DB=${file.filepath}`);
        
        let filePath;
        
        // Usa la stessa logica robusta degli altri endpoint
        // 1. Primo tentativo: percorso originale dal database
        if (file.filepath) {
            // Se è un percorso relativo alle uploads, lo trasformo in assoluto
            if (file.filepath.startsWith('uploads/')) {
                filePath = path.join(__dirname, '../../', file.filepath);
            } else {
                // Se è già un percorso assoluto, lo uso così com'è
                filePath = file.filepath;
            }
            
            console.log('1. Tentativo primario (percorso originale):', filePath);
            if (fs.existsSync(filePath)) {
                console.log(`✓ Successo! File trovato al percorso originale: ${filePath}`);
                return readAndSendFileContent(filePath, res);
            } else {
                console.log(`✗ File non trovato al percorso originale: ${filePath}`);
            }
        }
        
        // 2. Secondo tentativo: in OnlyOffice con ID nel nome
        const onlyOfficePath1 = path.join('/var/www/onlyoffice/Data', `${fileId}-${path.basename(file.filepath)}`);
        console.log('2. Tentativo in OnlyOffice con ID:', onlyOfficePath1);
        if (fs.existsSync(onlyOfficePath1)) {
            console.log(`✓ Successo! File trovato in OnlyOffice con ID: ${onlyOfficePath1}`);
            return readAndSendFileContent(onlyOfficePath1, res);
        } else {
            console.log(`✗ File non trovato in OnlyOffice con ID: ${onlyOfficePath1}`);
        }
        
        // 3. Terzo tentativo: in OnlyOffice senza ID
        const onlyOfficePath2 = path.join('/var/www/onlyoffice/Data', path.basename(file.filepath));
        console.log('3. Tentativo in OnlyOffice senza ID:', onlyOfficePath2);
        if (fs.existsSync(onlyOfficePath2)) {
            console.log(`✓ Successo! File trovato in OnlyOffice senza ID: ${onlyOfficePath2}`);
            return readAndSendFileContent(onlyOfficePath2, res);
        } else {
            console.log(`✗ File non trovato in OnlyOffice senza ID: ${onlyOfficePath2}`);
        }
        
        // Se non si trova in nessun percorso, restituiamo un errore 404
        console.error('File non trovato in nessun percorso per content endpoint');
        return res.status(404).json({ error: 'File not found on disk' });
    });
});

// Funzione helper per leggere il contenuto dei file per speaker files
function readFileContentForSpeaker(filePath, fileRecord, filesArray, callback) {
    fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
            console.error(`Error reading file content for ${fileRecord.filename}:`, err);
            content = ''; // Se non riusciamo a leggere, mettiamo stringa vuota
        }
        
        filesArray.push({
            ...fileRecord,
            content: content || ''
        });
        
        callback();
    });
}

// Funzione helper per leggere e inviare il contenuto del file
function readAndSendFileContent(filePath, res) {
    fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
            console.error('Error reading file content:', err);
            return res.status(500).json({ error: 'Failed to read file content' });
        }
        console.log(`File content read successfully, length: ${content.length} characters`);
        res.type('text/plain').send(content);
    });
}

// Funzioni helper per l'analisi dei file (porting dal client)
function checkForTSParameters(content) {
    if (!content) return false;
    const keywords = ["Fs", "Re", "Sd", "Qms", "Qes", "Qts", "Cms", "Mms", "Rms", "Bl", "dBspl", "VAS", "Zmin", "L1kHz", "L10kHz"];
    let count = 0;
    keywords.forEach(kw => {
        if (content.toLowerCase().includes(kw.toLowerCase())) {
            count++;
        }
    });
    return count >= 3;
}

function analyzeFileContent(content) {
    if (!content) return { dataType: 'unknown' };
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let dataType = 'unknown';

    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const lineForCheck = lines[i].toLowerCase();
        if (lineForCheck.includes('db')) {
            dataType = 'db';
        } else if (lineForCheck.includes('ohm') || lineForCheck.includes('impedance')) {
            dataType = 'ohm';
        }
        if (dataType !== 'unknown') break;
    }
    return { dataType };
}

function resolveFilePath(file) {
    // 1. Primo tentativo: percorso originale dal database
    if (file.filepath) {
        let filePath;
        if (file.filepath.startsWith('uploads/')) {
            filePath = path.join(__dirname, '../../', file.filepath);
        } else {
            filePath = file.filepath;
        }
        if (fs.existsSync(filePath)) return filePath;
    }
    
    // 2. Secondo tentativo: in OnlyOffice con ID nel nome
    const onlyOfficePath1 = path.join('/var/www/onlyoffice/Data', `${file.id}-${path.basename(file.filepath)}`);
    if (fs.existsSync(onlyOfficePath1)) return onlyOfficePath1;
    
    // 3. Terzo tentativo: in OnlyOffice senza ID
    const onlyOfficePath2 = path.join('/var/www/onlyoffice/Data', path.basename(file.filepath));
    if (fs.existsSync(onlyOfficePath2)) return onlyOfficePath2;

    return null;
}

module.exports = {
    router,
    upload,
    checkForTSParameters,
    analyzeFileContent,
    resolveFilePath
};
