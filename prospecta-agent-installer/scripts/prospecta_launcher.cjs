#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 *  LAUNCHER AUTOMATIQUE — Prospecta Scraper
 *  Gère tout automatiquement :
 *  1. Détecte Chrome sur le système
 *  2. Vérifie si CDP est déjà actif
 *  3. Si non → redémarre Chrome avec CDP en arrière-plan
 *  4. Lance le scraper connecté au Chrome existant
 *  5. Aucune action requise de l'utilisateur
 * ═══════════════════════════════════════════════════════════════════════
 */

const { spawn, execSync, exec } = require('child_process');
const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');

const CDP_PORT   = 9222;
const CDP_URL    = `http://localhost:${CDP_PORT}`;
const SCRAPER    = path.join(__dirname, 'scraper_google_search_complet.cjs');

// Arguments passés au launcher → transmis au scraper
const QUERY      = process.argv[2] || 'hotel';
const LOCATION   = process.argv[3] || 'Antananarivo';
const MAX        = process.argv[4] || '20';

// ── Trouver le chemin de Chrome sur le système ─────────────────────────────
function findChrome() {
  const platform = os.platform();

  const candidates = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      `${os.homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      'C:\\Program Files\\Chromium\\Application\\chrome.exe',
      // Edge comme fallback
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/usr/bin/microsoft-edge',
    ],
  };

  const paths = candidates[platform] || candidates.linux;
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        console.log(`✅ Chrome trouvé : ${p}`);
        return p;
      }
    } catch (_) {}
  }

  // Tentative via commande système
  try {
    if (platform === 'darwin') {
      const r = execSync('mdfind "kMDItemCFBundleIdentifier == com.google.Chrome"').toString().trim().split('\n')[0];
      if (r) return path.join(r, 'Contents/MacOS/Google Chrome');
    }
    if (platform === 'linux') {
      const r = execSync('which google-chrome || which chromium-browser || which chromium').toString().trim();
      if (r) return r;
    }
    if (platform === 'win32') {
      const r = execSync('where chrome.exe 2>nul || where msedge.exe 2>nul').toString().trim().split('\n')[0];
      if (r) return r.trim();
    }
  } catch (_) {}

  return null;
}

// ── Vérifier si CDP est déjà actif ────────────────────────────────────────
function isCDPActive() {
  return new Promise(resolve => {
    const req = http.get(`${CDP_URL}/json/version`, { timeout: 2000 }, res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ── Trouver le profil Chrome existant (pour garder la session) ────────────
function findChromeProfile() {
  const platform = os.platform();
  const home     = os.homedir();

  const profilePaths = {
    darwin: [
      `${home}/Library/Application Support/Google/Chrome`,
      `${home}/Library/Application Support/Chromium`,
    ],
    win32: [
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data`,
      `${process.env.LOCALAPPDATA}\\Chromium\\User Data`,
    ],
    linux: [
      `${home}/.config/google-chrome`,
      `${home}/.config/chromium`,
    ],
  };

  const paths = profilePaths[platform] || profilePaths.linux;
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── Tuer les instances Chrome existantes (pour pouvoir relancer avec CDP) ─
function killChrome() {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      execSync('pkill -f "Google Chrome" 2>/dev/null || true', { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execSync('taskkill /F /IM chrome.exe /T 2>nul & taskkill /F /IM msedge.exe /T 2>nul', { stdio: 'ignore' });
    } else {
      execSync('pkill -f chrome 2>/dev/null || pkill -f chromium 2>/dev/null || true', { stdio: 'ignore' });
    }
    return new Promise(r => setTimeout(r, 1500)); // attendre la fermeture
  } catch (_) {
    return Promise.resolve();
  }
}

// ── Lancer Chrome avec CDP en arrière-plan ────────────────────────────────
async function launchChromeWithCDP(chromePath) {
  const profileDir = findChromeProfile();
  const platform   = os.platform();

  console.log('🚀 Lancement de Chrome avec CDP...');
  if (profileDir) console.log(`   📂 Profil existant : ${profileDir}`);

  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions-except',
    '--start-maximized',
  ];

  // Utiliser le profil existant pour garder la session Google
  if (profileDir) {
    args.push(`--user-data-dir=${profileDir}`);
  }

  // Sur Windows, ouvrir minimisé pour ne pas déranger
  if (platform === 'win32') args.push('--window-position=0,0', '--window-size=1,1');

  const chrome = spawn(chromePath, args, {
    detached : true,
    stdio    : 'ignore',
    windowsHide: false,
  });
  chrome.unref();

  // Attendre que CDP soit prêt (max 15 secondes)
  console.log('⏳ Attente de Chrome...');
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isCDPActive()) {
      console.log('✅ Chrome prêt !');
      return true;
    }
  }
  return false;
}

// ── Lancer le scraper ─────────────────────────────────────────────────────
function runScraper() {
  return new Promise((resolve, reject) => {
    console.log(`\n🕷️  Lancement du scraper : "${QUERY}" "${LOCATION}" (max ${MAX})\n`);

    const child = spawn('node', [SCRAPER, QUERY, LOCATION, MAX], {
      stdio: 'inherit',
      env  : { ...process.env, CDP_PORT: String(CDP_PORT) },
    });

    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Scraper terminé avec code ${code}`));
    });
    child.on('error', reject);
  });
}

// ── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║            PROSPECTA — Launcher Automatique               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(`🔎 Recherche : "${QUERY}" à "${LOCATION}" — ${MAX} résultats\n`);

  // Étape 1 : CDP déjà actif ?
  const cdpActive = await isCDPActive();

  if (cdpActive) {
    console.log(`✅ Chrome déjà ouvert avec CDP (port ${CDP_PORT}) — connexion directe\n`);
  } else {
    // Étape 2 : Trouver Chrome
    const chromePath = findChrome();
    if (!chromePath) {
      console.error('❌ Chrome introuvable sur ce système.');
      console.error('   Installez Google Chrome : https://www.google.com/chrome/');
      process.exit(1);
    }

    // Étape 3 : Chrome est ouvert sans CDP ? Le redémarrer avec CDP
    console.log('🔄 Redémarrage de Chrome avec CDP...');
    await killChrome();
    await new Promise(r => setTimeout(r, 1000));

    const launched = await launchChromeWithCDP(chromePath);
    if (!launched) {
      console.error('❌ Impossible de démarrer Chrome avec CDP.');
      console.error('   Essayez manuellement :');
      console.error(`   ${chromePath} --remote-debugging-port=${CDP_PORT}`);
      process.exit(1);
    }

    // Laisser Chrome se stabiliser
    await new Promise(r => setTimeout(r, 2000));
  }

  // Étape 4 : Lancer le scraper
  await runScraper();
}

main().catch(err => {
  console.error('\n❌ Erreur fatale :', err.message);
  process.exit(1);
});
