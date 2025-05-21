CREATE TABLE
    IF NOT EXISTS registros (
        id SERIAL PRIMARY KEY,
        temperatura NUMERIC(5, 2),
        humedad NUMERIC(5, 2),
        fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );