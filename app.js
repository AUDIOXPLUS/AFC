console.log('Applicazione di gestione aziendale avviata');

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const routes = require('./routes');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// Usa il percorso assoluto per il database
const dbPath = path.join(__dirname, 'database', 'AFC.db');
console.log('Percorso database:', dbPath);

// Inizializza il database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Errore di connessione al database:', err);
        console.error('Dettagli errore:', err.message);
        process.exit(1);
    } else {
        console.log('Connessione al database riuscita');
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

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
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

// Aggiunge le rotte con prefisso
app.use('/api', routes);

// Serve file statici
app.use(express.static(path.join(__dirname)));

// Gestione graceful shutdown
process.on('SIGTERM', () => {
    console.log('Ricevuto segnale SIGTERM, chiusura in corso...');
    db.close((err) => {
        if (err) {
            console.error('Errore durante la chiusura del database:', err);
        } else {
            console.log('Database chiuso correttamente');
        }
        process.exit(0);
    });
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
