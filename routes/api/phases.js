const express = require('express');
const router = express.Router();
const checkAuthentication = require('../middleware/auth');

// Endpoint per ottenere le fasi
router.get('/', checkAuthentication, (req, res) => {
    const query = 'SELECT * FROM phases ORDER BY order_num';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero delle fasi:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere una nuova fase
router.post('/', checkAuthentication, (req, res) => {
    const { name, description, order_num } = req.body;
    const query = `INSERT INTO phases (name, description, order_num) VALUES (?, ?, ?)`;
    req.db.run(query, [name, description, order_num], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento della fase:', err);
            return res.status(500).send('Errore del server');
        }
        res.status(201).json({ 
            id: this.lastID,
            name,
            description,
            order_num
        });
    });
});

// Endpoint per aggiornare una fase
router.put('/:id', checkAuthentication, (req, res) => {
    const { name, description, order_num } = req.body;
    const phaseId = req.params.id;
    const query = `UPDATE phases SET name = ?, description = ?, order_num = ? WHERE id = ?`;
    req.db.run(query, [name, description, order_num, phaseId], function(err) {
        if (err) {
            console.error('Errore nell\'aggiornamento della fase:', err);
            return res.status(500).send('Errore del server');
        }
        if (this.changes === 0) {
            return res.status(404).send('Fase non trovata');
        }
        res.status(200).json({
            id: phaseId,
            name,
            description,
            order_num
        });
    });
});

// Endpoint per eliminare una fase
router.delete('/:id', checkAuthentication, (req, res) => {
    const phaseId = req.params.id;
    const query = `DELETE FROM phases WHERE id = ?`;
    req.db.run(query, [phaseId], function(err) {
        if (err) {
            console.error('Errore nell\'eliminazione della fase:', err);
            return res.status(500).send('Errore del server');
        }
        if (this.changes === 0) {
            return res.status(404).send('Fase non trovata');
        }
        res.status(200).send('Fase eliminata con successo');
    });
});

module.exports = router;
