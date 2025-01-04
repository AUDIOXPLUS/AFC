-- Ricrea la tabella projects con la sintassi corretta
DROP TABLE IF EXISTS projects;
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    client TEXT,
    factory TEXT,
    modelNumber TEXT,
    factoryModelNumber TEXT,
    productKind TEXT,
    startDate TEXT,
    endDate TEXT,
    status TEXT,
    brand TEXT,
    range TEXT,
    line TEXT,
    priority INTEGER DEFAULT NULL
);

-- Ricrea la tabella users con la sintassi corretta
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    name TEXT,
    role TEXT,
    email TEXT,
    color TEXT
);

-- Ricrea la tabella privileges con la sintassi corretta
DROP TABLE IF EXISTS privileges;
CREATE TABLE privileges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    action TEXT NOT NULL
);

-- Ricrea la tabella user_privileges con la sintassi corretta
DROP TABLE IF EXISTS user_privileges;
CREATE TABLE user_privileges (
    user_id INTEGER,
    privilege_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(privilege_id) REFERENCES privileges(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, privilege_id)
);

-- Ricrea la tabella project_history con la sintassi corretta
DROP TABLE IF EXISTS project_history;
CREATE TABLE project_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    date TEXT,
    phase TEXT,
    description TEXT,
    assigned_to TEXT,
    status TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Ricrea la tabella project_files con la sintassi corretta
DROP TABLE IF EXISTS project_files;
CREATE TABLE project_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    history_id INTEGER,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    uploaded_by INTEGER,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    locked_by INTEGER DEFAULT NULL,
    lock_date DATETIME DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (history_id) REFERENCES project_history(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Ricrea la tabella phases con la sintassi corretta
DROP TABLE IF EXISTS phases;
CREATE TABLE phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    order_num INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
