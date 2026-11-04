const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Define la ruta donde se guardará el archivo local de SQLite
const dbPath = path.join(__dirname, 'natho_db.sqlite');

// Inicializa la conexión (crea el archivo automáticamente si no existe)
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos SQLite:', err.message);
  } else {
    console.log('Conectado exitosamente a la base de datos local SQLite.');
  }
});

// Crear la tabla inicial para almacenar lecciones o traducciones adaptadas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS lecciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT,
      contenido_espanol TEXT,
      contenido_otomi TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (!err) {
      console.log('Tabla "lecciones" verificada o creada correctamente.');
    }
  });
});

db.serialize(() => {
  // Tabla para el diccionario de adaptación (Español <-> Otomí de Temoaya)
  db.run(`
    CREATE TABLE IF NOT EXISTS diccionario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      palabra_espanol TEXT UNIQUE,
      palabra_otomi TEXT,
      contexto_local TEXT
    )
  `);
});




module.exports = db;