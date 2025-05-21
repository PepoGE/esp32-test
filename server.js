const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'tu_usuario',
    password: 'tu_password',
    database: 'nombre_db'
});

db.connect();

// Recibir datos del ESP32
app.post('/sensor-data', (req, res) => {
    const data = req.body;
    const query = 'INSERT INTO registros SET ?';
    db.query(query, data, (err, result) => {
        if (err) return res.status(500).send(err);
        res.send('Dato guardado');
    });
});

app.get('/sensor-data', (req, res) => {
    db.query('SELECT * FROM registros ORDER BY fecha DESC LIMIT 20', (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

app.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000'));
