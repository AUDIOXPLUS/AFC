const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const dns = require('dns').promises;
const os = require('os'); // Aggiungiamo il modulo os per ottenere l'indirizzo IP

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
 * Ottiene l'indirizzo IP pubblico del server
 * @returns {Promise<string>} - Indirizzo IP pubblico del server
 */
async function getPublicIP() {
    try {
        // Prova a ottenere l'IP pubblico da un servizio esterno
        const response = await new Promise((resolve, reject) => {
            const req = require('http').get('http://ifconfig.me/ip', (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Status code: ${res.statusCode}`));
                    return;
                }
                
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve(data.trim());
                });
            });
            
            req.on('error', (err) => {
                reject(err);
            });
            
            // Imposta un timeout di 5 secondi
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
        });
        
        return response;
    } catch (error) {
        console.error('Errore nel recupero dell\'IP pubblico:', error.message);
        return null;
    }
}

/**
 * Ottiene l'indirizzo IP del server
 * @returns {string} - Indirizzo IP del server
 */
function getServerIP() {
    // Prova a ottenere l'IP pubblico in modo sincrono (usando un file cache)
    const cacheFile = path.join(__dirname, '.public-ip-cache');
    
    try {
        // Verifica se esiste un file cache con l'IP pubblico
        if (fs.existsSync(cacheFile)) {
            const stats = fs.statSync(cacheFile);
            const fileAge = Date.now() - stats.mtime.getTime();
            
            // Se il file è stato modificato nelle ultime 24 ore, usa l'IP memorizzato
            if (fileAge < 24 * 60 * 60 * 1000) {
                const cachedIP = fs.readFileSync(cacheFile, 'utf8').trim();
                if (cachedIP && cachedIP.match(/^\d+\.\d+\.\d+\.\d+$/)) {
                    console.log('Usando IP pubblico dalla cache:', cachedIP);
                    return cachedIP;
                }
            }
        }
    } catch (error) {
        console.error('Errore nella lettura del file cache dell\'IP pubblico:', error.message);
    }
    
    // Se non è stato possibile ottenere l'IP pubblico dalla cache, usa l'IP locale
    // e avvia un processo asincrono per aggiornare la cache
    const interfaces = os.networkInterfaces();
    let serverIP = 'unknown-ip';
    
    // Cerca un indirizzo IPv4 non interno
    for (const iface of Object.values(interfaces)) {
        for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
                serverIP = alias.address;
                
                // Avvia un processo asincrono per aggiornare la cache con l'IP pubblico
                getPublicIP().then(publicIP => {
                    if (publicIP) {
                        try {
                            fs.writeFileSync(cacheFile, publicIP);
                            console.log('IP pubblico salvato nella cache:', publicIP);
                        } catch (error) {
                            console.error('Errore nel salvataggio dell\'IP pubblico nella cache:', error.message);
                        }
                    }
                });
                
                return serverIP;
            }
        }
    }
    
    // Se non trova un indirizzo IPv4 non interno, prova a trovare qualsiasi indirizzo IPv4
    for (const iface of Object.values(interfaces)) {
        for (const alias of iface) {
            if (alias.family === 'IPv4') {
                serverIP = alias.address;
                return serverIP;
            }
        }
    }
    
    return serverIP;
}

/**
 * Esegue il backup del database
 * @param {string} type - Tipo di backup ('daily', 'weekly', 'monthly', 'yearly')
 * @returns {Promise<string>} - Percorso del file di backup creato
 */
async function backupDatabase(type = 'daily') {
    return new Promise((resolve, reject) => {
        // Ottieni l'indirizzo IP del server
        const serverIP = getServerIP();
        
        // Crea il nome del file di backup con timestamp e indirizzo IP del server
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(
            BACKUP_DIR,
            type,
            `AFC.db.backup-${serverIP}-${timestamp}`
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
 * Sincronizza i backup su OneDrive utilizzando rclone
 * @returns {Promise<{success: boolean, error?: string}>} - Oggetto che indica se la sincronizzazione è riuscita e, in caso contrario, il motivo del fallimento
 */
async function syncToOneDrive() {
    try {
        // Verifica se rclone è disponibile
        const rcloneAvailable = await isRcloneAvailable();
        
        // Se rclone non è disponibile, restituisci un errore
        if (!rcloneAvailable) {
            console.warn('rclone non è disponibile o non è configurato correttamente. La sincronizzazione con OneDrive è disabilitata.');
            
            // Verifica se lo script shell esiste
            const scriptPath = path.join(__dirname, 'sync-to-onedrive.sh');
            if (!fs.existsSync(scriptPath)) {
                console.error(`Lo script shell ${scriptPath} non esiste.`);
                return { 
                    success: false, 
                    error: 'rclone is not available and the sync script was not found. The backup was created successfully on the server but was not synchronized with OneDrive.' 
                };
            }
            
            return { 
                success: false, 
                error: 'rclone is not available or not properly configured. The backup was created successfully on the server but was not synchronized with OneDrive.' 
            };
        }
        
        // Verifica la regione
        const inChina = await isInChina();
        console.log(`Rilevata regione: ${inChina ? 'Cina' : 'Globale'}`);

        console.log('Avvio sincronizzazione con OneDrive...');
        
        // Sincronizza i backup del database per ogni tipo
        console.log('Sincronizzazione backup database...');
        
        for (const type of BACKUP_TYPES) {
            const typeDir = path.join(BACKUP_DIR, type);
            
            // Se la directory non esiste, salta
            if (!fs.existsSync(typeDir)) continue;
            
            // Ottieni la lista dei file locali
            const localFiles = fs.readdirSync(typeDir)
                .filter(file => file.startsWith('AFC.db.backup-'));
                
            if (localFiles.length === 0) {
                console.log(`Nessun file di backup ${type} da sincronizzare`);
                continue;
            }
            
            console.log(`Sincronizzazione di ${localFiles.length} file di backup ${type}...`);
            
            // Per ogni file locale, assicurati che sia su OneDrive
            for (const fileName of localFiles) {
                const filePath = path.join(typeDir, fileName);
                const copyCommand = `rclone copy "${filePath}" "afc-backup:AFC_Backups/database/${type}" --stats-one-line`;
                try {
                    await executeCommand(copyCommand);
                } catch (error) {
                    console.error(`Errore durante la sincronizzazione del file ${fileName}:`, error.message);
                    // Continua con il prossimo file
                }
            }
            
            console.log(`Sincronizzazione backup ${type} completata`);
        }
        
        // Sincronizza i file caricati
        console.log('Sincronizzazione files...');
        try {
            const filesSyncCommand = `rclone sync "${UPLOADS_DIR}" "afc-backup:AFC_Backups/uploads" --stats-one-line --exclude ".DS_Store"`;
            console.log(`Comando: ${filesSyncCommand}`);
            
            const filesSyncOutput = await executeCommand(filesSyncCommand);
            console.log('Output sincronizzazione files:', filesSyncOutput);
        } catch (error) {
            console.error('Errore durante la sincronizzazione dei files:', error.message);
            // Continua con la verifica
        }
        
        // Verifica che i file siano stati sincronizzati
        console.log('Verifica sincronizzazione...');
        try {
            const verifyOutput = await executeCommand(`rclone ls "afc-backup:AFC_Backups/database/daily"`);
            console.log('File su OneDrive dopo la sincronizzazione:', verifyOutput);
        } catch (error) {
            console.error('Errore durante la verifica della sincronizzazione:', error.message);
            // Continua comunque
        }
        
        console.log('Sincronizzazione completata con successo');
        return { success: true };
    } catch (error) {
        console.error('Errore durante la sincronizzazione:', error);
        return { 
            success: false, 
            error: `Error during synchronization with OneDrive: ${error.message}. The backup was created successfully on the server but was not synchronized with OneDrive.` 
        };
    }
}

/**
 * Esegue un comando rclone e gestisce gli errori comuni
 * @param {string} command - Comando rclone da eseguire
 * @param {string} description - Descrizione dell'operazione
 * @returns {Promise<boolean>} - true se l'operazione è riuscita, false se ci sono stati errori gestiti
 */
async function executeRcloneCommandSafe(command, description) {
    try {
        await executeRcloneCommand(command);
        console.log(`✓ ${description} completata con successo`);
        return true;
    } catch (error) {
        // Gestione degli errori comuni di rclone
        if (error.message) {
            if (error.message.includes('directory not found')) {
                console.log(`⚠️ ${description} saltata: directory non trovata su OneDrive`);
                return false;
            } else if (error.message.includes('connection reset by peer')) {
                console.log(`⚠️ ${description} fallita: connessione interrotta. Riprova più tardi.`);
                return false;
            } else if (error.message.includes('network error')) {
                console.log(`⚠️ ${description} fallita: errore di rete. Verifica la connessione internet.`);
                return false;
            } else if (error.message.includes('permission denied')) {
                console.log(`⚠️ ${description} fallita: permesso negato. Verifica le autorizzazioni di rclone.`);
                return false;
            } else if (error.message.includes('not found')) {
                console.log(`⚠️ ${description} fallita: remote "afc-backup" non trovato. Eseguire "rclone config" per configurarlo.`);
                return false;
            }
        }
        // Se l'errore non è gestito, lo rilancia
        console.error(`❌ ${description} fallita con errore non gestito:`, error);
        throw error;
    }
}

/**
 * Sincronizza i backup da OneDrive alle directory locali
 * @returns {Promise<{successCount: number, errorCount: number}>}
 */
async function syncFromOneDrive() {
    try {
        console.log('\n=== Avvio sincronizzazione da OneDrive ===\n');

        // Utilizziamo il percorso assoluto per evitare problemi con i percorsi relativi
        const backupDir = '/opt/afc-v3/database/backups';
        
        // Verifica che le directory di backup esistano
        setupBackupDirectories();
        
        // Verifica che rclone sia configurato correttamente
        try {
            // Verifica che il remote "afc-backup" esista
            const remotes = await executeCommand(`rclone listremotes`);
            if (!remotes.includes('afc-backup:')) {
                throw new Error('Remote "afc-backup" non trovato');
            }
            console.log('Configurazione rclone verificata');
        } catch (error) {
            console.error('Errore nella verifica della configurazione rclone:', error);
            throw new Error('Configurazione rclone non valida. Eseguire "rclone config" per configurare il remote "afc-backup".');
        }
        
        // Sincronizza i backup del database da OneDrive alle directory locali
        console.log('Sincronizzazione backup database da OneDrive...');
        
        let successCount = 0;
        let errorCount = 0;
        
        // Verifica che la directory principale esista su OneDrive
        try {
            await executeCommand(`rclone lsf "afc-backup:AFC_Backups/database"`);
        } catch (error) {
            console.error('Directory principale dei backup non trovata su OneDrive:', error);
            return { successCount, errorCount: 1 };
        }
        
        // Ottieni la lista dei file su OneDrive per ogni tipo di backup
        const backupTypes = ['daily', 'weekly', 'monthly', 'yearly'];
        const oneDriveFiles = {};
        
        for (const type of backupTypes) {
            try {
                const files = await executeCommand(`rclone lsf "afc-backup:AFC_Backups/database/${type}"`);
                oneDriveFiles[type] = files.split('\n').filter(f => f.trim() !== '');
                console.log(`File di backup ${type} su OneDrive:`, oneDriveFiles[type].length);
            } catch (error) {
                console.warn(`Nessun file di backup ${type} trovato su OneDrive`);
                oneDriveFiles[type] = [];
            }
        }
        
        // Sincronizza i backup per ogni tipo
        for (const type of backupTypes) {
            if (oneDriveFiles[type].length > 0) {
                console.log(`Sincronizzazione backup ${type}...`);
                try {
                    const syncCommand = `rclone copy "afc-backup:AFC_Backups/database/${type}" "${backupDir}/${type}" --stats-one-line`;
                    console.log(`Esecuzione comando: ${syncCommand}`);
                    await executeCommand(syncCommand);
                    console.log(`Sincronizzazione backup ${type} completata con successo`);
                    successCount++;
                } catch (error) {
                    console.error(`Errore durante la sincronizzazione dei backup ${type}:`, error);
                    errorCount++;
                }
            } else {
                console.log(`Nessun backup ${type} da sincronizzare`);
            }
        }
        
        if (successCount > 0) {
            console.log('Sincronizzazione da OneDrive completata con successo');
            
            // Correggi i permessi dei file scaricati
            console.log('Correzione permessi dei file...');
            await executeCommand(`sudo chmod -R 755 "${backupDir}"`);
            
            console.log('Permessi corretti con successo');
            
            // Verifica che i file siano stati sincronizzati correttamente
            for (const type of backupTypes) {
                if (oneDriveFiles[type].length > 0) {
                    try {
                        const localFiles = fs.readdirSync(path.join(backupDir, type))
                            .filter(file => file.startsWith('AFC.db.backup-'));
                        console.log(`File di backup ${type} in locale dopo la sincronizzazione:`, localFiles.length);
                    } catch (error) {
                        console.error(`Errore durante la verifica dei file di backup ${type} in locale:`, error);
                    }
                }
            }
        } else {
            console.log('Nessun backup sincronizzato da OneDrive');
        }
        
        console.log(`\n=== Sincronizzazione da OneDrive completata: ${successCount} operazioni completate, ${errorCount} operazioni saltate ===\n`);
        return { successCount, errorCount };
    } catch (error) {
        console.error('Errore durante la sincronizzazione da OneDrive:', error);
        throw error;
    }
}

/**
 * Verifica se rclone è disponibile e configurato correttamente
 * @returns {Promise<boolean>}
 */
async function isRcloneAvailable() {
    try {
        // Verifica che rclone sia installato
        await executeCommand('which rclone');
        
        // Verifica che rclone sia configurato correttamente
        const remotes = await executeCommand('rclone listremotes');
        if (!remotes.includes('afc-backup:')) {
            console.warn('Remote "afc-backup" non trovato nella configurazione di rclone');
            return false;
        }
        
        return true;
    } catch (error) {
        console.warn('rclone non è disponibile o non è configurato correttamente:', error.message);
        return false;
    }
}

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
 * Rimuove i backup più vecchi sia in locale che su OneDrive
 * @param {string} type - Tipo di backup
 * @param {number} keep - Numero di file da mantenere
 */
async function cleanOldBackups(type, keep) {
    const typeDir = path.join(BACKUP_DIR, type);
    
    // Se la directory non esiste, non fare nulla
    if (!fs.existsSync(typeDir)) return;

    console.log(`Pulizia dei backup ${type} più vecchi, mantenendo i ${keep} più recenti...`);

    // Ottieni la lista dei file locali
    const files = fs.readdirSync(typeDir)
        .filter(file => file.startsWith('AFC.db.backup-'))
        .map(file => ({
            name: file,
            path: path.join(typeDir, file),
            time: fs.statSync(path.join(typeDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    // Rimuovi i file locali più vecchi
    files.slice(keep).forEach(file => {
        try {
            fs.unlinkSync(file.path);
            console.log(`Rimosso backup locale vecchio: ${file.name}`);
        } catch (err) {
            console.error(`Errore nella rimozione di ${file.name}:`, err);
        }
    });

    // Log del numero di backup mantenuti in locale
    console.log(`Mantenuti ${Math.min(files.length, keep)} backup ${type} in locale`);
    
    // Sincronizza con OneDrive per applicare la stessa retention policy
    try {
        // Verifica se rclone è disponibile
        const rcloneAvailable = await isRcloneAvailable();
        if (!rcloneAvailable) {
            console.log('rclone non è disponibile nel container. Utilizzo dello script shell sul sistema host...');
            
            // Ottieni la lista dei file da mantenere
            const filesToKeep = files.slice(0, keep).map(file => file.name);
            
            // Per ogni file locale da mantenere, assicurati che sia su OneDrive
            for (const fileName of filesToKeep) {
                const filePath = path.join(typeDir, fileName);
                try {
                    // Esegui lo script shell sul sistema host
                    const scriptPath = path.join(__dirname, 'sync-to-onedrive.sh');
                    const scriptCommand = `${scriptPath} "${filePath}" "${type}"`;
                    console.log(`Esecuzione script: ${scriptCommand}`);
                    
                    const scriptOutput = await executeCommand(scriptCommand);
                    console.log('Output script:', scriptOutput);
                } catch (error) {
                    console.error(`Errore durante la sincronizzazione del file ${fileName}:`, error.message);
                    // Continua con il prossimo file
                }
            }
            
            console.log(`Retention policy sincronizzata su OneDrive per i backup ${type} (tramite script shell)`);
            return;
        }

        // Se rclone è disponibile nel container, utilizza rclone direttamente
        // Ottieni la lista dei file da mantenere
        const filesToKeep = files.slice(0, keep).map(file => file.name);
        
        // Ottieni la lista dei file su OneDrive
        console.log(`Ottenimento lista dei file su OneDrive per i backup ${type}...`);
        try {
            const oneDriveFilesOutput = await executeCommand(`rclone lsf "afc-backup:AFC_Backups/database/${type}"`);
            const oneDriveFiles = oneDriveFilesOutput.split('\n').filter(f => f.trim() !== '');
            console.log(`File di backup ${type} su OneDrive:`, oneDriveFiles.length);
            
            // Per ogni file locale da mantenere, assicurati che sia su OneDrive
            for (const fileName of filesToKeep) {
                if (!oneDriveFiles.includes(fileName)) {
                    const filePath = path.join(typeDir, fileName);
                    const copyCommand = `rclone copy "${filePath}" "afc-backup:AFC_Backups/database/${type}" --stats-one-line`;
                    console.log(`Sincronizzazione del file ${fileName} su OneDrive...`);
                    try {
                        await executeCommand(copyCommand);
                    } catch (copyError) {
                        console.error(`Errore durante la sincronizzazione del file ${fileName}:`, copyError.message);
                        // Continua con il prossimo file
                    }
                }
            }
            
            console.log(`Retention policy sincronizzata su OneDrive per i backup ${type}`);
        } catch (error) {
            console.error(`Errore durante la sincronizzazione della retention policy su OneDrive per i backup ${type}:`, error.message);
            // Continua comunque
        }
    } catch (error) {
        console.error(`Errore durante la sincronizzazione della retention policy su OneDrive per i backup ${type}:`, error.message);
        // Continua comunque
    }
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

        // Array per tenere traccia dei backup creati
        const createdBackups = [];

        // Esegui i backup necessari
        if (isYearly) {
            const yearlyBackup = await backupDatabase('yearly');
            createdBackups.push({ path: yearlyBackup, type: 'yearly' });
            await cleanOldBackups('yearly', 5); // Mantieni ultimi 5 backup annuali
        }
        if (isMonthly) {
            const monthlyBackup = await backupDatabase('monthly');
            createdBackups.push({ path: monthlyBackup, type: 'monthly' });
            await cleanOldBackups('monthly', 12); // Mantieni ultimi 12 backup mensili
        }
        if (isWeekly) {
            const weeklyBackup = await backupDatabase('weekly');
            createdBackups.push({ path: weeklyBackup, type: 'weekly' });
            await cleanOldBackups('weekly', 4); // Mantieni ultimi 4 backup settimanali
        }

        // Esegui sempre il backup giornaliero
        const dailyBackup = await backupDatabase('daily');
        createdBackups.push({ path: dailyBackup, type: 'daily' });
        await cleanOldBackups('daily', 200); // Mantieni ultimi 200 backup giornalieri

        // Verifica se rclone è disponibile
        const rcloneAvailable = await isRcloneAvailable();
        
        // Sincronizza con OneDrive
        console.log('Sincronizzazione dei backup con OneDrive...');
        
        // Se rclone non è disponibile nel container, utilizza lo script shell sul sistema host
        if (!rcloneAvailable) {
            console.log('rclone non è disponibile nel container. Utilizzo dello script shell sul sistema host...');
            
            // Prima sincronizziamo i file specifici appena creati
            for (const backup of createdBackups) {
                const fileName = path.basename(backup.path);
                try {
                    // Esegui lo script shell sul sistema host
                    const scriptPath = path.join(__dirname, 'sync-to-onedrive.sh');
                    const scriptCommand = `${scriptPath} "${backup.path}" "${backup.type}"`;
                    console.log(`Esecuzione script: ${scriptCommand}`);
                    
                    const scriptOutput = await executeCommand(scriptCommand);
                    console.log('Output script:', scriptOutput);
                } catch (error) {
                    console.error(`Errore durante la sincronizzazione del backup ${fileName}:`, error.message);
                    // Continua con il prossimo backup
                }
            }
            
            console.log(`\n=== Backup completato con successo ${now.toISOString()} (sincronizzato tramite script shell) ===\n`);
            return;
        }
        
        // Se rclone è disponibile nel container, utilizza rclone direttamente
        // Prima sincronizziamo i file specifici appena creati
        for (const backup of createdBackups) {
            const fileName = path.basename(backup.path);
            const specificSyncCommand = `rclone copy "${backup.path}" "afc-backup:AFC_Backups/database/${backup.type}" --stats-one-line`;
            console.log(`Sincronizzazione del backup ${fileName} su OneDrive...`);
            try {
                await executeCommand(specificSyncCommand);
            } catch (error) {
                console.error(`Errore durante la sincronizzazione del backup ${fileName}:`, error.message);
                // Continua con il prossimo backup
            }
        }
        
        // Poi sincronizziamo l'intera directory
        await syncToOneDrive();

        console.log(`\n=== Backup completato con successo ${now.toISOString()} ===\n`);
    } catch (error) {
        console.error('Errore durante il processo di backup:', error);
        // Non usiamo process.exit(1) per evitare di terminare l'applicazione
    }
}

/**
 * Esegue un backup istantaneo e lo sincronizza con OneDrive
 * @returns {Promise<string>} - Percorso del file di backup creato
 */
async function performInstantBackup() {
    try {
        console.log('\n=== Avvio backup istantaneo ===\n');
        
        // Esegui il backup del database
        const backupPath = await backupDatabase('daily');
        console.log(`Backup istantaneo completato in: ${backupPath}`);
        
        // Applica la retention policy per mantenere solo gli ultimi 200 backup giornalieri
        await cleanOldBackups('daily', 200);
        
        // Verifica se rclone è disponibile
        const rcloneAvailable = await isRcloneAvailable();
        
        // Sincronizza con OneDrive
        console.log('Sincronizzazione del backup istantaneo con OneDrive...');
        
        // Se rclone non è disponibile nel container, utilizza lo script shell sul sistema host
        if (!rcloneAvailable) {
            console.log('rclone non è disponibile nel container. Utilizzo dello script shell sul sistema host...');
            
            try {
                // Sincronizziamo il file specifico appena creato
                const fileName = path.basename(backupPath);
                console.log(`Nome del file di backup: ${fileName}`);
                console.log(`Percorso completo del file di backup: ${backupPath}`);
                
                // Verifica che il file esista
                if (!fs.existsSync(backupPath)) {
                    console.error(`ERRORE: Il file di backup ${backupPath} non esiste!`);
                    return backupPath;
                }
                
                // Esegui lo script shell sul sistema host
                const scriptPath = path.join(__dirname, 'sync-to-onedrive.sh');
                const scriptCommand = `${scriptPath} "${backupPath}" "daily"`;
                console.log(`Esecuzione script: ${scriptCommand}`);
                
                const scriptOutput = await executeCommand(scriptCommand);
                console.log('Output script:', scriptOutput);
                
                console.log('\n=== Backup istantaneo completato (sincronizzato tramite script shell) ===\n');
                return backupPath;
            } catch (error) {
                console.error('Errore durante la sincronizzazione con OneDrive tramite script shell:', error.message);
                console.log('\n=== Backup istantaneo completato (senza sincronizzazione con OneDrive) ===\n');
                return backupPath;
            }
        }
        
        // Se rclone è disponibile nel container, utilizza rclone direttamente
        try {
            // Sincronizziamo il file specifico appena creato
            const fileName = path.basename(backupPath);
            console.log(`Nome del file di backup: ${fileName}`);
            console.log(`Percorso completo del file di backup: ${backupPath}`);
            
            // Verifica che il file esista
            if (!fs.existsSync(backupPath)) {
                console.error(`ERRORE: Il file di backup ${backupPath} non esiste!`);
                return backupPath;
            }
            
            // Sincronizza il file con OneDrive
            const specificSyncCommand = `rclone copy "${backupPath}" "afc-backup:AFC_Backups/database/daily" --stats-one-line`;
            console.log(`Sincronizzazione del file specifico: ${fileName}`);
            console.log(`Esecuzione comando: ${specificSyncCommand}`);
            
            try {
                const specificSyncOutput = await executeCommand(specificSyncCommand);
                console.log('Sincronizzazione del file specifico completata. Output:', specificSyncOutput);
                
                // Verifica che il backup sia stato sincronizzato
                const verifyCommand = `rclone ls "afc-backup:AFC_Backups/database/daily"`;
                console.log(`Verifica sincronizzazione. Comando: ${verifyCommand}`);
                const verifyOutput = await executeCommand(verifyCommand);
                console.log('Output verifica:', verifyOutput);
                
                if (verifyOutput.includes(fileName)) {
                    console.log(`Backup ${fileName} sincronizzato correttamente su OneDrive`);
                } else {
                    console.warn(`Backup ${fileName} non trovato su OneDrive dopo la sincronizzazione. Riprovo...`);
                    // Ultimo tentativo di sincronizzazione
                    console.log(`Ultimo tentativo di sincronizzazione. Comando: ${specificSyncCommand}`);
                    const retryOutput = await executeCommand(specificSyncCommand);
                    console.log('Output ultimo tentativo:', retryOutput);
                    
                    // Verifica finale
                    const finalVerifyOutput = await executeCommand(verifyCommand);
                    if (finalVerifyOutput.includes(fileName)) {
                        console.log(`Backup ${fileName} sincronizzato correttamente su OneDrive dopo il secondo tentativo`);
                    } else {
                        console.error(`ERRORE: Backup ${fileName} non sincronizzato su OneDrive dopo due tentativi`);
                    }
                }
            } catch (cmdError) {
                console.error(`ERRORE durante l'esecuzione del comando rclone:`, cmdError);
            }
        } catch (syncError) {
            console.error('Errore durante la sincronizzazione con OneDrive:', syncError);
        }
        
        console.log('\n=== Backup istantaneo completato ===\n');
        return backupPath;
    } catch (err) {
        console.error("Errore durante il backup istantaneo:", err);
        throw err;
    }
}

function checkAndConsolidate() {
    // Implementa qui la logica per controllare e consolidare i backup se necessario.
    console.log("checkAndConsolidate: nessuna azione richiesta al momento");
}

// Se eseguito direttamente, avvia il backup
if (require.main === module) {
    runBackup();
}

// Esporta le funzioni
module.exports = {
    backupDatabase,
    syncToOneDrive,
    syncFromOneDrive,
    cleanOldBackups,
    runBackup,
    isInChina,
    setupBackupDirectories,
    checkAndConsolidate,
    performInstantBackup,
    executeRcloneCommand
};
