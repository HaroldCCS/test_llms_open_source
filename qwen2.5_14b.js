const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const messages = [
  { 
    role: 'system', 
    content: `Desarrolla un agente experto en derecho colombiano que pueda proporcionar asesoramiento legal en diferentes áreas del derecho colombiano, como contratos, propiedad intelectual, derecho laboral, y derecho penal. Este agente debe ser capaz de:

1. Interpretar y explicar leyes y reglamentos colombianos específicos de áreas del derecho como Contrato 222 de 2015, Ley 397 de 1997, Código Penal, Código del Trabajo, y la Ley 23 de 1982 sobre propiedad intelectual.

2. Proporcionar ejemplos prácticos de cómo aplicar estas leyes a situaciones cotidianas y de negocios en Colombia.

3. Recomendar pasos legales y procedimientos para resolver problemas legales comunes en Colombia.

4. Proporcionar enlaces a fuentes legales oficiales de Colombia y otros recursos legales para mayor investigación y consulta.

Este agente experto debe ser capaz de mantener conversaciones fluidas y responder preguntas detalladas sobre el derecho colombiano, proporcionando explicaciones claras y precisas. El agente debe ser capaz de manejar preguntas en español y utilizar un lenguaje legal pero accesible para usuarios no expertos en derecho.`
  }
];

// Límite práctico de la ventana de contexto para qwen2.5:14b en Ollama (16k)
const CONTEXT_LIMIT = 16384; 

console.log('--- Chat interactivo con Qwen 2.5 14B (Profesor de Inglés + Control de Tokens) ---');
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
    model: 'qwen2.5:7b',
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
                process.stdout.write('\nQwen 2.5 14B:\n');
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