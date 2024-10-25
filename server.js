const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const morgan = require('morgan');
const session = require('express-session');
const fs = require('fs-extra');

const app = express();
const routes = require('./routes');

// Inizializzazione del database
const db = new sqlite3.Database('./database/AFC.db', (err) => {
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

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Elenco dei file protetti
const protectedFiles = ['/project-details.html', '/role-selection.html'];

// Middleware per proteggere i file specifici
app.use(function(req, res, next) {
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
    req.db = db;
    next();
});

// Servire file statici
app.use(express.static(path.join(__dirname)));

// Utilizzo delle rotte
app.use('/', routes);

// Avvio del server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);
});
