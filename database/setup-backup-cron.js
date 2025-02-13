const { exec } = require('child_process');
const path = require('path');

// Percorso assoluto allo script di backup
const backupScript = path.join(__dirname, 'backup-database.js');

// Comando per aggiungere il cron job
// Esegue il backup ogni giorno alle 00:00
const command = `(crontab -l 2>/dev/null; echo "0 0 * * * /usr/bin/node ${backupScript} >> /var/log/afc-backup.log 2>&1") | crontab -`;

console.log('Configurazione del backup automatico...');
console.log('Il backup verrà eseguito ogni giorno a mezzanotte');
console.log('I log verranno salvati in /var/log/afc-backup.log');

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error('Errore durante la configurazione del cron job:', error);
        process.exit(1);
    }
    
    if (stderr) {
        console.error('Warning durante la configurazione:', stderr);
    }
    
    console.log('Cron job configurato con successo');
    console.log('Per verificare i cron job configurati, esegui: crontab -l');
    console.log('Per visualizzare i log del backup: tail -f /var/log/afc-backup.log');
});
