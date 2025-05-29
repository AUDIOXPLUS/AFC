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

module.exports = {
    router,
    upload
};
