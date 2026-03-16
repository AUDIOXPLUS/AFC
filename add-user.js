#!/usr/bin/env node
/**
 * Script per aggiungere utenti al database AFC
 * Uso: node add-user.js <username> <password> <name> [role] [factory]
 */

const Database = require('better-sqlite3');
const path = require('path');

// Parametri da riga di comando
const [,, username, password, name, role = 'user', factory = 'AFC Factory'] = process.argv;

if (!username || !password || !name) {
    console.error('❌ Uso: node add-user.js <username> <password> <name> [role] [factory]');
    console.error('\nEsempio:');
    console.error('  node add-user.js admin MySecurePass123 "Admin User" admin "AFC Factory"');
    console.error('  node add-user.js john pass123 "John Doe" user "AFC Factory"');
    process.exit(1);
}

// Connessione al database
const dbPath = path.join(__dirname, 'database', 'AFC.db');
const db = new Database(dbPath);

try {
    // Verifica se l'utente esiste già
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

    if (existing) {
        console.error(`❌ Utente '${username}' esiste già (ID: ${existing.id})`);
        process.exit(1);
    }

    // Inserisci nuovo utente
    const insert = db.prepare(`
        INSERT INTO users (username, password, name, role, factory)
        VALUES (?, ?, ?, ?, ?)
    `);

    const result = insert.run(username, password, name, role, factory);

    console.log('✅ Utente creato con successo!');
    console.log('─────────────────────────────');
    console.log(`ID:       ${result.lastInsertRowid}`);
    console.log(`Username: ${username}`);
    console.log(`Name:     ${name}`);
    console.log(`Role:     ${role}`);
    console.log(`Factory:  ${factory}`);
    console.log('─────────────────────────────');

    // Mostra tutti gli utenti
    const users = db.prepare('SELECT id, username, name, role FROM users ORDER BY id').all();
    console.log('\n📋 Utenti totali nel database:', users.length);
    users.forEach(u => {
        console.log(`  [${u.id}] ${u.username.padEnd(15)} - ${u.name} (${u.role || 'user'})`);
    });

} catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
} finally {
    db.close();
}
