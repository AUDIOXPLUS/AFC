const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Percorsi
const DB_PATH = path.join(__dirname, 'AFC.db');
const BACKUP_PATH = path.join(__dirname, 'backups/daily/AFC.db.backup-2025-02-04T22-05-27-544Z');
const TEST_DB_PATH = path.join(__dirname, 'test-restore.db');

// Funzione per contare le righe in una tabella
function getTableCount(db, tableName) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
            if (err) {
                if (err.message.includes('no such table')) {
                    resolve({ table: tableName, count: 0 });
                } else {
                    reject(err);
                }
            } else {
                resolve({ table: tableName, count: row.count });
            }
        });
    });
}

// Funzione per ottenere l'elenco delle tabelle
function getTables(db) {
    return new Promise((resolve, reject) => {
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
            if (err) reject(err);
            else resolve(tables.map(t => t.name));
        });
    });
}

async function compareDatabase(originalPath, backupPath) {
    console.log('Confronto database originale con backup...\n');
    
    const original = new sqlite3.Database(originalPath);
    const backup = new sqlite3.Database(backupPath);
    
    try {
        // Ottieni l'elenco delle tabelle
        const tables = await getTables(original);
        
        console.log('Tabelle trovate:', tables);
        console.log('\nConteggio righe per tabella:');
        
        // Confronta il numero di righe per ogni tabella
        for (const table of tables) {
            const [originalCount, backupCount] = await Promise.all([
                getTableCount(original, table),
                getTableCount(backup, table)
            ]);
            
            console.log(`\nTabella: ${table}`);
            console.log(`- Database originale: ${originalCount.count} righe`);
            console.log(`- Database backup: ${backupCount.count} righe`);
            
            if (originalCount.count !== backupCount.count) {
                console.log('⚠️ ATTENZIONE: Numero di righe diverso!');
            } else {
                console.log('✓ OK: Stesso numero di righe');
            }
        }
        
    } catch (error) {
        console.error('Errore durante il confronto:', error);
    } finally {
        original.close();
        backup.close();
    }
}

// Esegui il confronto
compareDatabase(DB_PATH, BACKUP_PATH);
