/**
 * File di esempio per la configurazione del backup su OneDrive
 * Rinominare questo file in onedrive-config.js e inserire le proprie credenziali
 */

module.exports = {
    // Credenziali dell'applicazione Azure (ottenute tramite setup-onedrive.js)
    clientId: 'IL_TUO_CLIENT_ID',
    clientSecret: 'IL_TUO_CLIENT_SECRET',
    tenantId: 'IL_TUO_TENANT_ID',
    refreshToken: 'IL_TUO_REFRESH_TOKEN',
    
    // Configurazione backup
    backupSchedule: '0 */4 * * *',  // Ogni 4 ore (formato cron)
    retentionDays: 30               // Mantieni i backup per 30 giorni
};
