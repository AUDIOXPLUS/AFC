const express = require('express');
const router = express.Router();
const { checkAuthentication } = require('./auth');

// Endpoint per ottenere tutte le attività
router.get('/', checkAuthentication, (req, res) => {
    const query = `
        SELECT 
            ph.id, 
            ph.project_id AS projectId, 
            p.factory,
            p.modelNumber, 
            ph.date, 
            ph.description, 
            ph.assigned_to AS assignedTo, 
            ph.status,
            ph.is_new
        FROM 
            project_history ph
        JOIN 
            projects p ON ph.project_id = p.id
    `;
    req.db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero delle attività:', err);
            return res.status(500).send('Errore del server');
        }
        res.json(rows);
    });
});

module.exports = router;
