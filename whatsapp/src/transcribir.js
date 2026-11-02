import { spawn } from 'node:child_process';
import { env, pipeline } from '@huggingface/transformers';
import { config } from './config.js';

const FRECUENCIA = 16000;

env.cacheDir = config.carpetaModelos;

let cargaModelo;

export function cargarModelo() {
  cargaModelo ??= pipeline('automatic-speech-recognition', config.modelo, { dtype: 'q8' });
  return cargaModelo;
}

// Decodifica cualquier audio a PCM mono de 16 kHz en memoria: nada se guarda en disco.
function decodificar(audio) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-t', String(config.duracionMaxSegundos),
      '-f', 'f32le', '-ac', '1', '-ar', String(FRECUENCIA),
      'pipe:1',
    ]);

    const salida = [];
    let errores = '';
    ffmpeg.stdout.on('data', (trozo) => salida.push(trozo));
    ffmpeg.stderr.on('data', (trozo) => { errores += trozo; });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (codigo) => {
      if (codigo !== 0) return reject(new Error(`ffmpeg terminó con código ${codigo}: ${errores}`));
      const pcm = Buffer.concat(salida);
      // slice copia los bytes: Float32Array exige un offset alineado a 4.
      const copia = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length);
      resolve(new Float32Array(copia));
    });

    // Si ffmpeg rechaza el archivo cierra stdin antes de tiempo; ese EPIPE ya
    // se reporta por el código de salida.
    ffmpeg.stdin.on('error', () => {});
    ffmpeg.stdin.end(audio);
  });
}

export async function transcribir(audio) {
  const [muestras, transcriptor] = await Promise.all([decodificar(audio), cargarModelo()]);
  // Sin chunk_length_s, Whisper solo procesa los primeros 30 segundos. Sin
  // return_timestamps, al unir los trozos se pierde texto del inicio del audio.
  const { text } = await transcriptor(muestras, {
    language: config.idioma,
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  });
  return text.trim();
}
