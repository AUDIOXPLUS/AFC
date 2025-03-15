-- Aggiungi i campi created_by e created_by_name alla tabella project_history
ALTER TABLE project_history ADD COLUMN created_by INTEGER;
ALTER TABLE project_history ADD COLUMN created_by_name TEXT;

-- Aggiorna i record esistenti impostando created_by_name a 'Unknown' per i record che non hanno questo campo
UPDATE project_history SET created_by_name = 'Unknown' WHERE created_by_name IS NULL;
