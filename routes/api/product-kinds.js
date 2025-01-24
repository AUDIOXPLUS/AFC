const express = require('express');
const router = express.Router();
const { checkAuthentication } = require('./auth');

// Endpoint per ottenere i product kinds
router.get('/', checkAuthentication, (req, res) => {
    const query = 'SELECT * FROM product_kinds ORDER BY order_num';
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero dei product kinds:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

// Endpoint per aggiungere un nuovo product kind
router.post('/', checkAuthentication, (req, res) => {
    const { name, description, order_num } = req.body;
    const query = `INSERT INTO product_kinds (name, description, order_num) VALUES (?, ?, ?)`;
    req.db.run(query, [name, description, order_num], function(err) {
        if (err) {
            console.error('Errore nell\'inserimento del product kind:', err);
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

// Endpoint per aggiornare un product kind
router.put('/:id', checkAuthentication, (req, res) => {
    const { name, description, order_num } = req.body;
    const productKindId = req.params.id;
    const query = `UPDATE product_kinds SET name = ?, description = ?, order_num = ? WHERE id = ?`;
    req.db.run(query, [name, description, order_num, productKindId], function(err) {
        if (err) {
            console.error('Errore nell\'aggiornamento del product kind:', err);
            return res.status(500).json({ error: 'Errore del server' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Product kind non trovato' });
        }

        // Dopo l'aggiornamento, recupera il record aggiornato
        req.db.get('SELECT * FROM product_kinds WHERE id = ?', [productKindId], (err, row) => {
            if (err) {
                console.error('Errore nel recupero del product kind aggiornato:', err);
                return res.status(500).json({ error: 'Errore del server' });
            }
            if (!row) {
                return res.status(404).json({ error: 'Product kind non trovato' });
            }
            res.status(200).json(row);
        });
    });
});

// Endpoint per eliminare un product kind
router.delete('/:id', checkAuthentication, (req, res) => {
    const productKindId = req.params.id;
    
    // Ottieni l'ordine del product kind da eliminare
    req.db.get('SELECT order_num FROM product_kinds WHERE id = ?', [productKindId], (err, row) => {
        if (err) {
            console.error('Errore nel recupero del product kind:', err);
            return res.status(500).send('Errore del server');
        }
        if (!row) {
            return res.status(404).send('Product kind non trovato');
        }

        const deletedOrder = row.order_num;

        // Inizia una transazione
        req.db.serialize(() => {
            req.db.run('BEGIN TRANSACTION');

            // Elimina il product kind
            req.db.run('DELETE FROM product_kinds WHERE id = ?', [productKindId], function(err) {
                if (err) {
                    console.error('Errore nell\'eliminazione del product kind:', err);
                    req.db.run('ROLLBACK');
                    return res.status(500).send('Errore del server');
                }

                // Aggiorna gli ordini dei product kinds rimanenti
                req.db.run(
                    'UPDATE product_kinds SET order_num = order_num - 1 WHERE order_num > ?',
                    [deletedOrder],
                    function(err) {
                        if (err) {
                            console.error('Errore nell\'aggiornamento degli ordini:', err);
                            req.db.run('ROLLBACK');
                            return res.status(500).send('Errore del server');
                        }

                        // Commit della transazione
                        req.db.run('COMMIT', (err) => {
                            if (err) {
                                console.error('Errore nel commit della transazione:', err);
                                req.db.run('ROLLBACK');
                                return res.status(500).send('Errore del server');
                            }
                            res.status(200).send('Product kind eliminato con successo');
                        });
                    }
                );
            });
        });
    });
});

module.exports = router;
