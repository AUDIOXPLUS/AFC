-- Aggiungi la colonna properties alla tabella crud per memorizzare le proprietà specifiche di ogni azione
ALTER TABLE crud ADD COLUMN properties TEXT DEFAULT NULL;

-- Aggiorna i record esistenti per l'azione Read aggiungendo il livello di visualizzazione di default
UPDATE crud 
SET properties = '{"level": "all"}' 
WHERE action = 'Read';
