/**
 * Configurazione per il backup su OneDrive
 * IMPORTANTE: Non committare questo file nel repository
 */

module.exports = {
    // Credenziali dell'applicazione Azure
    clientId: 'IL_TUO_CLIENT_ID',
    clientSecret: 'IL_TUO_CLIENT_SECRET',
    tenantId: 'IL_TUO_TENANT_ID',
    refreshToken: 'IL_TUO_REFRESH_TOKEN',
    
    // Configurazione backup
    backupSchedule: '0 */4 * * *',  // Ogni 4 ore
    retentionDays: 30  // Mantieni i backup per 30 giorni
};
