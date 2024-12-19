const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const session = require('express-session');
const fs = require('fs');
const http = require('http');
const app = express();
const routes = require('./routes');

// Definisci la tua chiave segreta JWT (deve corrispondere a quella in OnlyOffice)
const jwtSecret = 'MDQ879SA5Lw8wnGxJ2TTPK5IFTIX2KZ7';

// Inizializzazione del database
const db = new sqlite3.Database(path.join(__dirname, 'database', 'AFC.db'), (err) => {
    if (err) {
        console.error('Errore di connessione al database:', err);
    } else {
        console.log('Connessione al database riuscita');
    }
});

// Middleware per il parsing delle richieste
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Configurazione delle sessioni
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Imposta la directory degli uploads tramite variabile d'ambiente o percorso di default
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

// Elenco dei file protetti
const protectedFiles = ['/project-details.html', '/role-selection.html'];

// Middleware per proteggere i file specifici
app.use((req, res, next) => {
    if (protectedFiles.includes(req.path)) {
        console.log(`Richiesta per file protetto: ${req.path}`);
        if (req.session && req.session.user) {
            return next();
        } else {
            res.redirect('/login.html');
        }
    } else {
        next();
    }
});

// Middleware per passare l'istanza del database alle rotte
app.use((req, res, next) => {
    console.log('Richiesta ricevuta:', req.method, req.path);
    req.db = db;
    next();
});

// Utilizzo delle rotte
app.use('/api', routes);
console.log('Routes file loaded successfully');

// Servire file statici
app.use(express.static(__dirname));

// -------------------- Integrazione OnlyOffice --------------------

// Funzione per normalizzare i percorsi dei file
function normalizeFilePath(filePath) {
    // Rimuove eventuali riferimenti alla directory uploads duplicati
    let normalized = filePath.replace(/^uploads[\/\\]/, '');
    normalized = normalized.replace(/\\/g, '/');
    
    // Log per debug
    console.log('Normalizzazione percorso:');
    console.log('Input:', filePath);
    console.log('Output:', normalized);
    
    return normalized;
}

// Rotta per servire la pagina dell'editor di OnlyOffice
app.get('/onlyoffice/editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'onlyoffice-editor.html'));
});

// Endpoint per fornire la configurazione per OnlyOffice
app.get('/onlyoffice/config', (req, res) => {
    const filePathParam = req.query.filePath;
    console.log('Config - filePathParam ricevuto:', filePathParam);

    if (!filePathParam) {
        res.status(400).send('Parametro filePath mancante');
        return;
    }

    const normalizedPath = normalizeFilePath(filePathParam);
    console.log('Config - normalizedPath:', normalizedPath);

    const serverAddress = 'host.docker.internal';
    const port = process.env.PORT || 3000;
    
    // Costruzione URL del documento
    const documentUrl = `${req.protocol}://${serverAddress}:${port}/uploads/${normalizedPath}`;
    console.log('Config - documentUrl:', documentUrl);

    // Costruzione URL di callback
    const callbackUrl = `${req.protocol}://${serverAddress}:${port}/onlyoffice/callback?filePath=${encodeURIComponent(normalizedPath)}`;
    console.log('Config - callbackUrl:', callbackUrl);

    const documentKey = Math.random().toString(36).substring(2) + Date.now().toString();
    
    const config = {
        document: {
            fileType: path.extname(normalizedPath).substring(1),
            key: documentKey,
            title: path.basename(normalizedPath),
            url: documentUrl
        },
        editorConfig: {
            callbackUrl: callbackUrl,
            user: {
                id: req.session && req.session.user ? req.session.user.id : 'guest',
                name: req.session && req.session.user ? req.session.user.name : 'Guest'
            },
        },
    };

    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const payload = {
        ...config,
        iat: currentTimeInSeconds,
    };

    const token = jwt.sign(payload, jwtSecret, { noTimestamp: true });
    config.token = token;

    console.log('Config - Configurazione completa:', JSON.stringify(config, null, 2));
    res.json(config);
});

// Endpoint per gestire il callback di OnlyOffice
app.post('/onlyoffice/callback', (req, res) => {
    const filePathParam = req.query.filePath;
    console.log('Callback - filePathParam ricevuto:', filePathParam);

    if (!filePathParam) {
        console.error('Callback - Parametro filePath mancante');
        res.status(400).send('Parametro filePath mancante');
        return;
    }

    // Normalizza il percorso del file
    const normalizedPath = normalizeFilePath(filePathParam);
    console.log('Callback - normalizedPath:', normalizedPath);

    // Costruisci il percorso completo del file
    const fullFilePath = path.join(uploadsDir, normalizedPath);
    console.log('Callback - fullFilePath:', fullFilePath);

    // Verifica che il percorso sia all'interno della directory uploads
    if (!fullFilePath.startsWith(uploadsDir)) {
        console.error('Callback - Tentativo di accesso non autorizzato al percorso:', fullFilePath);
        res.status(400).send('Percorso del file non valido');
        return;
    }

    const status = req.body.status;
    let downloadUrl = req.body.url;
    console.log('Callback - status:', status);
    console.log('Callback - downloadUrl originale:', downloadUrl);

    // Status 2 o 3 indicano che il documento è stato modificato
    if (status === 2 || status === 3) {
        // Modifica l'URL per utilizzare il nome del container invece di localhost
        downloadUrl = downloadUrl.replace('localhost:8081', 'onlyoffice-document-server');
        console.log('Callback - downloadUrl modificato:', downloadUrl);

        // Assicurati che la directory esista
        fs.mkdirSync(path.dirname(fullFilePath), { recursive: true });
        console.log('Callback - Directory creata:', path.dirname(fullFilePath));

        // Crea il write stream per salvare il file
        const fileStream = fs.createWriteStream(fullFilePath);
        console.log('Callback - Write stream creato per:', fullFilePath);

        // Scarica il file modificato
        http.get(downloadUrl, (response) => {
            if (response.statusCode !== 200) {
                console.error('Callback - Errore nella risposta HTTP:', response.statusCode);
                fileStream.close();
                return res.status(500).send('Errore durante il download del documento');
            }

            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log('Callback - File salvato con successo:', fullFilePath);
                res.json({ error: 0 });
            });
        }).on('error', (err) => {
            fileStream.close();
            fs.unlink(fullFilePath, () => {});
            console.error('Callback - Errore durante il download:', err.message);
            res.status(500).send('Errore durante il download del documento');
        });
    } else {
        console.log('Callback - Nessuna modifica necessaria, status:', status);
        res.json({ error: 0 });
    }
});

// -------------------- Fine Integrazione OnlyOffice --------------------

// Endpoint per la visualizzazione dei file
app.get('/api/files/:id/view', (req, res) => {
    const fileId = req.params.id;
    console.log('Richiesta di visualizzazione file con ID:', fileId);

    db.get('SELECT filePath FROM files WHERE id = ?', [fileId], (err, row) => {
        if (err || !row) {
            console.error('Errore durante il recupero del percorso del file:', err);
            return res.status(404).send('File non trovato');
        }

        let filePath = row.filePath;
        console.log('filePath recuperato dal db:', filePath);

        // Normalizziamo il percorso
        let normalizedPath = path.normalize(filePath);

        // Rimuoviamo il prefisso Windows completo (C:\Users\Francesco\AFC-V3\)
        normalizedPath = normalizedPath.replace(/^([A-Za-z]:[\\/]+Users[\\/]+Francesco[\\/]+AFC-V3[\\/]+)/i, '');

        // Rimuove eventuali slash iniziali
        normalizedPath = normalizedPath.replace(/^([\\/]+)/, '');

        // Ora normalizedPath dovrebbe iniziare da uploads/... 
        // In caso non dovesse, assicurarsi che contenga la cartella uploads
        // (Se i file sono sempre in uploads va bene così)

        const absolutePath = path.join(__dirname, normalizedPath);
        console.log('absolutePath:', absolutePath);

        res.sendFile(absolutePath, { root: __dirname }, (err) => {
            if (err) {
                console.error('Errore durante l\'invio del file:', err);
                res.status(404).send('File non trovato');
            } else {
                console.log('File inviato con successo');
            }
        });
    });
});

// Avvio del server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server avviato sulla porta ${PORT} su tutte le interfacce`);
});
