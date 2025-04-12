const express = require('express');
const router = express.Router();
const checkAuthentication = require('../middleware/auth');

// Endpoint per ottenere tutte le traduzioni
router.get('/', checkAuthentication, (req, res) => {
    const query = 'SELECT id, english_text, chinese_text FROM translations ORDER BY english_text';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero delle traduzioni:', err);
            return res.status(500).json({ error: 'Errore del server nel recupero delle traduzioni' });
        }
        // Trasforma l'array di oggetti in un oggetto chiave-valore per facilitare l'uso nel frontend
        const translationsMap = rows.reduce((acc, row) => {
            acc[row.english_text] = row.chinese_text || row.english_text; // Usa il testo inglese come fallback se la traduzione manca
            return acc;
        }, {});
        res.json(translationsMap); // Restituisce la mappa delle traduzioni
    });
});

// Endpoint per ottenere le traduzioni in formato tabella per la pagina di configurazione
router.get('/table', checkAuthentication, (req, res) => {
    const query = 'SELECT id, english_text, chinese_text FROM translations ORDER BY english_text';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero delle traduzioni per la tabella:', err);
            return res.status(500).json({ error: 'Errore del server nel recupero delle traduzioni' });
        }
        res.json(rows); // Restituisce l'array di oggetti per la tabella
    });
});


// Endpoint per aggiungere una nuova traduzione
router.post('/', checkAuthentication, (req, res) => {
    const { english_text, chinese_text } = req.body;

    if (!english_text) {
        return res.status(400).json({ error: 'Il testo in inglese è obbligatorio' });
    }

    const query = 'INSERT INTO translations (english_text, chinese_text) VALUES (?, ?)';
    req.db.run(query, [english_text, chinese_text], function(err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') { // Gestisce l'errore di univocità
                 return res.status(409).json({ error: `La traduzione per "${english_text}" esiste già.` });
            }
            console.error('Errore nell\'inserimento della traduzione:', err);
            return res.status(500).json({ error: 'Errore del server nell\'inserimento della traduzione' });
        }
        res.status(201).json({ id: this.lastID, english_text, chinese_text });
    });
});

// Endpoint per modificare una traduzione esistente
router.put('/:id', checkAuthentication, (req, res) => {
    const { id } = req.params;
    const { english_text, chinese_text } = req.body;

    if (!english_text) {
        return res.status(400).json({ error: 'Il testo in inglese è obbligatorio' });
    }

    const query = 'UPDATE translations SET english_text = ?, chinese_text = ? WHERE id = ?';
    req.db.run(query, [english_text, chinese_text, id], function(err) {
        if (err) {
             if (err.code === 'SQLITE_CONSTRAINT') { // Gestisce l'errore di univocità
                 return res.status(409).json({ error: `Un'altra traduzione con il testo "${english_text}" esiste già.` });
             }
            console.error('Errore nell\'aggiornamento della traduzione:', err);
            return res.status(500).json({ error: 'Errore del server nell\'aggiornamento della traduzione' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Traduzione non trovata' });
        }
        res.json({ id: parseInt(id), english_text, chinese_text });
    });
});

// Endpoint per eliminare una traduzione
router.delete('/:id', checkAuthentication, (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM translations WHERE id = ?';
    req.db.run(query, [id], function(err) {
        if (err) {
            console.error('Errore nell\'eliminazione della traduzione:', err);
            return res.status(500).json({ error: 'Errore del server nell\'eliminazione della traduzione' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Traduzione non trovata' });
        }
        res.status(200).json({ message: 'Traduzione eliminata con successo' });
    });
});

module.exports = router;
