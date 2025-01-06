#!/usr/bin/env node

/**
 * Sistema di backup avanzato per il database AFC
 * Gestisce backup istantanei, temporanei, stabili, settimanali e annuali
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configurazione
const config = {
    // Directory contenente il database
    dbDir: path.join(__dirname),
    // Nome del file database
    dbName: 'AFC.db',
    // Directory dove salvare i backup
    backupDir: path.join(__dirname, 'backups'),
    // Sottodirectory per i diversi tipi di backup
    instantBackupDir: 'instant',
    tempBackupDir: 'temp',
    stableBackupDir: 'stable',
    weeklyBackupDir: 'weekly',
    yearlyBackupDir: 'yearly',
    // Tempo di inattività prima di consolidare i backup istantanei (in millisecondi)
    inactivityThreshold: 60 * 60 * 1000, // 1 ora
    // Numero di giorni prima di creare un backup stabile
    daysForStable: 3,
    // Numero di backup stabili prima di creare un backup settimanale
    stablesForWeekly: 3
};

/**
 * Crea le directory necessarie per i backup
 */
function setupBackupDirectories() {
    const dirs = [
        config.backupDir,
        path.join(config.backupDir, config.instantBackupDir),
        path.join(config.backupDir, config.tempBackupDir),
        path.join(config.backupDir, config.stableBackupDir),
        path.join(config.backupDir, config.weeklyBackupDir),
        path.join(config.backupDir, config.yearlyBackupDir)
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log('Directory creata:', dir);
        }
    });
}

/**
 * Esegue il backup del database
 * @param {string} type - Tipo di backup (instant, temp, stable, weekly, yearly)
 * @returns {string} Path del file di backup creato
 */
function performBackup(type) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(config.backupDir, config[`${type}BackupDir`]);
        const backupFile = path.join(backupDir, `AFC.db.${type}-${timestamp}`);
        const dbPath = path.join(config.dbDir, config.dbName);

        if (!fs.existsSync(dbPath)) {
            throw new Error(`Database non trovato: ${dbPath}`);
        }

        execSync(`sqlite3 ${dbPath} ".backup '${backupFile}'"`);
        console.log(`Backup ${type} completato:`, backupFile);
        
        return backupFile;
    } catch (error) {
        console.error(`Errore durante il backup ${type}:`, error);
        return null;
    }
}

/**
 * Consolida i backup istantanei in un backup temporaneo
 */
function consolidateInstantBackups() {
    const instantDir = path.join(config.backupDir, config.instantBackupDir);
    const files = fs.readdirSync(instantDir);
    
    if (files.length > 0) {
        // Prendi l'ultimo backup istantaneo
        const lastBackup = files.sort().pop();
        const sourcePath = path.join(instantDir, lastBackup);
        
        // Crea un nuovo backup temporaneo
        performBackup('temp');
        
        // Elimina tutti i backup istantanei
        files.forEach(file => {
            fs.unlinkSync(path.join(instantDir, file));
        });
        
        console.log('Backup istantanei consolidati in backup temporaneo');
    }
}

/**
 * Consolida i backup temporanei in un backup stabile
 */
function consolidateTempBackups() {
    const tempDir = path.join(config.backupDir, config.tempBackupDir);
    const files = fs.readdirSync(tempDir);
    
    // Se abbiamo abbastanza backup temporanei (36 = 12 backup al giorno per 3 giorni)
    if (files.length >= 36) {
        // Prendi l'ultimo backup temporaneo
        const lastBackup = files.sort().pop();
        const sourcePath = path.join(tempDir, lastBackup);
        
        // Crea un nuovo backup stabile
        performBackup('stable');
        
        // Elimina tutti i backup temporanei
        files.forEach(file => {
            fs.unlinkSync(path.join(tempDir, file));
        });
        
        console.log('Backup temporanei consolidati in backup stabile');
    }
}

/**
 * Consolida i backup stabili in un backup settimanale
 */
function consolidateStableBackups() {
    const stableDir = path.join(config.backupDir, config.stableBackupDir);
    const files = fs.readdirSync(stableDir);
    
    // Se abbiamo 3 backup stabili
    if (files.length >= 3) {
        // Prendi l'ultimo backup stabile
        const lastBackup = files.sort().pop();
        const sourcePath = path.join(stableDir, lastBackup);
        
        // Crea un nuovo backup settimanale
        performBackup('weekly');
        
        // Elimina tutti i backup stabili
        files.forEach(file => {
            fs.unlinkSync(path.join(stableDir, file));
        });
        
        console.log('Backup stabili consolidati in backup settimanale');
    }
}

/**
 * Gestisce il backup annuale
 */
function handleYearlyBackup() {
    const now = new Date();
    const isLastDayOfYear = now.getMonth() === 11 && now.getDate() === 31;
    
    if (isLastDayOfYear) {
        performBackup('yearly');
        console.log('Backup annuale creato');
    }
}

/**
 * Verifica se c'è stata inattività per il periodo specificato
 */
function checkInactivity() {
    const dbPath = path.join(config.dbDir, config.dbName);
    const stats = fs.statSync(dbPath);
    const now = new Date();
    return (now - stats.mtime) >= config.inactivityThreshold;
}

// Funzioni di esportazione per l'integrazione con il server
module.exports = {
    performInstantBackup: () => performBackup('instant'),
    checkAndConsolidate: () => {
        if (checkInactivity()) {
            consolidateInstantBackups();
            consolidateTempBackups();
            consolidateStableBackups();
            handleYearlyBackup();
        }
    },
    setupBackupDirectories
};

// Se eseguito direttamente, inizializza le directory
if (require.main === module) {
    setupBackupDirectories();
}
