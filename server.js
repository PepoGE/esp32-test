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
    port: process.env.DB_PORT // PostgreSQL default port
});

// Initialize database table
const initializeDatabase = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS registros (
                id SERIAL PRIMARY KEY,
                temperatura NUMERIC(5,2),
                humedad NUMERIC(5,2),
                fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

// Add proper error handling for database connection
pool.connect()
    .then(() => {
        console.log('Connected to PostgreSQL database');
        return initializeDatabase();
    })
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
    // Change 'fecha' to 'fecha_hora' to match the table schema
    pool.query('SELECT * FROM registros ORDER BY fecha_hora DESC LIMIT 20')
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).send(err));
});

// Promedio de temperatura por horas (últimas 24 horas)
app.get('/temperature-hourly', (req, res) => {
    const query = `
        SELECT 
            DATE_TRUNC('hour', fecha_hora) as hora,
            ROUND(AVG(temperatura), 2) as promedio_temperatura,
            COUNT(*) as total_registros
        FROM registros 
        WHERE fecha_hora >= NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', fecha_hora)
        ORDER BY hora DESC
    `;

    pool.query(query)
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).send(err));
});

// Promedio de temperatura por días (últimos 30 días)
app.get('/temperature-daily', (req, res) => {
    const query = `
        SELECT 
            DATE_TRUNC('day', fecha_hora) as dia,
            ROUND(AVG(temperatura), 2) as promedio_temperatura,
            ROUND(MIN(temperatura), 2) as temperatura_minima,
            ROUND(MAX(temperatura), 2) as temperatura_maxima,
            COUNT(*) as total_registros
        FROM registros 
        WHERE fecha_hora >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', fecha_hora)
        ORDER BY dia DESC
    `;

    pool.query(query)
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).send(err));
});

app.listen(process.env.PORT || 3000, () =>
    console.log(`Servidor corriendo en http://localhost:${process.env.PORT || 3000}`));
