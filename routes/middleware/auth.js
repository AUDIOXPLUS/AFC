// Middleware di autenticazione migliorato
function checkAuthentication(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        if (req.path.startsWith('/')) {
            res.status(401).json({ error: 'Utente non autenticato' });
        } else {
            res.redirect('/login.html');
        }
    }
}

module.exports = checkAuthentication;
