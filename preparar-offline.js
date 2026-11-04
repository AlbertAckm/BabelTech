/* Prepara todo para funcionar SIN internet.
   Ejecútalo UNA sola vez, con internet, desde la carpeta del proyecto:

     npm install vosk-browser tailwindcss@3 @fontsource/quicksand
     node preparar-offline.js

   Hace cuatro cosas:
   1) Copia vosk.js a vendor/
   2) Copia la fuente Quicksand a vendor/fonts/ y crea vendor/fonts.css
   3) Compila Tailwind a vendor/tailwind.css
   4) Descarga el modelo de voz en español (.zip oficial) y lo convierte al
      formato que necesita vosk-browser (.tar.gz con carpeta "model") en modelo/ */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const raiz = __dirname;
const nm = path.join(raiz, 'node_modules');
const vendor = path.join(raiz, 'vendor');
const carpetaModelo = path.join(raiz, 'modelo');
fs.mkdirSync(path.join(vendor, 'fonts'), { recursive: true });
fs.mkdirSync(carpetaModelo, { recursive: true });

function falta(msg) { console.error('\n✖ ' + msg + '\n'); process.exit(1); }

// 1) Vosk
const vosk = path.join(nm, 'vosk-browser', 'dist', 'vosk.js');
if (!fs.existsSync(vosk)) falta('No encuentro vosk-browser. Ejecuta: npm install vosk-browser');
fs.copyFileSync(vosk, path.join(vendor, 'vosk.js'));
console.log('✔ vendor/vosk.js');

// 2) Fuente Quicksand (solo el subconjunto latino: incluye ñ, á, ä, ü)
const pesos = [400, 600, 700];
let css = '';
for (const p of pesos) {
  const nombre = `quicksand-latin-${p}-normal.woff2`;
  const origen = path.join(nm, '@fontsource', 'quicksand', 'files', nombre);
  if (!fs.existsSync(origen)) falta('No encuentro ' + nombre + '. Ejecuta: npm install @fontsource/quicksand');
  fs.copyFileSync(origen, path.join(vendor, 'fonts', nombre));
  css += `@font-face{font-family:'Quicksand';font-style:normal;font-weight:${p};font-display:swap;src:url('fonts/${nombre}') format('woff2');}\n`;
}
fs.writeFileSync(path.join(vendor, 'fonts.css'), css);
console.log('✔ vendor/fonts.css y fuentes');

// 3) Tailwind
const cli = path.join(nm, 'tailwindcss', 'lib', 'cli.js');
if (!fs.existsSync(cli)) falta('No encuentro tailwindcss. Ejecuta: npm install tailwindcss@3');
execSync(`node "${cli}" -c tailwind.config.js -i src/input.css -o vendor/tailwind.css --minify`, { cwd: raiz, stdio: 'inherit' });
console.log('✔ vendor/tailwind.css');

// 4) Modelo de voz
const nombreFinal = 'vosk-model-small-es-0.42.tar.gz';
const destino = path.join(carpetaModelo, nombreFinal);
const urlZip = 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip';

function descargar(u, salida, redirecciones = 0) {
  return new Promise((ok, mal) => {
    https.get(u, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirecciones < 5) {
        res.resume();
        return ok(descargar(new URL(res.headers.location, u).href, salida, redirecciones + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return mal(new Error('HTTP ' + res.statusCode)); }
      const f = fs.createWriteStream(salida);
      res.pipe(f);
      f.on('finish', () => f.close(ok));
      f.on('error', mal);
    }).on('error', mal);
  });
}

const CONF_POR_DEFECTO = [
  '--min-active=200',
  '--max-active=3000',
  '--beam=10.0',
  '--lattice-beam=2.0',
  '--acoustic-scale=1.0',
  '--frame-subsampling-factor=3',
  '--endpoint.silence-phones=1:2:3:4:5:6:7:8:9:10',
  '--endpoint.rule2.min-trailing-silence=0.5',
  '--endpoint.rule3.min-trailing-silence=0.75',
  '--endpoint.rule4.min-trailing-silence=1.0'
].join('\n') + '\n';

async function prepararModelo() {
  if (fs.existsSync(destino) && fs.statSync(destino).size > 1e6) {
    console.log('✔ modelo/' + nombreFinal + ' (ya estaba)');
    return;
  }
  const tmp = path.join(carpetaModelo, '_tmp');
  const zip = path.join(carpetaModelo, 'modelo.zip');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try {
    console.log('… descargando modelo de voz (~40 MB), puede tardar unos minutos');
    await descargar(urlZip, zip);

    console.log('… preparando modelo');
    // "tar" ya viene incluido en Windows 10/11, macOS y Linux
    execSync('tar -xf modelo.zip -C _tmp', { cwd: carpetaModelo });

    const carpetas = fs.readdirSync(tmp).filter(n => fs.statSync(path.join(tmp, n)).isDirectory());
    if (carpetas.length !== 1) throw new Error('el zip tiene una estructura inesperada');
    const origen = path.join(tmp, carpetas[0]);
    const modelDir = path.join(tmp, 'model');
    if (origen !== modelDir) fs.renameSync(origen, modelDir);

    // vosk-browser necesita conf/model.conf
    const conf = path.join(modelDir, 'conf', 'model.conf');
    if (!fs.existsSync(conf)) {
      fs.mkdirSync(path.dirname(conf), { recursive: true });
      fs.writeFileSync(conf, CONF_POR_DEFECTO);
    }

    execSync(`tar -czf ${nombreFinal} -C _tmp model`, { cwd: carpetaModelo });
    console.log('✔ modelo/' + nombreFinal);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    try { fs.unlinkSync(zip); } catch (_) {}
  }
}

prepararModelo()
  .then(() => console.log('\nListo. Ya puedes desconectarte de internet y abrir la app.'))
  .catch((e) => {
    try { fs.unlinkSync(destino); } catch (_) {}
    falta('No pude preparar el modelo de voz: ' + e.message);
  });