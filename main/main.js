const { app, BrowserWindow, session, systemPreferences } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
require('../database/database.js');

/* ---------- Servidor local del modelo de voz (Vosk) ----------
   Solo escucha en 127.0.0.1: no sale a internet. Sirve únicamente
   archivos que estén dentro de la carpeta "modelo". */
function iniciarServidorModelo() {
  const carpeta = path.join(app.getAppPath(), 'modelo');
  const servidor = http.createServer((req, res) => {
    const nombre = path.basename(req.url.split('?')[0]);
    const ruta = path.join(carpeta, nombre);
    fs.stat(ruta, (err, info) => {
      if (err || !info.isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Length': info.size
      });
      fs.createReadStream(ruta).pipe(res);
    });
  });
  servidor.on('error', (e) => console.error('Servidor del modelo de voz:', e.message));
  servidor.listen(8765, '127.0.0.1');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "Natho Ya Bätsi - El Niño Habla"
  });

  // Carga la interfaz principal
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  // Permite usar el micrófono dentro de la app
  session.defaultSession.setPermissionRequestHandler((wc, permiso, callback) => {
    callback(permiso === 'media');
  });
  if (process.platform === 'darwin' && systemPreferences.askForMediaAccess) {
    systemPreferences.askForMediaAccess('microphone').catch(() => {});
  }

  iniciarServidorModelo();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
