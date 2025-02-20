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
        
        // Usa il percorso corretto per OnlyOffice
        const filePath = path.join('/var/www/onlyoffice/Data', path.basename(file.filepath));
        console.log('Original filepath:', file.filepath);
        console.log('File path per OnlyOffice:', filePath);
        
        // Verifica che il file esista
        if (!fs.existsSync(filePath)) {
            console.error('File non trovato:', filePath);
            return res.status(404).json({ error: 'File not found' });
        }

        // Forza il download del file invece di aprirlo nel browser
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.sendFile(filePath);
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

module.exports = {
    router,
    upload
};
