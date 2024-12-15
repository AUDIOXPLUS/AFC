// Step 3: Minimize changes and adapt app.js to the original structure

console.log('Applicazione di gestione aziendale avviata');

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session setup
app.use(
  session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
  })
);

// Serve static files
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Placeholder for other routes and logic (adapted to the original)
// Front-end logic has been moved to login.html

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
