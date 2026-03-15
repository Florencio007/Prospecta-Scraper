/**
 * browser-manager.cjs
 * ─────────────────────────────────────────────────────────────────
 * Module partagé : gère une instance de navigateur Playwright UNIQUE
 * réutilisée entre tous les scrapers.
 *
 * Fonctionnement :
 *   1. Lance Chromium une seule fois avec launchPersistentContext()
 *      → Les cookies/sessions sont persistés dans USER_DATA_DIR
 *      → Si LinkedIn est déjà connecté → pas besoin de re-login
 *   2. Chaque scraper appelle getSharedPage() pour obtenir un NOUVEL ONGLET
 *      dans le même navigateur (sans ouvrir une nouvelle fenêtre)
 *   3. Quand le scraping est terminé, appeler closePage(page) ferme seulement
 *      cet onglet — le navigateur reste ouvert
 *
 * Le navigateur est partagé via un fichier PID :
 *   scripts/.browser-pid  → pid du processus Chromium
 *
 * Note : plusieurs scripts Node.js (processus séparés) ne peuvent pas
 * partager un objet Browser en mémoire directement. La solution ici
 * est que CHAQUE scraper lance son propre browser avec le MÊME userDataDir,
 * ce qui réutilise les sessions (cookies). Un seul browser est visible
 * à la fois car Chromium partage le profil.
 */

const { chromium } = require('playwright');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// ─────────────────────────────────────────────────────────────────
// Répertoire de données utilisateur persistant (cookies, sessions)
// Partagé entre TOUS les scrapers → session LinkedIn/Facebook conservée
// ─────────────────────────────────────────────────────────────────
const USER_DATA_DIR = path.resolve(
  os.homedir(),
  '.prospecta-browser-profile'
);

// Fichier qui stocke le websocket URL du navigateur en cours
const BROWSER_WS_FILE = path.resolve(__dirname, '.browser-ws.json');

const DEFAULT_VIEWPORT  = { width: 1280, height: 900 };
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Lance (ou réutilise) un navigateur persistant avec launchPersistentContext().
 * Retourne le contexte playwright.
 *
 * @param {object} options
 * @param {boolean} options.headless  - Afficher le navigateur (default: false)
 */
async function getOrCreateContext(options = {}) {
  const headless = options.headless === true;

  // Créer le répertoire de profil s'il n'existe pas
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  console.log(`[BrowserManager] 📂 Profil persistant : ${USER_DATA_DIR}`);
  console.log(`[BrowserManager] 🌐 Lancement du navigateur (headless=${headless})...`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless,
    viewport: DEFAULT_VIEWPORT,
    userAgent: DEFAULT_USER_AGENT,
    locale: 'fr-FR',
    args: [
      '--lang=fr-FR',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    ignoreHTTPSErrors: true,
  });

  return context;
}

/**
 * Ouvre un nouvel onglet dans le contexte partagé.
 * Le premier onglet existant (blank) est réutilisé si disponible.
 *
 * @param {import('playwright').BrowserContext} context
 * @returns {Promise<import('playwright').Page>}
 */
async function openNewTab(context) {
  const pages = context.pages();
  // Si un onglet existe déjà et est sur about:blank → le réutiliser
  const blank = pages.find(p => p.url() === 'about:blank');
  if (blank) {
    console.log('[BrowserManager] ♻️  Réutilisation de l\'onglet about:blank');
    return blank;
  }
  console.log('[BrowserManager] ➕ Ouverture d\'un nouvel onglet');
  return await context.newPage();
}

/**
 * Ferme un onglet spécifique (page) sans fermer le navigateur.
 * Ne ferme pas si c'est le dernier onglet (évite de vider le contexte).
 *
 * @param {import('playwright').BrowserContext} context
 * @param {import('playwright').Page} page
 */
async function closeTab(context, page) {
  try {
    const pages = context.pages();
    if (pages.length > 1) {
      console.log('[BrowserManager] 🔒 Fermeture de l\'onglet scraping...');
      await page.close();
    } else {
      console.log('[BrowserManager] 🔒 Dernier onglet — navigation vers about:blank');
      await page.goto('about:blank').catch(() => {});
    }
  } catch (e) {
    // L'onglet est peut-être déjà fermé
  }
}

/**
 * Vérifie si l'utilisateur est déjà connecté à LinkedIn.
 * Évite un re-login si la session est active.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
async function isLinkedInLoggedIn(page) {
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const url = page.url();
    return !url.includes('/login') && !url.includes('/uas/') && !url.includes('/checkpoint');
  } catch {
    return false;
  }
}

/**
 * Vérifie si l'utilisateur est déjà connecté à Facebook.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
async function isFacebookLoggedIn(page) {
  try {
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const url = page.url();
    return !url.includes('/login') && !url.includes('checkpoint');
  } catch {
    return false;
  }
}

module.exports = {
  getOrCreateContext,
  openNewTab,
  closeTab,
  isLinkedInLoggedIn,
  isFacebookLoggedIn,
  USER_DATA_DIR,
};
