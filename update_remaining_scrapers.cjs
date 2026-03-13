const fs = require('fs');
const path = require('path');

const files = [
  './scripts/scraper_gmaps.cjs',
  './scripts/scraper_societe.cjs',
  './scripts/scraper_pj.cjs',
  './scripts/scraper_pappers.cjs',
  './scripts/scraper_infogreffe.cjs'
];

const emitLogDef = `function emitLog(msg, pct = undefined) {
  // Console log pour l'exécution locale
  console.log(msg);
  // Envoi vers le frontend (SSE) afin d'être capté par le terminal Prospecta
  process.stdout.write(\`PROGRESS:\${JSON.stringify({ percentage: pct, message: msg })}\\n\`);
}`;

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let code = fs.readFileSync(f, 'utf8');

  // Inject emitLog definition if not present
  if (!code.includes('function emitLog')) {
    // Look for a good place to inject (after require statements)
    const lines = code.split('\n');
    let lastRequire = 0;
    lines.forEach((line, idx) => {
      if (line.includes('require(')) lastRequire = idx;
    });
    lines.splice(lastRequire + 1, 0, '\n' + emitLogDef + '\n');
    code = lines.join('\n');
  }

  // Standardize existing progress/log calls to emitLog
  code = code.replace(/sendProgress\(/g, 'emitLog(');
  code = code.replace(/console\.log\(/g, 'emitLog(');
  
  // Specific headers
  const basename = path.basename(f, '.cjs').replace('scraper_', '').toUpperCase();
  const headerLine = \`emitLog(\\`🚀 \${basename} Scraper — mode complet\\\\n\\ auditionné par Prospecta\\\\n\\`);\`;
  
  if (!code.includes('Scraper — mode complet')) {
      if (code.includes('async function main() {')) {
          code = code.replace('async function main() {', 'async function main() {\n  ' + headerLine);
      } else {
          // fallback
          code = code + '\n' + headerLine; 
      }
  }

  fs.writeFileSync(f, code);
  console.log(\`Updated \${f}\`);
});
