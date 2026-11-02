import { normalizeMessageContent } from 'baileys';

const aNumero = (valor) => (typeof valor?.toNumber === 'function' ? valor.toNumber() : Number(valor));
const digitos = (jid) => (jid || '').split('@')[0].split(':')[0];

// Decide si un mensaje entrante se transcribe. Devuelve { ok: true } o
// { ok: false, motivo }. Solo pasan audios de chats 1 a 1 recibidos con el bot encendido.
export function evaluarMensaje(msg, { inicioBotSegundos, numerosPermitidos, duracionMaxSegundos }) {
  const { remoteJid, remoteJidAlt, fromMe } = msg.key ?? {};

  // Los wrappers de mensajes temporales se desenvuelven aquí; sin esto, los
  // audios de chats con mensajes temporales no se detectarían.
  const contenido = normalizeMessageContent(msg.message);
  const audio = contenido?.audioMessage;

  if (!audio) return { ok: false, motivo: 'no es audio' };
  if (fromMe) return { ok: false, motivo: 'enviado por mí' };
  if (!remoteJid || !/@(s\.whatsapp\.net|lid)$/.test(remoteJid)) {
    return { ok: false, motivo: 'no es un chat 1 a 1' };
  }
  if (audio.viewOnce || msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2) {
    return { ok: false, motivo: 'audio de una sola vista' };
  }
  if (aNumero(msg.messageTimestamp) < inicioBotSegundos) {
    return { ok: false, motivo: 'anterior al arranque' };
  }
  if (aNumero(audio.seconds) > duracionMaxSegundos) {
    return { ok: false, motivo: 'demasiado largo' };
  }
  if (
    numerosPermitidos.length > 0 &&
    !numerosPermitidos.includes(digitos(remoteJid)) &&
    !numerosPermitidos.includes(digitos(remoteJidAlt))
  ) {
    return { ok: false, motivo: 'contacto fuera de NUMEROS_PERMITIDOS' };
  }
  return { ok: true };
}
