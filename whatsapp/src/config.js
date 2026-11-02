import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  carpetaSesion: path.join(raiz, 'auth_info'),
  carpetaModelos: path.join(raiz, '.cache', 'models'),
  modelo: process.env.WHISPER_MODELO || 'Xenova/whisper-small',
  idioma: process.env.WHISPER_IDIOMA || 'spanish',
  duracionMaxSegundos: Number(process.env.DURACION_MAX_SEGUNDOS) || 300,
  prefijo: (process.env.PREFIJO_RESPUESTA ?? '🎙️ Transcripción automática:').trim(),
  // Vacío = responde a todos. Solo dígitos, con indicativo: 573001234567
  numerosPermitidos: (process.env.NUMEROS_PERMITIDOS || '')
    .split(',')
    .map((n) => n.replace(/\D/g, ''))
    .filter(Boolean),
};
