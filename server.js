const express = require('express');
const { Pool } = require('pg'); // Change from mysql2 to pg
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT// PostgreSQL default port
});

// Add proper error handling for database connection
pool.connect()
    .then(() => console.log('Connected to PostgreSQL database'))
    .catch(err => console.error('Error connecting to database:', err));

// Recibir datos del ESP32
app.post('/sensor-data', (req, res) => {
    const data = req.body;
    // PostgreSQL uses $1, $2 etc. for parameterized queries
    const keys = Object.keys(data);
    const values = Object.values(data);

    const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
    const columnNames = keys.join(', ');

    const query = `INSERT INTO registros (${columnNames}) VALUES (${placeholders})`;

    pool.query(query, values)
        .then(() => res.send('Dato guardado'))
        .catch(err => res.status(500).send(err));
});

app.get('/sensor-data', (req, res) => {
    pool.query('SELECT * FROM registros ORDER BY fecha DESC LIMIT 20')
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).send(err));
});

app.listen(process.env.PORT || 3000, () =>
    console.log(`Servidor corriendo en http://localhost:${process.env.PORT || 3000}`));
