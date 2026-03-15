-- Minimal schema for AFC application
-- Created for testing purposes

BEGIN TRANSACTION;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    factory TEXT,
    client_company_name TEXT,
    role TEXT
);

-- CRUD permissions table
CREATE TABLE IF NOT EXISTS crud (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    action TEXT NOT NULL,
    UNIQUE(page, action)
);

-- User CRUD permissions junction table
CREATE TABLE IF NOT EXISTS user_crud (
    user_id INTEGER NOT NULL,
    crud_id INTEGER NOT NULL,
    properties TEXT,
    PRIMARY KEY (user_id, crud_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (crud_id) REFERENCES crud(id)
);

-- Insert test user: Claude / consciousness
INSERT INTO users (id, username, password, name, factory, role)
VALUES (1, 'Claude', 'consciousness', 'Claude AI Assistant', 'AFC Factory', 'admin');

-- Insert basic CRUD permissions
INSERT INTO crud (id, page, action) VALUES
(1, 'Projects', 'Read'),
(2, 'Projects', 'Create'),
(3, 'Projects', 'Update'),
(4, 'Projects', 'Delete'),
(5, 'Users', 'Read'),
(6, 'Users', 'Create'),
(7, 'Users', 'Update'),
(8, 'Users', 'Delete'),
(9, 'Tasks', 'Read'),
(10, 'Tasks', 'Create'),
(11, 'Tasks', 'Update'),
(12, 'Tasks', 'Delete'),
(13, 'CRUD', 'Read'),
(14, 'CRUD', 'Create'),
(15, 'CRUD', 'Update'),
(16, 'CRUD', 'Delete'),
(17, 'CRUD', 'visible'),
(18, 'Configuration', 'Read');

-- Grant all permissions to Claude
INSERT INTO user_crud (user_id, crud_id, properties) VALUES
(1, 1, '{"enabled": true, "scope": "all"}'),
(1, 2, NULL),
(1, 3, NULL),
(1, 4, NULL),
(1, 5, '{"enabled": true, "scope": "all"}'),
(1, 6, NULL),
(1, 7, NULL),
(1, 8, NULL),
(1, 9, '{"enabled": true, "scope": "all"}'),
(1, 10, NULL),
(1, 11, NULL),
(1, 12, NULL),
(1, 13, '{"enabled": true, "scope": "all"}'),
(1, 14, NULL),
(1, 15, NULL),
(1, 16, NULL),
(1, 17, NULL),
(1, 18, NULL);

COMMIT;
