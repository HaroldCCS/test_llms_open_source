# Transcriptor de audios de WhatsApp

Se vincula a tu cuenta personal como dispositivo y, cuando alguien te envía un audio en un chat 1 a 1, le responde citándolo con la transcripción. Whisper corre en tu equipo: el audio no se envía a ningún servicio de transcripción ni se guarda en disco.

## Requisitos

Node.js 22 o superior y `ffmpeg` (`brew install ffmpeg`).

## Uso

```bash
npm install
npm start
```

La primera vez aparece un QR: escanéalo en WhatsApp > Dispositivos vinculados > Vincular un dispositivo. El bot solo funciona mientras el proceso esté corriendo y el equipo encendido.

Para probar primero sin escribirle a todos, copia `.env.example` a `.env` y pon tu número de prueba en `NUMEROS_PERMITIDOS`. Los demás ajustes están en ese mismo archivo.

Para probar solo la transcripción, sin WhatsApp:

```bash
npm run probar-audio -- nota.ogg
npm test
```

## Qué audios responde

| Caso | Se responde |
| --- | --- |
| Audio o nota de voz en chat 1 a 1 | Sí |
| Grupos, estados y canales | No |
| Audios propios | No |
| Audios de una sola vista | No |
| Audios recibidos con el bot apagado | No |
| Audios de más de `DURACION_MAX_SEGUNDOS` | No |

## Riesgos

- **Cuenta:** [Baileys](https://github.com/WhiskeySockets/Baileys) es una librería no oficial y las condiciones de WhatsApp prohíben las automatizaciones no autorizadas, así que la cuenta puede ser restringida o bloqueada.
- **Credenciales:** `auth_info/` da acceso completo a tu cuenta. Nunca lo compartas ni lo subas a git. Para revocarlo, cierra el dispositivo desde el teléfono y borra la carpeta.
