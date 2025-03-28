console.log('Applicazione di gestione aziendale avviata');

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const routes = require('./routes');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const OnedriveBackupManager = require('./database/onedrive-backup');
const onedriveConfig = require('./database/onedrive-config');

const app = express();
const PORT = 3000;

// Inizializza il backup manager
let backupManager = null;
try {
    backupManager = new OnedriveBackupManager(
        onedriveConfig.clientId,
        onedriveConfig.clientSecret,
        onedriveConfig.tenantId,
        onedriveConfig.refreshToken
    );
    console.log('Manager di backup OneDrive inizializzato');
} catch (error) {
    console.error('Errore nell\'inizializzazione del backup manager:', error);
}

// Configura il cron job per i backup automatici
const { exec } = require('child_process');
const setupBackupCronPath = path.join(__dirname, 'database', 'setup-backup-cron.js');

console.log('Configurazione del cron job per i backup automatici...');
exec(`node ${setupBackupCronPath}`, (error, stdout, stderr) => {
    if (error) {
        console.error('Errore durante la configurazione del cron job:', error);
    } else {
        console.log('Output della configurazione del cron job:');
        console.log(stdout);
        if (stderr) {
            console.error('Warning durante la configurazione:', stderr);
        }
        console.log('Cron job per i backup automatici configurato con successo');
    }
});

// Usa il percorso assoluto per il database
const dbPath = path.join(__dirname, 'database', 'AFC.db');
console.log('Percorso database:', dbPath);

// Inizializza il database con supporto UTF-8
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Errore di connessione al database:', err);
        console.error('Dettagli errore:', err.message);
        process.exit(1);
    } else {
        console.log('Connessione al database riuscita');
        // Imposta encoding UTF-8
        db.run('PRAGMA encoding = "UTF-8";', (err) => {
            if (err) {
                console.error('Errore nell\'impostare encoding UTF-8:', err);
            } else {
                console.log('Encoding UTF-8 impostato correttamente');
            }
        });
        // Aggiunto test di connessione
        db.get('SELECT 1;', (err, row) => {
            if (err) {
                console.error('Errore nel test di connessione:', err);
            } else {
                console.log('Test di connessione riuscito:', row);
            }
        });
    }
});

// Middleware con supporto UTF-8
app.use(bodyParser.json({ extended: true, charset: 'utf-8' }));
app.use(bodyParser.urlencoded({ extended: true, charset: 'utf-8' }));
app.use(express.json({ charset: 'utf-8' }));

// Imposta l'encoding per tutte le risposte
app.use((req, res, next) => {
    res.charset = 'utf-8';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    next();
});
app.use(session({
    secret: process.env.JWT_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set to true if using https
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 ore
    }
}));

// Log delle sessioni per debug
app.use((req, res, next) => {
    console.log('Session Debug:', {
        sessionID: req.sessionID,
        hasSession: !!req.session,
        user: req.session?.user
    });
    next();
});

// Passa il database alle rotte
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Importa il middleware di autenticazione
const checkAuthentication = require('./routes/middleware/auth');

// Aggiunge le rotte con prefisso
app.use('/api', routes);

// Serve il file di login e cambio password senza autenticazione
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/change-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'change-password.html'));
});

app.get('/change-password.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'change-password.js'));
});

// Proteggi tutti gli altri file statici con l'autenticazione
app.use(checkAuthentication);
app.use(express.static(path.join(__dirname)));

// Gestione graceful shutdown
process.on('SIGTERM', () => {
    console.log('Ricevuto segnale SIGTERM, chiusura in corso...');
    
    // Esegui un backup finale prima della chiusura
    if (backupManager) {
        console.log('Esecuzione backup finale...');
        backupManager.performBackup()
            .then(() => {
                console.log('Backup finale completato');
                db.close((err) => {
                    if (err) {
                        console.error('Errore durante la chiusura del database:', err);
                    } else {
                        console.log('Database chiuso correttamente');
                    }
                    process.exit(0);
                });
            })
            .catch(error => {
                console.error('Errore durante il backup finale:', error);
                db.close((err) => {
                    if (err) {
                        console.error('Errore durante la chiusura del database:', err);
                    } else {
                        console.log('Database chiuso correttamente');
                    }
                    process.exit(1);
                });
            });
    } else {
        db.close((err) => {
            if (err) {
                console.error('Errore durante la chiusura del database:', err);
            } else {
                console.log('Database chiuso correttamente');
            }
            process.exit(0);
        });
    }
});

process.on('SIGINT', () => {
    console.log('Ricevuto segnale SIGINT, chiusura in corso...');
    db.close((err) => {
        if (err) {
            console.error('Errore durante la chiusura del database:', err);
        } else {
            console.log('Database chiuso correttamente');
        }
        process.exit(0);
    });
});

// Avvio del server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server in esecuzione su http://0.0.0.0:${PORT}`);
});
