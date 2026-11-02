import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from 'baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config } from './config.js';
import { evaluarMensaje } from './filtro.js';
import { cargarModelo, transcribir } from './transcribir.js';

const logger = pino({ level: 'silent' });
const inicioBotSegundos = Math.floor(Date.now() / 1000);

const vistos = new Set();
const enviados = new Map(); // Baileys los pide si un destinatario solicita reenvío.
const MAX_RECORDADOS = 500;
let cola = Promise.resolve();
let intentos = 0;
let sock; // Se reemplaza en cada reconexión; los audios en cola usan siempre el vigente.

function recordar(coleccion, agregar) {
  agregar();
  if (coleccion.size > MAX_RECORDADOS) {
    const masAntiguo = coleccion.keys().next().value;
    coleccion.delete(masAntiguo);
  }
}

async function procesarAudio(msg) {
  const chat = msg.key.remoteJid;
  try {
    console.log(`Audio recibido de ${chat}, transcribiendo...`);
    const audio = await downloadMediaMessage(msg, 'buffer', {}, {
      logger,
      reuploadRequest: sock.updateMediaMessage,
    });
    const texto = await transcribir(audio);
    if (!texto) {
      console.log('No se detectó voz; no se responde.');
      return;
    }
    const cuerpo = config.prefijo ? `${config.prefijo}\n\n${texto}` : texto;
    const enviado = await sock.sendMessage(chat, { text: cuerpo }, { quoted: msg });
    recordar(enviados, () => enviados.set(enviado.key.id, enviado.message));
    console.log(`Respondido a ${chat}.`);
  } catch (error) {
    // El fallo se queda en el log: el contacto no debe recibir errores internos.
    console.error(`No se pudo procesar el audio de ${chat}:`, error);
  }
}

function alRecibirMensajes({ type, messages }) {
  if (type !== 'notify') return; // 'append' es historial sincronizado.

  for (const msg of messages) {
    const id = msg.key?.id;
    if (!id || vistos.has(id)) continue;

    const resultado = evaluarMensaje(msg, {
      inicioBotSegundos,
      numerosPermitidos: config.numerosPermitidos,
      duracionMaxSegundos: config.duracionMaxSegundos,
    });
    if (!resultado.ok) {
      if (resultado.motivo !== 'no es audio') console.log(`Audio ignorado: ${resultado.motivo}.`);
      continue;
    }

    recordar(vistos, () => vistos.add(id));
    // Uno a la vez: Whisper usa toda la CPU y varios en paralelo saturarían el equipo.
    cola = cola.then(() => procesarAudio(msg));
  }
}

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState(config.carpetaSesion);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    markOnlineOnConnect: false, // Si no, el teléfono deja de recibir notificaciones.
    shouldSyncHistoryMessage: () => false,
    getMessage: async (key) => enviados.get(key.id),
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', alRecibirMensajes);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nEscanea este QR en WhatsApp > Dispositivos vinculados > Vincular un dispositivo:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      intentos = 0;
      console.log('Conectado a WhatsApp. Esperando audios...');
    }

    if (connection === 'close') {
      const codigo = lastDisconnect?.error?.output?.statusCode;

      if (codigo === DisconnectReason.loggedOut) {
        console.error('Sesión cerrada desde el teléfono. Borra auth_info/ y vuelve a vincular.');
        process.exit(1);
      }
      if (codigo === DisconnectReason.connectionReplaced) {
        console.error('Otra instancia del bot tomó esta sesión. Deteniendo esta.');
        process.exit(1);
      }

      intentos += 1;
      const espera = codigo === DisconnectReason.restartRequired
        ? 0
        : Math.min(1000 * 2 ** intentos, 60000);
      console.log(`Conexión cerrada (código ${codigo}). Reintentando en ${espera / 1000} s...`);
      setTimeout(() => conectar().catch(fallar), espera);
    }
  });
}

function fallar(error) {
  console.error('Error fatal:', error);
  process.exit(1);
}

console.log(`Cargando ${config.modelo} (la primera vez lo descarga)...`);
await cargarModelo();
console.log(
  config.numerosPermitidos.length
    ? `Modo restringido: solo se responde a ${config.numerosPermitidos.join(', ')}.`
    : 'Se responderá a cualquier contacto en chats 1 a 1.',
);
await conectar().catch(fallar);
