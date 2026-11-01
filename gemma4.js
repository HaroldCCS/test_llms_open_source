const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const messages = [
  { 
    role: 'system', 
    content: 'Eres un profesor de inglés nativo, amigable y paciente. Tu objetivo es ayudarme a practicar y aprender inglés de nivel A1. Corrige mis errores de forma constructiva y mantén la conversación fluida.' 
  }
];

const CONTEXT_LIMIT = 4096; // Límite de tokens de la ventana de contexto de Gemma 2

console.log('--- Chat interactivo con Gemma 2 (Profesor de Inglés + Control de Tokens) ---');
console.log('Escribe tu mensaje y presiona Enter. Escribe "salir" para terminar.\n');
process.stdout.write('Tú: ');

rl.on('line', (prompt) => {
  const trimmed = prompt.trim();
  
  if (trimmed.toLowerCase() === 'salir') {
    console.log('¡Hasta luego!');
    rl.close();
    process.exit(0);
  }

  if (trimmed === '') {
    process.stdout.write('Tú: ');
    return;
  }

  messages.push({ role: 'user', content: trimmed });

  const data = JSON.stringify({
    model: 'gemma2',
    messages: messages,
    stream: true
  });

  const options = {
    hostname: 'localhost',
    port: 11434,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  let assistantResponse = '';
  let headerPrinted = false;

  const req = http.request(options, (res) => {
    res.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      
      lines.forEach((line) => {
        if (line.trim() !== '') {
          try {
            const json = JSON.parse(line);
            
            if (json.message && json.message.content) {
              if (!headerPrinted) {
                process.stdout.write('\nGemma 2:\n');
                headerPrinted = true;
              }
              const content = json.message.content;
              process.stdout.write(content);
              assistantResponse += content;
            }

            if (json.done) {
              messages.push({ role: 'assistant', content: assistantResponse });
              
              const promptTokens = json.prompt_eval_count || 0;
              const completionTokens = json.eval_count || 0;
              const turnTotal = promptTokens + completionTokens;
              const speed = (completionTokens / (json.eval_duration / 1e9)).toFixed(2);

              console.log(`\n\n[Tokens -> Mensaje: ${promptTokens} | Respuesta: ${completionTokens} | Total turno: ${turnTotal}]`);
              console.log(`[Contexto actual: ${promptTokens} / ${CONTEXT_LIMIT} tokens (${((promptTokens / CONTEXT_LIMIT) * 100).toFixed(1)}%)]`);
              console.log(`[Velocidad: ${speed} tokens/s]`);
              console.log('----------------------------------------');
              process.stdout.write('Tú: ');
            }
          } catch (e) {}
        }
      });
    });
  });

  req.on('error', (error) => {
    console.error('\nError en la petición (¿Está Ollama abierto?):', error.message);
    process.stdout.write('Tú: ');
  });

  req.write(data);
  req.end();
});