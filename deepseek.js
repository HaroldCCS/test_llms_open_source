const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const messages = [
  { 
    role: 'system', 
    content: 'Eres un experto profesor de inglés el cual estará enseñando inglés A1. Sé claro, paciente y directo.' 
  }
];

console.log('--- Chat interactivo con DeepSeek-R1 (Local + Memoria) ---');
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
    model: 'deepseek-r1:8b',
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
                process.stdout.write('\nDeepSeek-R1:\n');
                headerPrinted = true;
              }
              const content = json.message.content;
              process.stdout.write(content);
              assistantResponse += content;
            }

            if (json.done) {
              messages.push({ role: 'assistant', content: assistantResponse });
              const speed = (json.eval_count / (json.eval_duration / 1e9)).toFixed(2);
              console.log(`\n\n[Velocidad: ${speed} tokens/s]`);
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

  // Indicador visual inicial mientras el modelo comienza a razonar
  process.stdout.write('\n[Pensando...]');

  req.write(data);
  req.end();
});