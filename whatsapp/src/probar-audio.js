// Prueba la transcripción sin conectarse a WhatsApp: npm run probar-audio -- nota.ogg
import { readFile } from 'node:fs/promises';
import { transcribir } from './transcribir.js';

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: npm run probar-audio -- <archivo de audio>');
  process.exit(1);
}

const inicio = Date.now();
console.log(await transcribir(await readFile(archivo)));
console.error(`(${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
