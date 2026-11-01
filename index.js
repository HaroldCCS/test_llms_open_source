const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const messages = [
  { 
    role: 'system', 
    content: 'Eres un experto profesor de ingles el cual estara enseñando ingles A1' 
  }
];

console.log('--- Chat interactivo con Llama 3 (Con Memoria) ---');
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
    model: 'llama3',
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

  const req = http.request(options, (res) => {
    console.log('\nLlama 3:');

    res.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      
      lines.forEach((line) => {
        if (line.trim() !== '') {
          try {
            const json = JSON.parse(line);
            
            if (json.message && json.message.content) {
              process.stdout.write(json.message.content);
              assistantResponse += json.message.content;
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
    console.error('\nError en la petición:', error.message);
    process.stdout.write('Tú: ');
  });

  req.write(data);
  req.end();
});