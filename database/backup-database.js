const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const dns = require('dns').promises;

// Costanti per i percorsi
const DB_PATH = path.join(__dirname, 'AFC.db');
const BACKUP_DIR = path.join(__dirname, 'backups');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const BACKUP_TYPES = ['daily', 'weekly', 'monthly', 'yearly'];

// Assicurati che le directory esistano
[BACKUP_DIR, ...BACKUP_TYPES.map(type => path.join(BACKUP_DIR, type))].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});
// Nuova funzione per configurare esplicitamente le directory di backup
function setupBackupDirectories() {
    [BACKUP_DIR, ...BACKUP_TYPES.map(type => path.join(BACKUP_DIR, type))].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Directory created: ${dir}`);
        }
    });
}

/**
 * Verifica se il sistema si trova in Cina
 * @returns {Promise<boolean>}
 */
async function isInChina() {
    try {
        // Prova a risolvere google.com (bloccato in Cina) e baidu.com (accessibile in Cina)
        const [googleResults, baiduResults] = await Promise.all([
            dns.resolve('google.com').catch(() => null),
            dns.resolve('baidu.com').catch(() => null)
        ]);

        // Se google.com non è accessibile ma baidu.com lo è, probabilmente siamo in Cina
        return !googleResults && baiduResults;
    } catch (error) {
        console.error('Errore nel rilevamento della regione:', error);
        // In caso di errore, assumiamo di essere nella regione globale
        return false;
    }
}

/**
 * Esegue il backup del database
 * @param {string} type - Tipo di backup ('daily', 'weekly', 'monthly', 'yearly')
 * @returns {Promise<string>} - Percorso del file di backup creato
 */
async function backupDatabase(type = 'daily') {
    return new Promise((resolve, reject) => {
        // Crea il nome del file di backup con timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(
            BACKUP_DIR,
            type,
            `AFC.db.backup-${timestamp}`
        );

        // Log dell'operazione
        console.log(`[${timestamp}] Avvio backup ${type} del database...`);

        // Apri il database
        const db = new sqlite3.Database(DB_PATH);

        // Esegui il backup
        db.serialize(() => {
            db.run('VACUUM INTO ?', backupPath, (err) => {
                db.close();
                
                if (err) {
                    console.error(`[${timestamp}] Errore durante il backup:`, err);
                    reject(err);
                    return;
                }

                console.log(`[${timestamp}] Backup locale completato con successo in: ${backupPath}`);
                resolve(backupPath);
            });
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
 * Sincronizza i backup su OneDrive
 * @returns {Promise<void>}
 */
async function syncToOneDrive() {
    try {
        // Verifica la regione
        const inChina = await isInChina();
        console.log(`Rilevata regione: ${inChina ? 'Cina' : 'Globale'}`);

        console.log('Avvio sincronizzazione con OneDrive...');

        // Sincronizza i backup del database
        console.log('Sincronizzazione backup database...');
        await executeRcloneCommand(`rclone sync "${BACKUP_DIR}" "afc-backup:AFC_Backups/database" --stats-one-line`);
        
        // Sincronizza i file caricati
        console.log('Sincronizzazione files...');
        await executeRcloneCommand(`rclone sync "${UPLOADS_DIR}" "afc-backup:AFC_Backups/uploads" --stats-one-line --exclude ".DS_Store"`);
        
        console.log('Sincronizzazione completata con successo');
    } catch (error) {
        console.error('Errore durante la sincronizzazione:', error);
        throw error;
    }
}

/**
 * Rimuove i backup più vecchi
 * @param {string} type - Tipo di backup
 * @param {number} keep - Numero di file da mantenere
 */
function cleanOldBackups(type, keep) {
    const typeDir = path.join(BACKUP_DIR, type);
    
    // Se la directory non esiste, non fare nulla
    if (!fs.existsSync(typeDir)) return;

    const files = fs.readdirSync(typeDir)
        .filter(file => file.startsWith('AFC.db.backup-'))
        .map(file => ({
            name: file,
            path: path.join(typeDir, file),
            time: fs.statSync(path.join(typeDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    // Rimuovi i file più vecchi
    files.slice(keep).forEach(file => {
        try {
            fs.unlinkSync(file.path);
            console.log(`Rimosso backup vecchio: ${file.name}`);
        } catch (err) {
            console.error(`Errore nella rimozione di ${file.name}:`, err);
        }
    });

    // Log del numero di backup mantenuti
    console.log(`Mantenuti ${Math.min(files.length, keep)} backup ${type}`);
}

/**
 * Esegue il processo completo di backup
 */
async function runBackup() {
    try {
        const now = new Date();
        console.log(`\n=== Avvio backup ${now.toISOString()} ===\n`);

        // Determina il tipo di backup in base al giorno
        const isYearly = now.getMonth() === 0 && now.getDate() === 1;
        const isMonthly = now.getDate() === 1;
        const isWeekly = now.getDay() === 0; // Domenica

        // Esegui i backup necessari
        if (isYearly) {
            await backupDatabase('yearly');
            cleanOldBackups('yearly', 5); // Mantieni ultimi 5 backup annuali
        }
        if (isMonthly) {
            await backupDatabase('monthly');
            cleanOldBackups('monthly', 12); // Mantieni ultimi 12 backup mensili
        }
        if (isWeekly) {
            await backupDatabase('weekly');
            cleanOldBackups('weekly', 4); // Mantieni ultimi 4 backup settimanali
        }

        // Esegui sempre il backup giornaliero
        await backupDatabase('daily');
        cleanOldBackups('daily', 7); // Mantieni ultimi 7 backup giornalieri

        // Sincronizza con OneDrive
        await syncToOneDrive();

        console.log(`\n=== Backup completato con successo ${now.toISOString()} ===\n`);
    } catch (error) {
        console.error('Errore durante il processo di backup:', error);
        process.exit(1);
    }
}

function performInstantBackup() {
    backupDatabase('daily')
        .then((backupPath) => {
            console.log(`Backup istantaneo completato in: ${backupPath}`);
        })
        .catch((err) => {
            console.error("Errore durante il backup istantaneo:", err);
        });
}

function checkAndConsolidate() {
    // Implementa qui la logica per controllare e consolidare i backup se necessario.
    console.log("checkAndConsolidate: nessuna azione richiesta al momento");
}

// Se eseguito direttamente, avvia il backup
if (require.main === module) {
    runBackup();
}

// Esporta anche la funzione setupBackupDirectories
module.exports = {
    backupDatabase,
    syncToOneDrive,
    cleanOldBackups,
    runBackup,
    isInChina,
    setupBackupDirectories,
    checkAndConsolidate
};
