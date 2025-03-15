const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Percorso assoluto allo script di backup
const backupScript = path.join(__dirname, 'backup-database.js');

// Variabile globale per tenere traccia dello stato dei backup
let backupsEnabled = true;

/**
 * Configura i cron job per i backup automatici
 * @param {boolean} enabled - Se true, abilita i backup, altrimenti li disabilita
 */
function setupBackupCron(enabled = true) {
    // Aggiorna la variabile globale
    backupsEnabled = enabled;
    
    if (enabled) {
        // Comando per aggiungere i cron job
        // Esegue il backup ogni giorno alle 00:00, 10:00, 12:00 e 16:00
        const command = `(crontab -l 2>/dev/null | grep -v "${backupScript}"; 
echo "0 0 * * * /usr/bin/node ${backupScript} >> /var/log/afc-backup.log 2>&1"
echo "0 10 * * * /usr/bin/node ${backupScript} >> /var/log/afc-backup.log 2>&1"
echo "0 12 * * * /usr/bin/node ${backupScript} >> /var/log/afc-backup.log 2>&1"
echo "0 16 * * * /usr/bin/node ${backupScript} >> /var/log/afc-backup.log 2>&1"
) | crontab -`;

        console.log('Configurazione del backup automatico...');
        console.log('I backup verranno eseguiti ogni giorno alle 00:00, 10:00, 12:00 e 16:00');
        console.log('I log verranno salvati in /var/log/afc-backup.log');

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Errore durante la configurazione dei cron job:', error);
                return;
            }
            
            if (stderr) {
                console.error('Warning durante la configurazione:', stderr);
            }
            
            console.log('Cron job configurati con successo');
            console.log('Per verificare i cron job configurati, esegui: crontab -l');
            console.log('Per visualizzare i log del backup: tail -f /var/log/afc-backup.log');
        });
    } else {
        // Comando per rimuovere i cron job di backup
        const command = `(crontab -l 2>/dev/null | grep -v "${backupScript}") | crontab -`;

        console.log('Disabilitazione del backup automatico...');

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Errore durante la rimozione dei cron job:', error);
                return;
            }
            
            if (stderr) {
                console.error('Warning durante la rimozione:', stderr);
            }
            
            console.log('Cron job di backup rimossi con successo');
        });
    }
}

/**
 * Restituisce lo stato attuale dei backup
 * @returns {boolean} - true se i backup sono abilitati, false altrimenti
 */
function getBackupStatus() {
    return backupsEnabled;
}

/**
 * Imposta lo stato dei backup
 * @param {boolean} enabled - Se true, abilita i backup, altrimenti li disabilita
 * @returns {boolean} - Il nuovo stato dei backup
 */
function setBackupStatus(enabled) {
    setupBackupCron(enabled);
    return enabled;
}

// Esegui la configurazione iniziale
setupBackupCron();

module.exports = {
    setupBackupCron,
    getBackupStatus,
    setBackupStatus
};
