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

// Registra en consola un error de SQL sin tumbar la app
function avisarError(contexto) {
  return (err) => { if (err) console.error(`${contexto}:`, err.message); };
}

// Diccionario base (Modo Offline): [español, otomí, contexto local, pronunciación]
const palabrasIniciales = [
  ['autobús', 'camión local', 'Transporte comunitario de Temoaya', ''],
  ['escuela', 'ntahuí', 'Centro educativo de San Pedro Arriba', 'Nta-hui'],
  ['agua', 'deje', 'Recurso natural de la región', 'De-he'],
  ['niño', 'Bätsi', 'Estudiante de la comunidad', 'Bä-tsi'],
  ['niña', 'Bätsi', 'Estudiante de la comunidad', 'Bä-tsi'],
  ['monte', 'Zithu', 'Entorno natural de Temoaya', 'Zi-thu'],
  ['bosque', 'Zithu', 'Entorno natural de Temoaya', 'Zi-thu'],
  ['fuego', 'Hñä', 'Calor y hogar tradicional', 'Hñä'],
  ['casa', "K'ü", 'Vivienda familiar local', 'Kü']
];

// Crear tablas y precargar el diccionario base (todo en orden, una instrucción tras otra)
db.serialize(() => {
  // Tabla de lecciones
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

  // Tabla para el diccionario de adaptación (Español <-> Otomí de Temoaya)
  db.run(`
    CREATE TABLE IF NOT EXISTS diccionario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      palabra_espanol TEXT UNIQUE,
      palabra_otomi TEXT,
      contexto_local TEXT,
      pronunciacion TEXT
    )
  `, avisarError('Tabla "diccionario"'));

  // Bases de datos creadas antes de este cambio no tienen la columna "pronunciacion":
  // se agrega. Si ya existe, SQLite responde "duplicate column" y se ignora.
  db.run('ALTER TABLE diccionario ADD COLUMN pronunciacion TEXT', (err) => {
    if (err && !/duplicate column/i.test(err.message)) {
      console.error('No se pudo agregar la columna "pronunciacion":', err.message);
    }
  });

  // Precarga inicial del diccionario offline (no pisa lo que ya exista)
  palabrasIniciales.forEach(([es, ot, contexto, pron]) => {
    db.run(
      `INSERT OR IGNORE INTO diccionario (palabra_espanol, palabra_otomi, contexto_local, pronunciacion) VALUES (?, ?, ?, ?)`,
      [es, ot, contexto, pron],
      avisarError('Precarga del diccionario')
    );
    // Si la palabra ya existía de antes sin pronunciación, se la completa
    if (pron) {
      db.run(
        `UPDATE diccionario SET pronunciacion = ? WHERE palabra_espanol = ? AND (pronunciacion IS NULL OR pronunciacion = '')`,
        [pron, es],
        avisarError('Pronunciaciones del diccionario')
      );
    }
  });
  db.run('SELECT 1', [], () => console.log('Diccionario local verificado y precargado.'));
});

/* ---------- Funciones del diccionario (las usa main.js) ---------- */

function ejecutar(sql, params = []) {
  return new Promise((resolver, rechazar) => {
    db.run(sql, params, function (err) { err ? rechazar(err) : resolver(this); });
  });
}

function consultar(sql, params = []) {
  return new Promise((resolver, rechazar) => {
    db.all(sql, params, (err, filas) => { err ? rechazar(err) : resolver(filas); });
  });
}

// Devuelve todas las palabras: [{ es, ot, pr }]
function listarDiccionario() {
  return consultar(
    'SELECT palabra_espanol AS es, palabra_otomi AS ot, pronunciacion AS pr FROM diccionario ORDER BY id'
  );
}

// Inserta una palabra; si el español ya existe, actualiza su otomí y su pronunciación
async function guardarPalabra(es, ot, pr) {
  es = String(es || '').trim();
  ot = String(ot || '').trim();
  pr = String(pr || '').trim();
  if (!es || !ot) throw new Error('Faltan el español o el otomí');
  const r = await ejecutar(
    'UPDATE diccionario SET palabra_otomi = ?, pronunciacion = ? WHERE lower(palabra_espanol) = lower(?)',
    [ot, pr, es]
  );
  if (r.changes === 0) {
    await ejecutar(
      'INSERT INTO diccionario (palabra_espanol, palabra_otomi, contexto_local, pronunciacion) VALUES (?, ?, ?, ?)',
      [es, ot, 'Agregada por el maestro', pr]
    );
  }
}

module.exports = { db, listarDiccionario, guardarPalabra };