-- Script per rinominare la colonna created_by_name a parent_id nella tabella project_history

-- Verifica che la tabella project_history esista
PRAGMA table_info(project_history);

-- Crea una tabella temporanea con la nuova struttura
CREATE TABLE project_history_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    date TEXT,
    phase TEXT,
    description TEXT,
    assigned_to TEXT,
    status TEXT,
    is_new INTEGER DEFAULT 1,
    private_by INTEGER REFERENCES user_id,
    created_by INTEGER,
    parent_id TEXT  -- Rinominato da created_by_name a parent_id
);

-- Copia i dati dalla tabella originale alla tabella temporanea
INSERT INTO project_history_temp 
SELECT id, project_id, date, phase, description, assigned_to, status, 
       is_new, private_by, created_by, created_by_name
FROM project_history;

-- Elimina la tabella originale
DROP TABLE project_history;

-- Rinomina la tabella temporanea con il nome originale
ALTER TABLE project_history_temp RENAME TO project_history;

-- Verifica che la modifica sia stata applicata correttamente
PRAGMA table_info(project_history);
