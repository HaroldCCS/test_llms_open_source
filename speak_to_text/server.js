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

// 1. Convertir cualquier formato de audio (.opus, .ogg, .mp3) a WAV Mono 16kHz
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

// 2. Extraer datos en Float32Array para Node.js
function readAudioAsFloat32Array(wavPath) {
  const buffer = fs.readFileSync(wavPath);
  const result = wav.decode(buffer);
  return result.channelData[0]; // Primer canal (Mono)
}

// 3. Procesar transcripción con Qwen en Ollama
async function limpiarTextoConLLM(textoBruto) {
  if (!textoBruto) return "No se logró transcribir audio detectable.";

  const prompt = `Eres un asistente de redacción y síntesis profesional. Recibirás una transcripción bruta de un audio de voz de WhatsApp que contiene muletillas, pausas o frases desordenadas.

Tu tarea es:
1. Eliminar muletillas, repeticiones innecesarias y correcciones al hablar.
2. Reescribir el mensaje de forma clara, directa y estructurada manteniendo la intención original.
3. Extraer una lista de "Requerimientos / Puntos Clave" si aplican.

Transcripción bruta:
"""
${textoBruto}
"""

Responde únicamente con el mensaje pulido y sus puntos clave.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // Timeout de 60s

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        prompt: prompt,
        stream: false
      })
    });

    clearTimeout(timeoutId);
    const data = await response.json();
    return data.response || textoBruto;
  } catch (error) {
    console.error('Ollama no respondió o está apagado. Usando texto bruto:', error.message);
    return textoBruto;
  }
}

// 4. Endpoint principal
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
    
console.log('Transcribiendo audio de WhatsApp...');
    
    // Firma correcta pasando un objeto vacío {} como segundo argumento
    const rawResult = await transcriber(audioData, {}, {
      language: 'spanish',
      task: 'transcribe',
      temperature: 0.0,
      repetition_penalty: 1.2,
      chunk_length_s: 30,
      stride_length_s: 5
    });

    const textoBruto = rawResult.text ? rawResult.text.trim() : '';
    console.log('Texto bruto:', textoBruto);

    console.log('Procesando y limpiando mensaje con Qwen...');
    const textoPulido = await limpiarTextoConLLM(textoBruto);

    // Limpieza de temporales
    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    if (fs.existsSync(audioFile.tempFilePath)) fs.unlinkSync(audioFile.tempFilePath);

    res.json({ 
      rawText: textoBruto,
      cleanText: textoPulido 
    });

  } catch (error) {
    console.error('Error procesando el audio:', error);
    
    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    if (fs.existsSync(audioFile.tempFilePath)) fs.unlinkSync(audioFile.tempFilePath);

    res.status(500).json({ error: 'Fallo al procesar el audio' });
  }
});

// 5. Arranque del servidor
async function main() {
  console.log('Cargando motor de transcripción local (Whisper)...');
  const { pipeline } = await import('@xenova/transformers');
  
  transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
    language: 'spanish',
    task: 'transcribe'
  });
  
  console.log('Motor listo.');

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

main().catch(console.error);