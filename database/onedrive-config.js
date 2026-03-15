/**
 * Configurazione per il backup su OneDrive
 * IMPORTANTE: Non committare questo file nel repository
 * 
 * Nota: Questo file è stato aggiornato per utilizzare esclusivamente rclone per i backup su OneDrive.
 * Le credenziali Azure non sono più necessarie poiché rclone gestisce l'autenticazione separatamente.
 * 
 * Per configurare rclone:
 * 1. Eseguire 'rclone config' da terminale
 * 2. Creare un nuovo remote chiamato 'afc-backup' di tipo 'onedrive'
 * 3. Seguire le istruzioni per l'autenticazione
 * 4. Verificare la configurazione con 'rclone listremotes'
 */

module.exports = {
    // Configurazione backup
    backupSchedule: '0 0 * * *',     // Ogni giorno a mezzanotte
    retentionDays: 30,               // Mantieni i backup per 30 giorni
    
    // Configurazione rclone
    rcloneRemote: 'afc-backup',      // Nome del remote configurato in rclone
    backupFolder: 'AFC_Backups',     // Cartella su OneDrive per i backup
    
    // Opzioni di sincronizzazione
    syncOptions: {
        database: true,              // Sincronizza i backup del database
        uploads: true,               // Sincronizza i file caricati
        excludePatterns: ['.DS_Store', 'Thumbs.db', '*.tmp'] // File da escludere
    }
};
