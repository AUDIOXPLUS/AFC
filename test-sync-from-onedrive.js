/**
 * Script temporaneo per testare la sincronizzazione da OneDrive
 */
const { exec } = require('child_process');
const path = require('path');

// Percorso assoluto per la directory di backup
const backupDir = '/opt/afc-v3/database/backups';

/**
 * Esegue un comando shell
 * @param {string} command - Comando da eseguire
 * @returns {Promise<string>} - Output del comando
 */
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('Errore durante l\'esecuzione del comando:', error);
                reject(error);
                return;
            }
            
            if (stderr) {
                console.error('Warning durante l\'esecuzione:', stderr);
            }
            
            resolve(stdout);
        });
    });
}

/**
 * Esegue un comando rclone
 * @param {string} command - Comando rclone da eseguire
 * @returns {Promise<void>}
 */
async function executeRcloneCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 100 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error('Errore durante l\'esecuzione del comando:', error);
                reject(error);
                return;
            }
            
            if (stderr) {
                console.error('Warning durante l\'esecuzione:', stderr);
            }
            
            resolve(stdout);
        });
    });
}

/**
 * Esegue un comando rclone e gestisce gli errori di directory non trovata
 * @param {string} command - Comando rclone da eseguire
 * @param {string} description - Descrizione dell'operazione
 * @returns {Promise<boolean>} - true se l'operazione è riuscita, false se la directory non è stata trovata
 */
async function executeRcloneCommandSafe(command, description) {
    try {
        await executeRcloneCommand(command);
        console.log(`✓ ${description} completata con successo`);
        return true;
    } catch (error) {
        if (error.message && error.message.includes('directory not found')) {
            console.log(`⚠️ ${description} saltata: directory non trovata su OneDrive`);
            return false;
        }
        throw error;
    }
}

/**
 * Sincronizza i backup da OneDrive alle directory locali
 * @returns {Promise<void>}
 */
async function syncFromOneDrive() {
    try {
        console.log('Avvio sincronizzazione da OneDrive...');

        // Sincronizza i backup del database da OneDrive alle directory locali
        // Utilizziamo rclone copy invece di rclone sync per non eliminare i file locali
        console.log('Sincronizzazione backup database da OneDrive...');
        
        let successCount = 0;
        let errorCount = 0;
        
        // Sincronizza i backup giornalieri
        console.log('Sincronizzazione backup giornalieri...');
        if (await executeRcloneCommandSafe(
            `rclone copy "afc-backup:AFC_Backups/database/daily" "${backupDir}/daily" --stats-one-line`,
            'Sincronizzazione backup giornalieri'
        )) {
            successCount++;
        } else {
            errorCount++;
        }
        
        // Sincronizza i backup settimanali
        console.log('Sincronizzazione backup settimanali...');
        if (await executeRcloneCommandSafe(
            `rclone copy "afc-backup:AFC_Backups/database/weekly" "${backupDir}/weekly" --stats-one-line`,
            'Sincronizzazione backup settimanali'
        )) {
            successCount++;
        } else {
            errorCount++;
        }
        
        // Sincronizza i backup mensili
        console.log('Sincronizzazione backup mensili...');
        if (await executeRcloneCommandSafe(
            `rclone copy "afc-backup:AFC_Backups/database/monthly" "${backupDir}/monthly" --stats-one-line`,
            'Sincronizzazione backup mensili'
        )) {
            successCount++;
        } else {
            errorCount++;
        }
        
        // Sincronizza i backup annuali
        console.log('Sincronizzazione backup annuali...');
        if (await executeRcloneCommandSafe(
            `rclone copy "afc-backup:AFC_Backups/database/yearly" "${backupDir}/yearly" --stats-one-line`,
            'Sincronizzazione backup annuali'
        )) {
            successCount++;
        } else {
            errorCount++;
        }
        
        console.log('Sincronizzazione da OneDrive completata con successo');
        
        // Correggi i permessi dei file scaricati
        console.log('Correzione permessi dei file...');
        await executeCommand(`sudo chmod -R 755 "${backupDir}"`);
        
        console.log('Permessi corretti con successo');
    } catch (error) {
        console.error('Errore durante la sincronizzazione da OneDrive:', error);
        throw error;
    }
}

// Esegui la sincronizzazione
syncFromOneDrive()
    .then(() => {
        console.log('Test di sincronizzazione completato con successo');
    })
    .catch(error => {
        console.error('Errore durante il test di sincronizzazione:', error);
    });
