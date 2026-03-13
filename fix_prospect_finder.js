const fs = require('fs');
const path = './src/pages/ProspectFinder.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Reset progress at the start of each channel
code = code.replace(
  'for (const channel of filters.channels) {',
  'for (const channel of filters.channels) {\n        setScrapeProgress({ percentage: 0, message: `Initialisation ${channel}...` });'
);

// 2. Wrap JSON.parse in try-catch and add logging for all channels
const parseRegex = /const d = JSON\.parse\(e\.data\);/g;
const replacement = `let d;
                try { d = JSON.parse(e.data); } 
                catch (err) { addLog(\`⚙️ \${e.data}\`, 'process'); return; }
                if (d.message && d.percentage === undefined && !d.error && !d.result) {
                   addLog(\`⚙️ \${d.message}\`, 'process');
                }`;

code = code.replace(parseRegex, replacement);

fs.writeFileSync(path, code);
console.log('File successfully updated with robust JSON parsing and progress reset.');
