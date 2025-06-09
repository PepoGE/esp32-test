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

        await pool.query(`
            CREATE TABLE IF NOT EXISTS eventos_ventiladores (
                id SERIAL PRIMARY KEY,
                ventilador1 BOOLEAN,
                ventilador2 BOOLEAN,
                ventilador3 BOOLEAN,
                temperatura NUMERIC(5,2),
                evento_descripcion TEXT,
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

// Recibir eventos de ventiladores del ESP32
app.post('/fan-events', (req, res) => {
    const { ventilador1, ventilador2, ventilador3, temperatura, evento_descripcion } = req.body;

    const query = `INSERT INTO eventos_ventiladores (ventilador1, ventilador2, ventilador3, temperatura, evento_descripcion) 
                   VALUES ($1, $2, $3, $4, $5)`;

    pool.query(query, [ventilador1, ventilador2, ventilador3, temperatura, evento_descripcion])
        .then(() => res.send('Evento de ventilador guardado'))
        .catch(err => res.status(500).send(err));
});

app.get('/fan-events', (req, res) => {
    pool.query('SELECT * FROM eventos_ventiladores ORDER BY fecha_hora DESC LIMIT 50')
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).send(err));
});

app.listen(process.env.PORT || 3000, () =>
    console.log(`Servidor corriendo en http://localhost:${process.env.PORT || 3000}`));
