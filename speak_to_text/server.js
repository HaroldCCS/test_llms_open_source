const express = require('express');
const fileUpload = require('express-fileupload');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const wav = require('node-wav');

ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
const PORT = 3000;

let transcriber;

app.use(express.static(__dirname));
app.use(fileUpload({ useTempFiles: true, tempFileDir: '/tmp/' }));

function convertirAudioAWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('wav')
      .audioFrequency(16000)
      .audioChannels(1)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

function readAudioAsFloat32Array(wavPath) {
  const buffer = fs.readFileSync(wavPath);
  const result = wav.decode(buffer);
  return result.channelData[0];
}

app.post('/api/transcribe', async (req, res) => {
  if (!req.files || !req.files.audio) {
    return res.status(400).json({ error: 'No se envió ningún archivo de audio.' });
  }

  const audioFile = req.files.audio;
  const wavPath = path.join('/tmp', `converted_${Date.now()}.wav`);

  try {
    await convertirAudioAWav(audioFile.tempFilePath, wavPath);
    const audioData = readAudioAsFloat32Array(wavPath);

    console.log('Transcribiendo audio de WhatsApp...');
    const result = await transcriber(audioData);

    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    if (fs.existsSync(audioFile.tempFilePath)) fs.unlinkSync(audioFile.tempFilePath);

    res.json({ text: result.text.trim() });
  } catch (error) {
    console.error('Error procesando el audio:', error);
    res.status(500).json({ error: 'Fallo al procesar el audio' });
  }
});

async function main() {
  console.log('Cargando motor de transcripción local (Whisper)...');
  const { pipeline } = await import('@xenova/transformers');
  transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
    language: 'spanish',
    task: 'transcribe'
  });
  console.log('Motor listo.');

  app.listen(PORT, () => {
    console.log(`Servidor de audio corriendo en http://localhost:${PORT}`);
  });
}

main().catch(console.error);