// Middleware per controllare i permessi CRUD
function checkCrudPermission(req, res, next) {
    console.log('=== CRUD Permission Check Start ===');
    console.log('Request URL:', req.url);
    console.log('Request Method:', req.method);
    console.log('Session:', req.session);
    console.log('User:', req.session?.user);
    
    // Ottieni l'ID dell'utente dalla sessione
    const userId = req.session?.user?.id;
    console.log('UserID:', userId);
    
    if (!userId) {
        console.log('Check CRUD Permission - No UserID found');
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'You must be logged in to access this page.'
        });
    }

    // Verifica se l'utente ha il permesso CRUD (crud_id = 17)
    const query = `
        SELECT uc.properties
        FROM user_crud uc
        WHERE uc.user_id = ? AND uc.crud_id = 17
    `;
    
    console.log('Executing query for user:', userId);
    console.log('Query:', query);
    console.log('Parameters:', [userId]);
    
    req.db.get(query, [userId], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'An error occurred while checking permissions.'
            });
        }
        
        console.log('Query result:', result);
        
        if (result) {
            // L'utente ha il permesso CRUD
            console.log('Access granted');
            console.log('=== CRUD Permission Check End ===');
            next();
        } else {
            // L'utente non ha il permesso CRUD
            console.log('Access denied');
            console.log('=== CRUD Permission Check End ===');
            res.status(403).json({
                error: 'Access Denied',
                message: 'You do not have permission to access this page. Please contact your administrator.'
            });
        }
    });
}

module.exports = checkCrudPermission;
