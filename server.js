// Carica le variabili d'ambiente da .env (se esiste) all'inizio
require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const fs = require('fs');
const http = require('http');
const app = express();
const routes = require('./routes');
const backupManager = require('./database/backup-database');

// Inizializza il sistema di backup
backupManager.setupBackupDirectories();

// Sincronizza i backup da OneDrive alle directory locali
console.log('Sincronizzazione dei backup da OneDrive...');
backupManager.syncFromOneDrive()
    .then((result) => {
        if (result && result.successCount > 0) {
            console.log(`Sincronizzazione dei backup da OneDrive completata con successo: ${result.successCount} operazioni completate, ${result.errorCount} operazioni saltate`);
        } else {
            console.log('Nessun backup sincronizzato da OneDrive. Verifica la configurazione di rclone.');
        }
    })
    .catch(error => {
        console.error('Errore durante la sincronizzazione dei backup da OneDrive:', error);
        console.log('Il server continuerà a funzionare normalmente. Verifica la configurazione di rclone e riprova più tardi.');
    });

// Endpoint per il backup manuale con SSE
app.get('/backup/manual', (req, res) => {
    // Configura l'header per SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Invia aggiornamento iniziale
    res.write(`data: ${JSON.stringify({ progress: 0, status: 'Avvio backup...' })}\n\n`);

    // Esegui il backup
    backupManager.runBackup()
        .then(() => {
            // Backup completato con successo
            res.write(`data: ${JSON.stringify({ 
                progress: 100, 
                status: 'Backup completato con successo!',
                success: true 
            })}\n\n`);
            res.end();
        })
        .catch(error => {
            // Errore durante il backup
            console.error('Errore durante il backup manuale:', error);
            res.write(`data: ${JSON.stringify({ 
                progress: 100, 
                status: 'Errore durante il backup: ' + error.message,
                success: false 
            })}\n\n`);
            res.end();
        });

    // Gestione della chiusura della connessione
    req.on('close', () => {
        res.end();
    });
});

// Endpoint per sincronizzare i backup da OneDrive con SSE
app.get('/backup/pull-onedrive', (req, res) => {
    // Configura l'header per SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Invia aggiornamento iniziale
    res.write(`data: ${JSON.stringify({ progress: 0, status: 'Avvio sincronizzazione da OneDrive...' })}\n\n`);

    // Verifica che rclone sia configurato correttamente
    backupManager.executeRcloneCommand('rclone listremotes')
        .then(remotes => {
            if (!remotes.includes('afc-backup:')) {
                throw new Error('Remote "afc-backup" non configurato in rclone');
            }
            
            // Aggiornamento intermedio
            res.write(`data: ${JSON.stringify({ progress: 20, status: 'Verifica configurazione rclone completata' })}\n\n`);
            res.write(`data: ${JSON.stringify({ progress: 30, status: 'Sincronizzazione backup giornalieri...' })}\n\n`);

            // Esegui la sincronizzazione da OneDrive
            return backupManager.syncFromOneDrive();
        })
        .then((result) => {
            // Sincronizzazione completata con successo
            if (result && result.successCount > 0) {
                res.write(`data: ${JSON.stringify({ 
                    progress: 100, 
                    status: `Sincronizzazione da OneDrive completata con successo! ${result.successCount} operazioni completate, ${result.errorCount} operazioni saltate`,
                    success: true 
                })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ 
                    progress: 100, 
                    status: 'Nessun backup sincronizzato da OneDrive. Verifica che esistano backup su OneDrive.',
                    success: true 
                })}\n\n`);
            }
            res.end();
        })
        .catch(error => {
            // Errore durante la sincronizzazione
            console.error('Errore durante la sincronizzazione da OneDrive:', error);
            
            // Personalizza il messaggio di errore in base al tipo di errore
            let errorMessage = error.message;
            if (error.message.includes('not found')) {
                errorMessage = 'Remote "afc-backup" non trovato. Eseguire "rclone config" per configurarlo.';
            } else if (error.message.includes('permission denied')) {
                errorMessage = 'Permesso negato. Verifica le autorizzazioni di rclone.';
            } else if (error.message.includes('network error') || error.message.includes('connection reset')) {
                errorMessage = 'Errore di rete. Verifica la connessione internet e riprova più tardi.';
            }
            
            res.write(`data: ${JSON.stringify({ 
                progress: 100, 
                status: 'Errore durante la sincronizzazione da OneDrive: ' + errorMessage,
                success: false 
            })}\n\n`);
            res.end();
        });

    // Gestione della chiusura della connessione
    req.on('close', () => {
        res.end();
    });
});


// Timer per il controllo dell'inattività
setInterval(backupManager.checkAndConsolidate, 5 * 60 * 1000); // Controlla ogni 5 minuti

// Definisci la tua chiave segreta JWT (deve corrispondere a quella in OnlyOffice)
const jwtSecret = 'MDQ879SA5Lw8wnGxJ2TTPK5IFTIX2KZ7';

// Inizializzazione del database con wrapper per il backup
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

// Configurazione delle sessioni con SQLiteStore
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.sqlite', // File del database per le sessioni
        dir: './database',     // Directory dove salvare il file del database
        table: 'sessions'      // Nome della tabella per le sessioni
    }),
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Imposta a true se utilizzi HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 ore
    }
}));
console.log('Sessioni configurate con SQLiteStore');

// Funzione per verificare e configurare la directory uploads
function setupUploadsDirectory() {
    // Imposta la directory degli uploads tramite variabile d'ambiente o percorso di default
    const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
    console.log('Directory uploads configurata:', uploadsDir);

    try {
        // Verifica che il percorso sia assoluto
        if (!path.isAbsolute(uploadsDir)) {
            throw new Error(`Il percorso della directory uploads deve essere assoluto: ${uploadsDir}`);
        }

        // Verifica che il percorso non contenga simboli pericolosi
        if (uploadsDir.includes('..')) {
            throw new Error(`Il percorso della directory uploads non può contenere '..' : ${uploadsDir}`);
        }

        // Crea o aggiorna i permessi della directory
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o777 });
            console.log('Directory uploads creata con permessi:', uploadsDir);
        } else {
            try {
                fs.chmodSync(uploadsDir, 0o777);
                console.log('Permessi directory uploads aggiornati:', uploadsDir);
            } catch (e) {
                console.warn(`Impossibile aggiornare i permessi per la directory uploads (questo è normale in ambienti Docker): ${e.message}`);
            }
        }

        // Verifica che la directory sia scrivibile
        const testFile = path.join(uploadsDir, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log('Directory uploads è scrivibile');

        // Ottieni e mostra le informazioni sulla directory
        const stats = fs.statSync(uploadsDir);
        console.log('Directory uploads stats:', {
            uid: stats.uid,
            gid: stats.gid,
            mode: stats.mode.toString(8),
            size: stats.size
        });

        return uploadsDir;
    } catch (err) {
        console.error('Errore fatale nella configurazione della directory uploads:', err);
        process.exit(1);
    }
}

// Configura la directory uploads
const uploadsDir = setupUploadsDirectory();

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
    // Log dettagliato per monitorare la sessione
    if (req.session) {
        console.log('Dettagli sessione:', {
            sessionId: req.session.id,
            user: req.session.user ? req.session.user : 'non presente',
            cookie: req.session.cookie ? req.session.cookie : 'non presente'
        });
    } else {
        console.log('Sessione non presente per la richiesta:', req.method, req.path);
    }
    next();
});

// Utilizzo delle rotte
app.use('/api', routes);
console.log('Routes file loaded successfully');

// Endpoint dedicato per servire i file dalla directory uploads
app.get('/uploads/*', (req, res) => {
    const filePath = path.join(uploadsDir, req.params[0]);
    console.log('Richiesta file:', filePath);
    
    // Verifica che il file esista
    if (!fs.existsSync(filePath)) {
        console.error('File non trovato:', filePath);
        return res.status(404).send('File non trovato');
    }

    // Imposta gli header per evitare la cache
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString()
    });

    // Leggi e invia il file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
});

// Servire altri file statici
app.use(express.static(__dirname));

// Endpoint per il healthcheck
app.get('/healthcheck', (req, res) => {
    res.status(200).send('OK');
});

app.get('/api/backup-history', async (req, res) => {
    try {
        // Restituisci la lista dei backup locali
        const backupTypes = ['daily', 'weekly', 'monthly', 'yearly'];
        const backups = {};
        const baseDir = path.join(__dirname, 'database', 'backups');
        backupTypes.forEach(type => {
            const dir = path.join(baseDir, type);
            if (fs.existsSync(dir)) {
                backups[type] = fs.readdirSync(dir)
                    .filter(f => f.startsWith('AFC.db.backup-'))
                    .sort();
            } else {
                backups[type] = [];
            }
        });
        res.json(backups);
    } catch (error) {
        console.error('Errore durante il recupero dei backup:', error);
        res.status(500).json({ error: 'Errore durante il recupero dei backup' });
    }
});

// Endpoint per ottenere gli utenti connessi
app.get('/api/connected-users', (req, res) => {
    // Ottiene tutti gli utenti con sessione attiva
    const connectedUsers = [];
    // Itera attraverso tutte le sessioni attive
    req.sessionStore.all((error, sessions) => {
        if (error) {
            console.error('Errore nel recupero delle sessioni:', error);
            return res.status(500).json({ error: 'Errore interno del server' });
        }
        
        // Estrae gli utenti dalle sessioni attive
        if (sessions) {
            Object.values(sessions).forEach(session => {
                if (session.user) {
                    connectedUsers.push({
                        name: session.user.name,
                        id: session.user.id
                    });
                }
            });
        }
        
        res.json(connectedUsers);
    });
});

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
        return res.status(400).send('Parametro filePath mancante');
    }

    const normalizedPath = normalizeFilePath(filePathParam);
    console.log('Config - normalizedPath:', normalizedPath);

    // Qui la modifica: fallback su 'localhost' invece di '192.168.1.148'
    const serverAddress = process.env.SERVER_HOST || 'localhost';
    const port = process.env.PORT || 3000;
    
    // Costruzione URL del documento
    const documentUrl = `http://${serverAddress}:${port}/uploads/${normalizedPath}`;
    console.log('Config - documentUrl:', documentUrl);

    // Costruzione URL di callback
    const callbackUrl = `http://${serverAddress}:${port}/onlyoffice/callback?filePath=${encodeURIComponent(normalizedPath)}`;
    console.log('Config - callbackUrl:', callbackUrl);

    const documentKey = Math.random().toString(36).substring(2) + Date.now().toString();
    
    const config = {
        document: {
            fileType: path.extname(normalizedPath).substring(1),
            key: documentKey,
            title: path.basename(normalizedPath),
            url: documentUrl + '?t=' + Date.now(), // Aggiunto timestamp per evitare la cache
            permissions: {
                edit: true,
                download: true,
                delete: true
            }
        },
        editorConfig: {
            callbackUrl: callbackUrl,
            user: {
                id: req.session && req.session.user ? req.session.user.id : 'guest',
                name: req.session && req.session.user ? req.session.user.name : 'Guest'
            },
            mode: 'edit',
            autosave: true,
            forcesave: true,
            cache: {
                enable: false
            },
            coEditing: {
                mode: 'fast',
                change: true
            }
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
app.post('/onlyoffice/callback', async (req, res) => {
    const filePathParam = req.query.filePath;
    console.log('Callback - filePathParam ricevuto:', filePathParam);

    if (!filePathParam) {
        console.error('Callback - Parametro filePath mancante');
        return res.status(400).send('Parametro filePath mancante');
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
        return res.status(400).send('Percorso del file non valido');
    }

    console.log('Callback - Corpo della richiesta:', JSON.stringify(req.body, null, 2));

    if (!req.body) {
        console.error('Callback - Corpo della richiesta mancante');
        return res.status(400).send('Corpo della richiesta mancante');
    }

    const status = req.body.status;
    let downloadUrl = req.body.url;

    // Verifica che lo status sia valido
    if (typeof status !== 'number') {
        console.error('Callback - Status non valido:', status);
        return res.status(400).send('Status non valido');
    }

    console.log('Callback - status:', status);
    console.log('Callback - downloadUrl originale:', downloadUrl);

    // Verifica che l'URL sia presente quando necessario
    if ((status === 2 || status === 3) && !downloadUrl) {
        console.error('Callback - URL di download mancante per status', status);
        return res.status(400).send('URL di download mancante');
    }
    
    // Status 6 indica che il documento è stato eliminato
    if (status === 6) {
        console.log('Callback - Documento eliminato');
        try {
            if (fs.existsSync(fullFilePath)) {
                fs.unlinkSync(fullFilePath);
                console.log('Callback - File eliminato:', fullFilePath);
            }
            // Forza il refresh del documento
            const serverAddress = process.env.SERVER_HOST || 'localhost';
            const port = process.env.PORT || 3000;
            const documentUrl = `http://${serverAddress}:${port}/uploads/${normalizedPath}`;
            
            // Forza la chiusura e riapertura del documento
            res.json({ 
                error: 0,
                status: 2,
                actions: [
                    {
                        type: 0, // Chiude il documento
                        data: {}
                    },
                    {
                        type: 1, // Riapre il documento
                        data: {
                            url: documentUrl + '?t=' + Date.now(),
                            token: jwt.sign({
                                document: {
                                    fileType: path.extname(normalizedPath).substring(1),
                                    key: Math.random().toString(36).substring(2) + Date.now().toString(),
                                    url: documentUrl + '?t=' + Date.now()
                                }
                            }, jwtSecret)
                        }
                    }
                ]
            });
        } catch (err) {
            console.error('Callback - Errore durante l\'eliminazione:', err.message);
            return res.status(500).send('Errore durante l\'eliminazione del documento');
        }
    }
    // Status 2 o 3 indicano che il documento è stato modificato
    else if (status === 2 || status === 3) {
        console.log('Callback - Documento modificato, procedo con il salvataggio');
        try {
            // Modifica l'URL per utilizzare il nome del container invece di localhost, etc.
            downloadUrl = downloadUrl.replace(
                /localhost:8081|192\.168\.1\.148:8081|185\.250\.144\.219:8081/,
                'onlyoffice-document-server'
            );
            console.log('Callback - downloadUrl modificato:', downloadUrl);

            // Crea la directory se non esiste
            const dirPath = path.dirname(fullFilePath);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true, mode: 0o777 });
                console.log('Callback - Directory creata con permessi:', dirPath);
            } else {
                // Assicuriamoci che la directory abbia i permessi corretti
                fs.chmodSync(dirPath, 0o777);
                console.log('Callback - Permessi directory aggiornati:', dirPath);
            }

            // Scarica il file modificato
            const tmpFilePath = fullFilePath + '.tmp';
            const fileStream = fs.createWriteStream(tmpFilePath, { mode: 0o666 });
            console.log('Callback - Write stream creato per:', tmpFilePath);

            console.log('Callback - Inizio download del file da:', downloadUrl);
            await new Promise((resolve, reject) => {
                const request = http.get(downloadUrl, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Status code: ${response.statusCode}`));
                        return;
                    }

                    const contentLength = response.headers['content-length'];
                    if (!contentLength || parseInt(contentLength) === 0) {
                        reject(new Error('File vuoto o content-length mancante'));
                        return;
                    }

                    console.log('Callback - Content-Length:', contentLength);
                    let receivedLength = 0;

                    response.on('data', (chunk) => {
                        receivedLength += chunk.length;
                        console.log(`Callback - Download progresso: ${receivedLength}/${contentLength} bytes`);
                    });

                    response.pipe(fileStream);

                    fileStream.on('finish', () => {
                        fileStream.close();
                        console.log('Callback - Download completato, procedo con il salvataggio');
                        // Rinomina il file temporaneo nel file finale
                        try {
                            // Verifica che il file temporaneo esista e non sia vuoto
                            const tmpStats = fs.statSync(tmpFilePath);
                            if (tmpStats.size === 0) {
                                throw new Error('Il file temporaneo è vuoto');
                            }
                            console.log('Callback - File temporaneo verificato, dimensione:', tmpStats.size, 'bytes');

                            // Se il file esiste già, lo eliminiamo
                            if (fs.existsSync(fullFilePath)) {
                                fs.unlinkSync(fullFilePath);
                                console.log('Callback - File esistente eliminato:', fullFilePath);
                            }

                            // Rinomina il file temporaneo
                            fs.renameSync(tmpFilePath, fullFilePath);
                            console.log('Callback - File temporaneo rinominato in:', fullFilePath);
                            // Imposta i permessi del file a 0666 (lettura/scrittura per tutti)
                            fs.chmodSync(fullFilePath, 0o666);
                            // Imposta il proprietario del file a node:node (uid:gid del container)
                            try {
                                const nodeUser = process.getuid();
                                const nodeGroup = process.getgid();
                                fs.chownSync(fullFilePath, nodeUser, nodeGroup);
                                // Verifica che il file esista e abbia una dimensione > 0
                                const stats = fs.statSync(fullFilePath);
                                if (stats.size === 0) {
                                    throw new Error('Il file salvato è vuoto');
                                }
                                console.log('Callback - File salvato con successo, dimensione:', stats.size, 'bytes');
                                console.log('Callback - Permessi:', stats.mode.toString(8));
                                console.log('Callback - Proprietario:', stats.uid, ':', stats.gid);
                            } catch (chownErr) {
                                console.warn('Callback - Impossibile impostare il proprietario del file:', chownErr.message);
                            }
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    });
                });

                // Imposta un timeout di 30 secondi per il download
                request.setTimeout(30000, () => {
                    request.destroy();
                    fileStream.close();
                    fs.unlink(tmpFilePath, () => {});
                    reject(new Error('Timeout durante il download del file'));
                });

                request.on('error', (err) => {
                    console.error('Callback - Errore durante il download:', err.message);
                    fileStream.close();
                    fs.unlink(tmpFilePath, () => {});
                    reject(err);
                });

                fileStream.on('error', (err) => {
                    fileStream.close();
                    fs.unlink(tmpFilePath, () => {});
                    reject(err);
                });
            });

            res.json({ error: 0 });
        } catch (err) {
            console.error('Callback - Errore durante il salvataggio:', err.message);
            return res.status(500).send('Errore durante il salvataggio del documento');
        }
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
