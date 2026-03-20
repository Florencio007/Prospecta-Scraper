#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 *  PROSPECTA — INSTALLEUR AUTOMATIQUE
 *  Lance ce script UNE SEULE FOIS depuis le dossier prospecta-ai-main
 *
 *  Usage :
 *    node install_scraper.cjs
 *
 *  Ce script fait automatiquement :
 *  1. Copie scraper_google_search_complet.cjs → scripts/scraper_google.cjs
 *  2. Copie prospecta_launcher.cjs            → scripts/prospecta_launcher.cjs
 *  3. Patche server/app.js pour utiliser le launcher CDP
 *  4. Vérifie que tout est en ordre
 * ═══════════════════════════════════════════════════════════════════════
 */

const fs   = require('fs');
const path = require('path');

// ── Chemins ───────────────────────────────────────────────────────────────────
const ROOT         = process.cwd();
const SCRIPTS_DIR  = path.join(ROOT, 'scripts');
const APP_JS       = path.join(ROOT, 'server', 'app.js');
const DOWNLOADS    = path.join(require('os').homedir(), 'Downloads');

// Fichiers source (dans Downloads ou dossier courant)
const SOURCES = {
  scraper  : findFile('scraper_google_search_complet.cjs'),
  launcher : findFile('prospecta_launcher.cjs'),
};

function findFile(name) {
  // Chercher dans Downloads, dossier courant, et scripts/
  const candidates = [
    path.join(DOWNLOADS, name),
    path.join(ROOT, name),
    path.join(SCRIPTS_DIR, name),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── Couleurs console ──────────────────────────────────────────────────────────
const ok  = (s) => console.log(`  ✅ ${s}`);
const err = (s) => console.log(`  ❌ ${s}`);
const inf = (s) => console.log(`  ℹ️  ${s}`);
const hdr = (s) => console.log(`\n${'═'.repeat(60)}\n  ${s}\n${'═'.repeat(60)}`);

// ─────────────────────────────────────────────────────────────────────────────
//  ÉTAPE 1 — Vérifications préliminaires
// ─────────────────────────────────────────────────────────────────────────────
hdr('PROSPECTA — Installeur Automatique');

// Vérifier qu'on est dans le bon dossier
if (!fs.existsSync(APP_JS)) {
  err(`server/app.js introuvable. Êtes-vous dans le dossier prospecta-ai-main ?`);
  err(`Dossier actuel : ${ROOT}`);
  process.exit(1);
}
ok(`Dossier Prospecta détecté : ${ROOT}`);

// Vérifier scripts/
if (!fs.existsSync(SCRIPTS_DIR)) {
  fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  ok(`Dossier scripts/ créé`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  ÉTAPE 2 — Copier les fichiers
// ─────────────────────────────────────────────────────────────────────────────
hdr('Étape 1/3 — Copie des fichiers');

// Scraper principal
const scraperDest = path.join(SCRIPTS_DIR, 'scraper_google.cjs');
if (SOURCES.scraper) {
  // Backup de l'ancien
  if (fs.existsSync(scraperDest)) {
    fs.copyFileSync(scraperDest, scraperDest + '.backup');
    inf(`Backup créé : scripts/scraper_google.cjs.backup`);
  }
  fs.copyFileSync(SOURCES.scraper, scraperDest);
  ok(`scraper_google_search_complet.cjs → scripts/scraper_google.cjs`);
} else {
  // Le scraper est peut-être déjà dans scripts/ avec l'autre nom
  const altPath = path.join(SCRIPTS_DIR, 'scraper_google_search_complet.cjs');
  if (fs.existsSync(altPath)) {
    if (fs.existsSync(scraperDest)) {
      fs.copyFileSync(scraperDest, scraperDest + '.backup');
    }
    fs.copyFileSync(altPath, scraperDest);
    ok(`scraper_google_search_complet.cjs → scripts/scraper_google.cjs`);
  } else {
    err(`scraper_google_search_complet.cjs introuvable dans Downloads ou scripts/`);
    err(`Téléchargez-le et placez-le dans : ${DOWNLOADS}`);
    process.exit(1);
  }
}

// Launcher CDP
const launcherDest = path.join(SCRIPTS_DIR, 'prospecta_launcher.cjs');
if (SOURCES.launcher) {
  fs.copyFileSync(SOURCES.launcher, launcherDest);
  ok(`prospecta_launcher.cjs → scripts/prospecta_launcher.cjs`);
} else {
  // Créer le launcher directement s'il n'est pas trouvé
  inf(`prospecta_launcher.cjs non trouvé — création intégrée...`);
  createInlineLauncher(launcherDest);
  ok(`prospecta_launcher.cjs créé dans scripts/`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  ÉTAPE 3 — Patcher server/app.js
// ─────────────────────────────────────────────────────────────────────────────
hdr('Étape 2/3 — Patch de server/app.js');

let appJs = fs.readFileSync(APP_JS, 'utf8');

// Backup
fs.writeFileSync(APP_JS + '.backup', appJs);
inf(`Backup créé : server/app.js.backup`);

// Vérifier si déjà patché
if (appJs.includes('prospecta_launcher.cjs')) {
  ok(`server/app.js déjà patché — rien à faire`);
} else {
  // Pattern à chercher et remplacer
  const OLD_ENDPOINT = `setupScraperEndpoint(app, '/api/scrape/google', 'scraper_google.cjs', (req) => [
  req.query.q || '',
  req.query.l || '',
  req.query.limit || '10',
  req.query.type || 'tous',
  req.query.fields || ''
]);`;

  const NEW_ENDPOINT = `// ── Google Web Search (avec CDP — session Chrome réelle) ──────────────
setupScraperEndpoint(app, '/api/scrape/google', 'prospecta_launcher.cjs', (req) => [
  req.query.q || '',
  req.query.l || '',
  req.query.limit || '10',
]);`;

  if (appJs.includes(OLD_ENDPOINT)) {
    appJs = appJs.replace(OLD_ENDPOINT, NEW_ENDPOINT);
    fs.writeFileSync(APP_JS, appJs);
    ok(`server/app.js patché — /api/scrape/google utilise maintenant le launcher CDP`);
  } else {
    // Essayer une version plus flexible
    const regex = /setupScraperEndpoint\(app,\s*'\/api\/scrape\/google',\s*'scraper_google\.cjs'/;
    if (regex.test(appJs)) {
      appJs = appJs.replace(
        regex,
        `setupScraperEndpoint(app, '/api/scrape/google', 'prospecta_launcher.cjs'`
      );
      fs.writeFileSync(APP_JS, appJs);
      ok(`server/app.js patché (mode flexible)`);
    } else {
      err(`Pattern non trouvé dans server/app.js`);
      inf(`Faites ce changement manuellement dans server/app.js :`);
      inf(`  Remplacez : 'scraper_google.cjs'`);
      inf(`  Par       : 'prospecta_launcher.cjs'`);
      inf(`  Ligne ~741 dans server/app.js`);
    }
  }
}

// ── Aussi : s'assurer que le JSON de sortie est bien lu ────────────────────
// Le launcher produit last_google_search_results.json comme l'ancien scraper
// → rien à changer côté lecture JSON

// ─────────────────────────────────────────────────────────────────────────────
//  ÉTAPE 4 — Vérification finale
// ─────────────────────────────────────────────────────────────────────────────
hdr('Étape 3/3 — Vérification');

const checks = [
  [path.join(SCRIPTS_DIR, 'scraper_google.cjs'),        'scripts/scraper_google.cjs'],
  [path.join(SCRIPTS_DIR, 'prospecta_launcher.cjs'),     'scripts/prospecta_launcher.cjs'],
  [APP_JS,                                               'server/app.js'],
];

let allOk = true;
for (const [filePath, label] of checks) {
  if (fs.existsSync(filePath)) {
    ok(`${label} présent`);
  } else {
    err(`${label} MANQUANT`);
    allOk = false;
  }
}

// Vérifier que le patch est bien appliqué
const appJsFinal = fs.readFileSync(APP_JS, 'utf8');
if (appJsFinal.includes('prospecta_launcher.cjs')) {
  ok(`server/app.js utilise bien prospecta_launcher.cjs`);
} else {
  err(`server/app.js n'utilise pas encore prospecta_launcher.cjs`);
  allOk = false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  RÉSUMÉ
// ─────────────────────────────────────────────────────────────────────────────
hdr('Installation ' + (allOk ? 'RÉUSSIE ✅' : 'INCOMPLÈTE ⚠️'));

if (allOk) {
  console.log(`
  🎉 Prospecta est prêt à utiliser votre Chrome existant !

  ▶  Redémarrez le serveur :
       npm start
     ou :
       node server.js

  ▶  Lancez une recherche depuis Prospecta — le scraper se connecte
     automatiquement à votre Chrome (session Google active, 0 CAPTCHA).

  ℹ️  En cas de problème, les backups sont disponibles :
       server/app.js.backup
       scripts/scraper_google.cjs.backup
  `);
} else {
  console.log(`
  ⚠️  Installation incomplète. Vérifiez les erreurs ci-dessus.
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Créer le launcher en ligne si le fichier n'est pas trouvé
// ─────────────────────────────────────────────────────────────────────────────
function createInlineLauncher(dest) {
  const content = `#!/usr/bin/env node
const { spawn, execSync, exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const CDP_PORT = process.env.CDP_PORT || 9222;
const CDP_URL  = \`http://localhost:\${CDP_PORT}\`;
const SCRAPER  = path.join(__dirname, 'scraper_google.cjs');
const QUERY    = process.argv[2] || 'hotel';
const LOCATION = process.argv[3] || 'Antananarivo';
const MAX      = process.argv[4] || '20';

function findChrome() {
  const p = os.platform();
  const candidates = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
    win32:  [
      'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      \`\${process.env.LOCALAPPDATA}\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe\`,
      'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
    ],
    linux:  ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser'],
  };
  for (const c of (candidates[p] || candidates.linux)) {
    if (fs.existsSync(c)) return c;
  }
  try {
    if (p === 'darwin') {
      const r = execSync('mdfind "kMDItemCFBundleIdentifier == com.google.Chrome"').toString().trim().split('\\n')[0];
      if (r) return path.join(r, 'Contents/MacOS/Google Chrome');
    }
    if (p === 'linux') return execSync('which google-chrome || which chromium-browser').toString().trim();
    if (p === 'win32') return execSync('where chrome.exe 2>nul').toString().trim().split('\\n')[0]?.trim();
  } catch (_) {}
  return null;
}

function isCDPActive() {
  return new Promise(resolve => {
    const req = http.get(\`\${CDP_URL}/json/version\`, { timeout: 2000 }, res => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function findChromeProfile() {
  const h = os.homedir(), p = os.platform();
  const paths = {
    darwin: [\`\${h}/Library/Application Support/Google/Chrome\`],
    win32:  [\`\${process.env.LOCALAPPDATA}\\\\Google\\\\Chrome\\\\User Data\`],
    linux:  [\`\${h}/.config/google-chrome\`],
  };
  return (paths[p] || paths.linux).find(x => fs.existsSync(x)) || null;
}

async function launchChromeWithCDP(chromePath) {
  const profile = findChromeProfile();
  const args = [\`--remote-debugging-port=\${CDP_PORT}\`, '--no-first-run', '--no-default-browser-check'];
  if (profile) args.push(\`--user-data-dir=\${profile}\`);
  if (os.platform() === 'win32') args.push('--window-position=0,0', '--window-size=1,1');
  const chrome = spawn(chromePath, args, { detached: true, stdio: 'ignore' });
  chrome.unref();
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isCDPActive()) return true;
  }
  return false;
}

async function main() {
  const cdpActive = await isCDPActive();
  if (!cdpActive) {
    const chromePath = findChrome();
    if (!chromePath) { process.stderr.write('Chrome introuvable\\n'); process.exit(1); }
    // Fermer Chrome existant
    try {
      if (os.platform() === 'darwin') execSync('pkill -f "Google Chrome" 2>/dev/null || true', { stdio: 'ignore' });
      else if (os.platform() === 'win32') execSync('taskkill /F /IM chrome.exe /T 2>nul', { stdio: 'ignore' });
      else execSync('pkill -f chrome 2>/dev/null || true', { stdio: 'ignore' });
    } catch (_) {}
    await new Promise(r => setTimeout(r, 1500));
    const launched = await launchChromeWithCDP(chromePath);
    if (!launched) { process.stderr.write('Impossible de démarrer Chrome avec CDP\\n'); process.exit(1); }
    await new Promise(r => setTimeout(r, 2000));
  }

  const child = spawn('node', [SCRAPER, QUERY, LOCATION, MAX], {
    stdio: 'inherit',
    env: { ...process.env, CDP_PORT: String(CDP_PORT) },
  });
  child.on('close', code => process.exit(code || 0));
  child.on('error', err => { process.stderr.write(err.message + '\\n'); process.exit(1); });
}

main().catch(err => { process.stderr.write(err.message + '\\n'); process.exit(1); });
`;
  fs.writeFileSync(dest, content, 'utf8');
}
