import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluarMensaje } from '../src/filtro.js';

const opciones = { inicioBotSegundos: 1000, numerosPermitidos: [], duracionMaxSegundos: 300 };
const audio = { audioMessage: { seconds: 10, ptt: true } };
const base = {
  key: { remoteJid: '573001112222@s.whatsapp.net', fromMe: false, id: 'A' },
  messageTimestamp: 2000,
  message: audio,
};
const conKey = (key) => ({ ...base, key: { ...base.key, ...key } });
const motivo = (msg, extra = {}) => evaluarMensaje(msg, { ...opciones, ...extra }).motivo;

test('acepta nota de voz en chat 1 a 1', () => {
  assert.deepEqual(evaluarMensaje(base, opciones), { ok: true });
});

test('acepta contacto direccionado por LID', () => {
  assert.equal(evaluarMensaje(conKey({ remoteJid: '12345@lid' }), opciones).ok, true);
});

test('acepta audio en chat con mensajes temporales', () => {
  const msg = { ...base, message: { ephemeralMessage: { message: audio } } };
  assert.equal(evaluarMensaje(msg, opciones).ok, true);
});

test('acepta timestamp tipo Long', () => {
  const msg = { ...base, messageTimestamp: { toNumber: () => 2000 } };
  assert.equal(evaluarMensaje(msg, opciones).ok, true);
});

test('ignora lo que no es audio', () => {
  assert.equal(motivo({ ...base, message: { conversation: 'hola' } }), 'no es audio');
});

test('ignora mis propios audios', () => {
  assert.equal(motivo(conKey({ fromMe: true })), 'enviado por mí');
});

test('ignora grupos, estados y canales', () => {
  for (const remoteJid of ['123-456@g.us', 'status@broadcast', '999@newsletter']) {
    assert.equal(motivo(conKey({ remoteJid })), 'no es un chat 1 a 1');
  }
});

test('ignora audios de una sola vista', () => {
  const msg = { ...base, message: { viewOnceMessageV2: { message: audio } } };
  assert.equal(motivo(msg), 'audio de una sola vista');
});

test('ignora audios anteriores al arranque', () => {
  assert.equal(motivo({ ...base, messageTimestamp: 999 }), 'anterior al arranque');
});

test('ignora audios demasiado largos', () => {
  const msg = { ...base, message: { audioMessage: { seconds: 301 } } };
  assert.equal(motivo(msg), 'demasiado largo');
});

test('la lista de permitidos filtra por número o por JID alterno', () => {
  const numerosPermitidos = ['573001112222'];
  assert.equal(evaluarMensaje(base, { ...opciones, numerosPermitidos }).ok, true);

  const conLid = conKey({ remoteJid: '12345@lid', remoteJidAlt: '573001112222@s.whatsapp.net' });
  assert.equal(evaluarMensaje(conLid, { ...opciones, numerosPermitidos }).ok, true);

  const otro = conKey({ remoteJid: '12345@lid' });
  assert.equal(motivo(otro, { numerosPermitidos }), 'contacto fuera de NUMEROS_PERMITIDOS');
});
