#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Percorso del database SQLite locale
const localDbPath = path.join(__dirname, 'database', 'AFC.db'); // Aggiornato al nome corretto
// Percorso del file SQL di output
const outputSqlPath = path.join(__dirname, 'import_translations.sql');

// Verifica se il database locale esiste
if (!fs.existsSync(localDbPath)) {
  console.error(`Errore: Il database locale non è stato trovato in ${localDbPath}`);
  process.exit(1);
}

// Connessione al database locale (in sola lettura)
const db = new sqlite3.Database(localDbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Errore durante la connessione al database locale:', err.message);
    process.exit(1);
  }
  console.log('Connesso al database locale:', localDbPath);
});

// Funzione per eseguire l'escape degli apici singoli per SQL
function escapeSqlString(value) {
  if (value === null || typeof value === 'undefined') {
    return 'NULL';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  // Sostituisce ogni apice singolo con due apici singoli
  return `'${String(value).replace(/'/g, "''")}'`;
}

// Ottiene le informazioni sulle colonne della tabella translations
db.all('PRAGMA table_info(translations)', [], (err, columns) => {
  if (err) {
    console.error('Errore durante il recupero delle informazioni sulla tabella translations:', err.message);
    db.close();
    process.exit(1);
  }

  if (columns.length === 0) {
    console.error('Errore: La tabella "translations" non è stata trovata o è vuota nel database locale.');
    db.close();
    process.exit(1);
  }

  // Estrae i nomi delle colonne
  const columnNames = columns.map(col => col.name);
  const columnNamesString = columnNames.join(', ');

  console.log(`Trovate colonne nella tabella translations: ${columnNamesString}`);

  // Legge tutti i dati dalla tabella translations
  db.all(`SELECT * FROM translations`, [], (err, rows) => {
    if (err) {
      console.error('Errore durante la lettura dei dati dalla tabella translations:', err.message);
      db.close();
      process.exit(1);
    }

    console.log(`Trovate ${rows.length} righe nella tabella translations locale.`);

    // Apre un flusso di scrittura per il file SQL di output
    const writer = fs.createWriteStream(outputSqlPath);

    // Scrive l'intestazione del file SQL
    writer.write(`-- File SQL per importare i dati nella tabella translations\n`);
    writer.write(`-- Generato il: ${new Date().toISOString()}\n`);
    writer.write(`-- Database di origine: ${localDbPath}\n`);
    writer.write(`-- Righe totali da importare: ${rows.length}\n\n`);

    // Inizia una transazione per migliorare le prestazioni dell'import
    writer.write('BEGIN TRANSACTION;\n\n');

    // Opzionale: Svuota la tabella remota prima dell'import.
    // Se si desidera abilitare questa opzione, rimuovere il commento dalla riga seguente.
    writer.write('-- DELETE FROM translations;\n\n');

    // Scrive le istruzioni INSERT per ogni riga
    rows.forEach((row, index) => {
      // Mappa i valori della riga nell'ordine corretto delle colonne, applicando l'escape
      const values = columnNames.map(colName => escapeSqlString(row[colName]));
      const valuesString = values.join(', ');
      writer.write(`INSERT INTO translations (${columnNamesString}) VALUES (${valuesString});\n`);

      // Log di progresso (opzionale, utile per tabelle grandi)
      // if ((index + 1) % 100 === 0) {
      //   console.log(`Generata istruzione INSERT per la riga ${index + 1}...`);
      // }
    });

    // Conclude la transazione
    writer.write('\nCOMMIT;\n');

    // Chiude il flusso di scrittura
    writer.end(() => {
      console.log(`File SQL generato con successo: ${outputSqlPath}`);
      // Chiude la connessione al database locale
      db.close((err) => {
        if (err) {
          console.error('Errore durante la chiusura del database locale:', err.message);
        } else {
          console.log('Connessione al database locale chiusa.');
        }
      });
    });

    writer.on('error', (err) => {
      console.error('Errore durante la scrittura del file SQL:', err.message);
      db.close();
      process.exit(1);
    });
  });
});
