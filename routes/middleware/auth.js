// Middleware di autenticazione migliorato
function checkAuthentication(req, res, next) {
    if (req.session && req.session.user && req.session.user.id) {
        // Log per debug
        console.log('Sessione utente:', {
            id: req.session.user.id,
            name: req.session.user.name,
            path: req.path
        });
        return next();
    } else {
        console.log('Autenticazione fallita:', {
            session: !!req.session,
            user: !!req.session?.user,
            path: req.path
        });
        
        if (req.path.startsWith('/api/')) {
            res.status(401).json({ error: 'Utente non autenticato' });
        } else {
            res.redirect('/login.html');
        }
    }
}

module.exports = checkAuthentication;
