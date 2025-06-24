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

// Endpoint para insertar datos de prueba
app.post('/populate-sample-data', async (req, res) => {
    try {
        const sampleData = [];

        // Generar datos para los últimos 5 días
        for (let day = 4; day >= 0; day--) {
            for (let hour = 0; hour < 24; hour += 2) { // Cada 2 horas
                for (let minute = 0; minute < 60; minute += 30) { // Cada 30 minutos
                    const fecha = new Date();
                    fecha.setDate(fecha.getDate() - day);
                    fecha.setHours(hour, minute, 0, 0);

                    // Temperatura variable según la hora (más alta en el día, más baja en la noche)
                    const baseTemp = 26.5 + Math.sin((hour - 6) * Math.PI / 12) * 6.5; // Rango base 20-33
                    const randomVariation = (Math.random() - 0.5) * 2; // ±1 grado de variación
                    let temperatura = baseTemp + randomVariation;

                    // Asegurar que esté dentro del rango 19-34
                    temperatura = Math.max(19, Math.min(34, temperatura));
                    temperatura = temperatura.toFixed(2);

                    // Humedad variable (inversamente relacionada con temperatura)
                    const humedad = (70 - (parseFloat(temperatura) - 26.5) * 1.5 + (Math.random() - 0.5) * 10).toFixed(2);

                    sampleData.push([temperatura, humedad, fecha]);
                }
            }
        }

        // Insertar todos los datos
        const insertPromises = sampleData.map(data =>
            pool.query('INSERT INTO registros (temperatura, humedad, fecha_hora) VALUES ($1, $2, $3)', data)
        );

        await Promise.all(insertPromises);

        res.json({
            message: 'Datos de prueba insertados exitosamente',
            count: sampleData.length
        });
    } catch (err) {
        console.error('Error inserting sample data:', err);
        res.status(500).json({ error: 'Error al insertar datos de prueba' });
    }
});

app.listen(process.env.PORT || 3000, () =>
    console.log(`Servidor corriendo en http://localhost:${process.env.PORT || 3000}`));
