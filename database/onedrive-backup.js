#!/usr/bin/env node

/**
 * Sistema di backup su OneDrive per il database AFC
 * Gestisce backup automatici e retention policy
 */

const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');

// Configurazione
const config = {
    // Directory contenente il database
    dbDir: path.join(__dirname),
    // Nome del file database
    dbName: 'AFC.db',
    // Cartella su OneDrive per i backup
    backupFolderName: 'AFC_Backups',
    // Numero di giorni di retention per i backup
    retentionDays: 30
};

class OnedriveBackupManager {
    constructor(clientId, clientSecret, tenantId, refreshToken) {
        this.credentials = {
            clientId,
            clientSecret,
            tenantId,
            refreshToken
        };
        
        // Inizializzazione del client Microsoft Graph
        this.client = Client.init({
            authProvider: async (done) => {
                try {
                    const accessToken = await this.getAccessToken();
                    done(null, accessToken);
                } catch (error) {
                    done(error, null);
                }
            }
        });
    }

    /**
     * Ottiene un nuovo access token usando il refresh token
     */
    async getAccessToken() {
        try {
            const response = await fetch(`https://login.microsoftonline.com/${this.credentials.tenantId}/oauth2/v2.0/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: this.credentials.clientId,
                    client_secret: this.credentials.clientSecret,
                    refresh_token: this.credentials.refreshToken,
                    grant_type: 'refresh_token',
                    scope: 'https://graph.microsoft.com/.default'
                })
            });

            if (!response.ok) {
                throw new Error('Errore nel refresh del token');
            }

            const data = await response.json();
            return data.access_token;
        } catch (error) {
            console.error('Errore durante il refresh del token:', error);
            throw error;
        }
    }

    /**
     * Trova o crea la cartella di backup su OneDrive
     */
    async getBackupFolder() {
        try {
            // Cerca la cartella
            const searchResponse = await this.client.api('/me/drive/root/children')
                .filter(`name eq '${config.backupFolderName}'`)
                .get();

            if (searchResponse.value.length > 0) {
                console.log('Cartella backup trovata su OneDrive');
                return searchResponse.value[0];
            }

            // Se non esiste, crea la cartella
            const folder = await this.client.api('/me/drive/root/children')
                .post({
                    name: config.backupFolderName,
                    folder: {}
                });

            console.log('Creata nuova cartella backup su OneDrive');
            return folder;
        } catch (error) {
            console.error('Errore durante la ricerca/creazione della cartella:', error);
            throw error;
        }
    }

    /**
     * Esegue il backup del database su OneDrive
     */
    async performBackup() {
        try {
            const dbPath = path.join(config.dbDir, config.dbName);
            if (!fs.existsSync(dbPath)) {
                throw new Error(`Database non trovato: ${dbPath}`);
            }

            // Ottieni la cartella di backup
            const backupFolder = await this.getBackupFolder();
            
            // Crea il nome del file di backup con timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `AFC.db.backup-${timestamp}`;

            // Carica il file su OneDrive
            const fileContent = fs.readFileSync(dbPath);
            await this.client.api(`/me/drive/items/${backupFolder.id}:/${backupFileName}:/content`)
                .put(fileContent);

            console.log('Backup completato con successo:', backupFileName);

            // Gestisci la retention policy
            await this.applyRetentionPolicy(backupFolder.id);

            return true;
        } catch (error) {
            console.error('Errore durante il backup:', error);
            return false;
        }
    }

    /**
     * Applica la retention policy eliminando i backup più vecchi
     */
    async applyRetentionPolicy(folderId) {
        try {
            const retentionDate = new Date();
            retentionDate.setDate(retentionDate.getDate() - config.retentionDays);

            // Ottieni tutti i file nella cartella di backup
            const files = await this.client.api(`/me/drive/items/${folderId}/children`)
                .get();

            // Filtra ed elimina i file più vecchi della retention date
            for (const file of files.value) {
                const fileDate = new Date(file.createdDateTime);
                if (fileDate < retentionDate) {
                    await this.client.api(`/me/drive/items/${file.id}`)
                        .delete();
                    console.log(`File eliminato per retention policy: ${file.name}`);
                }
            }
        } catch (error) {
            console.error('Errore durante l\'applicazione della retention policy:', error);
        }
    }
}

module.exports = OnedriveBackupManager;

// Se eseguito direttamente, mostra un messaggio di aiuto
if (require.main === module) {
    console.log(`
Utilizzo: Questo modulo deve essere importato e configurato con le credenziali appropriate.
Esempio:
    const OnedriveBackupManager = require('./onedrive-backup');
    const manager = new OnedriveBackupManager(clientId, clientSecret, tenantId, refreshToken);
    manager.performBackup();
`);
}
