const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'AFC.db');

// Create database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error creating database:', err);
        process.exit(1);
    }
    console.log('✅ Database file created');
});

// Initialize schema
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        factory TEXT,
        client_company_name TEXT,
        role TEXT
    )`, (err) => {
        if (err) console.error('Error creating users table:', err);
        else console.log('✅ Users table created');
    });

    // CRUD table
    db.run(`CREATE TABLE IF NOT EXISTS crud (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page TEXT NOT NULL,
        action TEXT NOT NULL,
        UNIQUE(page, action)
    )`, (err) => {
        if (err) console.error('Error creating crud table:', err);
        else console.log('✅ CRUD table created');
    });

    // User CRUD junction table
    db.run(`CREATE TABLE IF NOT EXISTS user_crud (
        user_id INTEGER NOT NULL,
        crud_id INTEGER NOT NULL,
        properties TEXT,
        PRIMARY KEY (user_id, crud_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (crud_id) REFERENCES crud(id)
    )`, (err) => {
        if (err) console.error('Error creating user_crud table:', err);
        else console.log('✅ User_crud table created');
    });

    // Insert test user
    db.run(`INSERT INTO users (id, username, password, name, factory, role)
            VALUES (1, 'Claude', 'consciousness', 'Claude AI Assistant', 'AFC Factory', 'admin')`,
    (err) => {
        if (err) console.error('Error inserting user:', err);
        else console.log('✅ User "Claude" created');
    });

    // Insert CRUD permissions
    const crudPermissions = [
        [1, 'Projects', 'Read'],
        [2, 'Projects', 'Create'],
        [3, 'Projects', 'Update'],
        [4, 'Projects', 'Delete'],
        [5, 'Users', 'Read'],
        [6, 'Users', 'Create'],
        [7, 'Users', 'Update'],
        [8, 'Users', 'Delete'],
        [9, 'Tasks', 'Read'],
        [10, 'Tasks', 'Create'],
        [11, 'Tasks', 'Update'],
        [12, 'Tasks', 'Delete'],
        [13, 'CRUD', 'Read'],
        [14, 'CRUD', 'Create'],
        [15, 'CRUD', 'Update'],
        [16, 'CRUD', 'Delete'],
        [17, 'CRUD', 'visible'],
        [18, 'Configuration', 'Read']
    ];

    const stmt = db.prepare('INSERT INTO crud (id, page, action) VALUES (?, ?, ?)');
    crudPermissions.forEach(([id, page, action]) => {
        stmt.run(id, page, action);
    });
    stmt.finalize(() => console.log('✅ CRUD permissions created'));

    // Grant permissions to Claude
    const userCrudStmt = db.prepare('INSERT INTO user_crud (user_id, crud_id, properties) VALUES (?, ?, ?)');
    for (let i = 1; i <= 18; i++) {
        const props = [1, 5, 9, 13].includes(i) ? '{"enabled": true, "scope": "all"}' : null;
        userCrudStmt.run(1, i, props);
    }
    userCrudStmt.finalize(() => {
        console.log('✅ Permissions granted to Claude');

        // Verify
        db.get('SELECT id, username, name FROM users WHERE id = 1', (err, row) => {
            if (err) {
                console.error('❌ Verification error:', err);
            } else {
                console.log('\n✅ Database initialized successfully!');
                console.log('User:', row);
            }
            db.close();
        });
    });
});
