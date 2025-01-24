-- Disabilita il controllo delle foreign keys
PRAGMA foreign_keys=OFF;

-- Crea la nuova tabella crud
CREATE TABLE crud (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    action TEXT NOT NULL
);

-- Copia i dati dalla vecchia tabella
INSERT INTO crud (id, page, action)
SELECT id, page, action FROM privileges;

-- Aggiorna le foreign keys nella tabella user_privileges
CREATE TABLE user_privileges_new (
    user_id INTEGER,
    privilege_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(privilege_id) REFERENCES crud(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, privilege_id)
);

-- Copia i dati dalla vecchia tabella user_privileges
INSERT INTO user_privileges_new (user_id, privilege_id)
SELECT user_id, privilege_id FROM user_privileges;

-- Elimina la vecchia tabella user_privileges
DROP TABLE user_privileges;

-- Rinomina la nuova tabella user_privileges
ALTER TABLE user_privileges_new RENAME TO user_privileges;

-- Elimina la vecchia tabella privileges
DROP TABLE privileges;

-- Riabilita il controllo delle foreign keys
PRAGMA foreign_keys=ON;
