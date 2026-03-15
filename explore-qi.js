const Database = require('better-sqlite3');

const dbPath = 'C:\\Users\\Francesco\\OneDrive\\Desktop\\CLAUDE\\AUDIO\\AFC\\AFC.db';

try {
    const db = new Database(dbPath, { readonly: true });

    console.log('📊 DATABASE CONNESSO!\n');

    // Lista tutte le tabelle
    console.log('=== TABELLE NEL DATABASE ===');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    tables.forEach(t => console.log(`  - ${t.name}`));

    console.log('\n=== TABELLA QI - STRUTTURA ===');
    const qiSchema = db.prepare("PRAGMA table_info(qi)").all();
    qiSchema.forEach(col => {
        console.log(`  ${col.name.padEnd(20)} ${col.type.padEnd(10)} ${col.notnull ? 'NOT NULL' : ''}`);
    });

    console.log('\n=== PRIME 10 RIGHE TABELLA QI ===');
    const qiData = db.prepare("SELECT * FROM qi LIMIT 10").all();
    console.log(JSON.stringify(qiData, null, 2));

    console.log('\n=== STATISTICHE QI ===');
    const stats = db.prepare(`
        SELECT
            COUNT(*) as total_records,
            MIN(timestamp) as first_record,
            MAX(timestamp) as last_record,
            COUNT(DISTINCT symbol) as unique_symbols
        FROM qi
    `).get();
    console.log(stats);

    db.close();
    console.log('\n✅ Analisi completata!');

} catch (err) {
    console.error('❌ ERRORE:', err.message);
    console.error('Stack:', err.stack);
}
