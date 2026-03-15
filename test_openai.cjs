const fs = require('fs');
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const keyLine = env.split('\n').find(l => l.startsWith('VITE_OPENAI_KEY='));
const key = keyLine ? keyLine.split('=')[1].replace(/['"]/g, '') : null;

if (!key) {
  console.log('No OpenAI Key found in .env');
  process.exit(1);
}

fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Say hello in JSON format { "hello": "world" }' }]
  })
}).then(res => res.json()).then(console.log).catch(console.error);
