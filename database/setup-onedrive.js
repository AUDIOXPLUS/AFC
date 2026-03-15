#!/usr/bin/env node

/**
 * Script di configurazione per il backup su OneDrive
 * Guida l'utente attraverso il processo di setup e ottiene il refresh token
 */

const http = require('http');
const open = require('open');
const url = require('url');

console.log(`
=== Configurazione Backup OneDrive ===

Prima di procedere, è necessario:

1. Accedere al portale Azure (https://portal.azure.com)
2. Registrare una nuova applicazione:
   - Vai su "Azure Active Directory" -> "Registrazioni app" -> "Nuova registrazione"
   - Nome: "AFC Backup"
   - Tipo di account supportato: "Account solo in questa directory organizzativa"
   - URI di reindirizzamento: http://localhost:3000/auth/callback
   
3. Dopo la registrazione:
   - Copia l'ID applicazione (client)
   - Vai su "Certificati e segreti" -> "Nuovo segreto client"
   - Copia il valore del segreto appena creato
   
4. Configura le autorizzazioni:
   - Vai su "Autorizzazioni API"
   - Aggiungi "Microsoft Graph"
   - Seleziona:
     * Files.ReadWrite
     * Files.ReadWrite.All
     * offline_access
   - Clicca "Concedi consenso amministratore"

Premi CTRL+C per uscire dallo script e seguire questi passaggi.
Una volta completati, esegui nuovamente lo script con:

node setup-onedrive.js <client_id> <client_secret>
`);

// Se non vengono forniti i parametri, termina qui
if (process.argv.length < 4) {
    process.exit(0);
}

const clientId = process.argv[2];
const clientSecret = process.argv[3];

// URL di autorizzazione
const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=http://localhost:3000/auth/callback` +
    `&scope=offline_access Files.ReadWrite Files.ReadWrite.All`;

// Server locale per gestire il callback
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/auth/callback') {
        const code = parsedUrl.query.code;
        
        if (!code) {
            res.writeHead(400);
            res.end('Codice di autorizzazione mancante');
            return;
        }

        try {
            // Scambia il codice con il token
            const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code: code,
                    redirect_uri: 'http://localhost:3000/auth/callback',
                    grant_type: 'authorization_code'
                })
            });

            const data = await tokenResponse.json();

            if (data.refresh_token) {
                console.log('\nConfigurazione completata con successo!');
                console.log('\nUtilizza questi valori nel tuo file di configurazione:');
                console.log('\nclientId:', clientId);
                console.log('clientSecret:', clientSecret);
                console.log('tenantId:', data.tenant_id || 'common');
                console.log('refreshToken:', data.refresh_token);
                
                res.writeHead(200);
                res.end('Configurazione completata! Puoi chiudere questa finestra.');
            } else {
                throw new Error('Refresh token non ricevuto');
            }
        } catch (error) {
            console.error('Errore durante lo scambio del token:', error);
            res.writeHead(500);
            res.end('Errore durante la configurazione');
        }

        // Chiudi il server
        server.close();
    }
});

// Avvia il server locale
server.listen(3000, () => {
    console.log('\nAvvio del processo di autorizzazione...');
    open(authUrl);
});
