const { chromium } = require('playwright');
const https = require('https');
const http = require('http');
const fs = require('fs');

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  PAPPERS.FR SCRAPER — PROSPECTA EDITION                     ║
 * ║  Playwright + Anti-Bot + API officielle (optionnel)         ║
 * ║  Compatible : emitLog / emitResult / CLI args               ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Usage : node scraper_pappers.cjs <query> <location> <limit> <apiToken> <type>
 *   type : "entreprise" | "dirigeant" | "tous"
 */

// ── Arguments CLI (ordre compatible avec app.js) ──────────────────────────────
const QUERY = process.argv[2] || 'hotel';
const LOCATION = process.argv[3] || '';
const MAX_RESULTS = parseInt(process.argv[4] || '10', 10);
const API_TOKEN = process.argv[5] || '';
const TYPE = process.argv[6] || 'entreprise'; // entreprise | dirigeant | tous

const CONFIG = {
  searchQuery: LOCATION ? `${QUERY} ${LOCATION}` : QUERY,
  rawQuery: QUERY,
  location: LOCATION,
  maxResults: MAX_RESULTS,
  apiToken: API_TOKEN,
  searchType: TYPE === 'dirigeant' ? 'directors' : TYPE === 'tous' ? 'all' : 'companies',
  headless: true,
  delayMin: 1200,
  delayMax: 2800,
  outputFile: 'last_pappers_results.json',
};

const BASE = 'https://www.pappers.fr';
const API_V2 = 'https://api.pappers.fr/v2';

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jitter = () => sleep(rand(CONFIG.delayMin, CONFIG.delayMax));
const fmt = n => (n != null ? Number(n).toLocaleString('fr-FR') + ' €' : '');

// ── Émetteurs Prospecta ───────────────────────────────────────────────────────
function emitLog(msg, pct = undefined) {
  console.log(msg);
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}

function emitResult(result) {
  process.stdout.write(`RESULT:${JSON.stringify(result)}\n`);
}

// ── HTTP helper (API officielle) ──────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer': 'https://www.pappers.fr/',
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        } else if (res.statusCode === 401) reject(new Error('Token invalide'));
        else if (res.statusCode === 402) reject(new Error('Crédits épuisés'));
        else if (res.statusCode === 429) reject(new Error('Rate limit'));
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
    }).on('error', reject);
  });
}

// ── Lancement navigateur anti-détection ──────────────────────────────────────
async function launchBrowser() {
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  ];
  const ua = userAgents[rand(0, userAgents.length - 1)];

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      `--window-size=${rand(1280, 1440)},${rand(800, 960)}`,
    ],
  });

  const context = await browser.newContext({
    userAgent: ua,
    locale: 'fr-FR',
    timezoneId: 'Indian/Antananarivo',
    geolocation: { longitude: 47.5079, latitude: -18.9101 },
    permissions: ['geolocation'],
    viewport: { width: rand(1280, 1440), height: rand(800, 960) },
    deviceScaleFactor: rand(1, 2),
    colorScheme: 'light',
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = {
      app: { isInstalled: false }, runtime: {},
      csi: () => { }, loadTimes: () => ({}),
    };
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const arr = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 0 },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 0 },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 0 },
        ];
        Object.defineProperty(arr, 'item', { get: () => i => arr[i] });
        return arr;
      },
    });
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => [4, 6, 8][Math.floor(Math.random() * 3)] });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => [4, 8, 16][Math.floor(Math.random() * 3)] });
    Object.defineProperty(screen, 'width', { get: () => 1440 });
    Object.defineProperty(screen, 'height', { get: () => 900 });
    Object.defineProperty(screen, 'availWidth', { get: () => 1440 });
    Object.defineProperty(screen, 'availHeight', { get: () => 860 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    // Canvas fingerprint noise
    const origGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...a) {
      const ctx = origGet.call(this, t, ...a);
      if (ctx && t === '2d') {
        const origFill = ctx.fillText.bind(ctx);
        ctx.fillText = (...args) => {
          origFill(...args);
          ctx.fillStyle = `rgba(${Math.floor(Math.random() * 5)},${Math.floor(Math.random() * 5)},${Math.floor(Math.random() * 5)},0.005)`;
          origFill(...args);
        };
      }
      return ctx;
    };
    const origQuery = window.navigator.permissions?.query?.bind(navigator.permissions);
    if (origQuery) {
      window.navigator.permissions.query = p =>
        p.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : origQuery(p);
    }
  });

  return { browser, context, page };
}

// ── Navigation humaine ────────────────────────────────────────────────────────
async function humanScroll(page, steps = 5) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, rand(300, 700));
    await sleep(rand(350, 900));
    if (i === Math.floor(steps / 2)) await sleep(rand(800, 2000));
  }
}

async function humanMoveMouse(page) {
  for (let i = 0; i < rand(2, 5); i++) {
    await page.mouse.move(rand(100, 1200), rand(100, 700), { steps: rand(5, 15) });
    await sleep(rand(100, 400));
  }
}

async function gotoHuman(page, url) {
  await humanMoveMouse(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(rand(1500, 3000));
  await humanScroll(page, rand(2, 4));
}

// ── Filtre anti-faux-positifs ─────────────────────────────────────────────────
// Retourne true si le résultat est un lien de navigation Pappers (pas une vraie fiche)
function isFakePappersResult(d) {
  const name = (d.name || '').toLowerCase().trim();
  const url = (d.sourceUrl || '').toLowerCase();
  if (name === 'www.pappers.fr' || name === 'pappers.fr' || name === 'pappers') return true;
  if (url === 'https://www.pappers.fr' || url === 'https://www.pappers.fr/') return true;
  if (!d.siren && name.length < 4) return true;
  // URL sans SIREN = fiche invalide
  if (d.sourceUrl && !d.sourceUrl.match(/-\d{9}$/) && !d.siren) return true;
  return false;
}

// ── Calcul du score lead ──────────────────────────────────────────────────────
function computeScore(d) {
  let score = 20; // base Pappers

  // Contact (+30 pts)
  if (d.telephone) score += 15;
  if (d.email) score += 15;

  // Données juridiques (+25 pts)
  if (d.siren) score += 5;
  if (d.numeroTVA) score += 5;
  if (d.capitalSocial) score += 5;
  if (d.formeJuridique) score += 5;
  if (d.dateCreation) score += 5;

  // Activité (+15 pts)
  if (d.activitePrincipale) score += 8;
  if (d.conventionCollective) score += 4;
  if (d.domaineActivite) score += 3;

  // Personnes & finances (+10 pts)
  if (d.dirigeants?.length) score += 5;
  if (d.finances?.length) score += 5;

  // Malus si radiée
  if (['Radiée', 'Inactive', 'Cessée'].includes(d.status)) score -= 20;

  return Math.max(0, Math.min(100, score));
}

// ── Construction payload Prospecta ────────────────────────────────────────────
function buildPayload(d) {
  // Rejeter silencieusement les faux positifs (liens de nav Pappers)
  if (isFakePappersResult(d)) return null;

  const summary = [
    d.name,
    d.activitePrincipale ? `Activité : ${d.activitePrincipale}` : '',
    d.formeJuridique ? `Forme : ${d.formeJuridique}` : '',
    d.dateCreation ? `Créée le ${d.dateCreation}` : '',
    d.effectif ? `Effectif : ${d.effectif}` : '',
    d.capitalSocial ? `Capital : ${d.capitalSocial}` : '',
    d.status ? `Statut : ${d.status}` : '',
  ].filter(Boolean).join(' · ');

  const score = computeScore(d);

  return {
    name: d.name || d.enseigne || 'Entreprise inconnue',
    company: d.name || d.enseigne || '',
    score,
    position: (() => {
      const first = Array.isArray(d.dirigeants) ? d.dirigeants[0] : null;
      if (!first) return '';
      return typeof first === 'string' ? first : (first.nom || '');
    })(),
    address: d.adresse || '',
    phone: d.telephone || '',
    email: d.email || '',
    website: d.website || d.siteWeb || '',
    source: 'pappers',
    platform: 'Pappers',
    mapsUrl: d.sourceUrl || '',
    socialLinks: d.socialLinks || {},

    contractDetails: {
      // Identité
      name: d.name || '',
      enseigne: d.enseigne || '',
      status: d.status || '',
      siren: d.siren || '',
      siret: d.siret || '',
      formeJuridique: d.formeJuridique || '',
      capitalSocial: d.capitalSocial || '',
      numeroTVA: d.numeroTVA || '',
      adresse: d.adresse || '',
      dateCreation: d.dateCreation || '',
      dateRadiation: d.dateRadiation || '',
      // Registres
      inscriptionRCS: d.inscriptionRCS || '',
      inscriptionRNE: d.inscriptionRNE || '',
      numeroRCS: d.numeroRCS || '',
      // Activité
      activitePrincipale: d.activitePrincipale || '',
      codeNAF: d.codeNAF || '',
      domaineActivite: d.domaineActivite || '',
      formeExercice: d.formeExercice || '',
      conventionCollective: d.conventionCollective || '',
      dateCloture: d.dateCloture || '',
      effectif: d.effectif || '',
      // Personnes & structure
      dirigeants: d.dirigeants || [],
      entreprisesDirigees: d.entreprisesDirigees || [],
      beneficiaires: d.beneficiaires || [],
      etablissements: d.etablissements || [],
      // Finances
      finances: d.finances || [],
      // Contact
      telephone: d.telephone || '',
      email: d.email || '',
      website: d.website || d.siteWeb || '',
      socialLinks: d.socialLinks || {},
      sourceUrl: d.sourceUrl || '',
      source: d.source || 'Pappers',
    },

    aiIntelligence: {
      activities: { posts: [], comments: [] },
      contactInfo: {
        phones: d.telephone ? [d.telephone] : [],
        emails: d.email ? [d.email] : [],
        addresses: d.adresse ? [d.adresse] : [],
      },
      executiveSummary: summary || 'Entreprise listée sur Pappers.',
      companyCulture: {
        mission: d.conventionCollective
          ? `Convention collective : ${d.conventionCollective}`
          : (d.activitePrincipale || ''),
      },
    },
  };
}

// ── Formateur API → payload ───────────────────────────────────────────────────
function formatApiCompany(r) {
  const s = r.siege || {};
  return buildPayload({
    name: r.nom_entreprise || r.denomination || '',
    enseigne: r.nom_commercial || '',
    status: r.etat === 'A' ? 'Active' : r.etat === 'C' ? 'Radiée' : (r.etat || ''),
    siren: r.siren || '',
    siret: s.siret || '',
    formeJuridique: r.forme_juridique || '',
    capitalSocial: fmt(r.capital),
    numeroTVA: r.numero_tva_intracomm || '',
    adresse: [s.adresse_ligne_1, s.adresse_ligne_2, s.code_postal, s.ville].filter(Boolean).join(', '),
    dateCreation: r.date_creation || '',
    dateRadiation: r.date_radiation || '',
    inscriptionRCS: r.numero_rcs || '',
    inscriptionRNE: '',
    numeroRCS: r.numero_rcs || '',
    activitePrincipale: r.libelle_code_naf || '',
    codeNAF: r.code_naf || '',
    domaineActivite: r.libelle_code_naf || '',
    formeExercice: '',
    conventionCollective: '',
    dateCloture: '',
    effectif: r.tranche_effectif_salarie || '',
    dirigeants: (r.dirigeants || []).map(d => ({
      nom: [d.prenom, d.nom].filter(Boolean).join(' ') || d.denomination || '',
      qualite: d.qualite || '',
      depuis: d.date_prise_de_poste || '',
    })),
    beneficiaires: (r.beneficiaires_effectifs || []).map(b => ({
      nom: [b.prenom, b.nom].filter(Boolean).join(' '),
      parts: b.pourcentage_parts != null ? `${b.pourcentage_parts}%` : '',
    })),
    finances: (r.finances || []).slice(0, 5).map(f => ({
      annee: f.annee || '',
      chiffreAffaires: fmt(f.chiffre_affaires),
      resultatNet: fmt(f.resultat),
      capitauxPropres: fmt(f.capitaux_propres),
      effectifs: f.effectifs || '',
    })),
    etablissements: (r.etablissements || []).slice(0, 5).map(e => ({
      siret: e.siret || '',
      type: e.siege ? 'Siège' : 'Secondaire',
      adresse: [e.adresse_ligne_1, e.code_postal, e.ville].filter(Boolean).join(', '),
      statut: e.etat_administratif === 'A' ? 'Actif' : 'Fermé',
    })),
    telephone: s.telephone || '',
    email: '',
    website: r.site_web || '',
    sourceUrl: `${BASE}/entreprise/${(r.nom_entreprise || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${r.siren}`,
    source: 'API Pappers v2',
  });
}

// ── Payload dirigeant ─────────────────────────────────────────────────────────
function buildDirectorPayload(d) {
  const name = d.nom || d.name || [d.prenom, d.nom_de_famille].filter(Boolean).join(' ') || '';
  return {
    name,
    company: d.mandats?.[0]?.denomination || d.entreprise?.nom || '',
    position: d.mandats?.[0]?.qualite || d.qualite || 'Dirigeant',
    address: '',
    phone: '',
    email: '',
    website: '',
    source: 'pappers',
    platform: 'Pappers',
    mapsUrl: d.url || '',

    contractDetails: {
      name,
      nationalite: d.nationalite || '',
      dateNaissance: d.dateNaissance || d.date_de_naissance || '',
      age: d.age || '',
      mandats: d.mandats || [],
      siren: d.entreprise?.siren || '',
      sourceUrl: d.url || '',
      source: d.source || 'Pappers',
    },

    aiIntelligence: {
      activities: { posts: [], comments: [] },
      contactInfo: { phones: [], emails: [], addresses: [] },
      executiveSummary: [
        name,
        d.mandats?.length ? `${d.mandats.length} mandat(s)` : '',
        d.mandats?.[0]?.qualite ? `Qualité : ${d.mandats[0].qualite}` : '',
        d.mandats?.[0]?.denomination ? `Entreprise : ${d.mandats[0].denomination}` : '',
      ].filter(Boolean).join(' · '),
      companyCulture: { mission: '' },
    },
  };
}

// ── MODE API OFFICIELLE ───────────────────────────────────────────────────────
async function apiRun() {
  emitLog('✅ Mode : API officielle Pappers v2', 5);
  try {
    const cr = await httpGet(`${API_V2}/suivi-jetons?api_token=${CONFIG.apiToken}`);
    emitLog(`💳 Crédits restants : ${cr.jetons_restants ?? '?'}`, 8);
  } catch { }

  const companies = [], directors = [];

  // Entreprises
  if (['companies', 'all'].includes(CONFIG.searchType)) {
    const p = new URLSearchParams({
      api_token: CONFIG.apiToken,
      q: CONFIG.searchQuery,
      par_page: String(CONFIG.maxResults),
      page: '1',
    });
    emitLog(`🔍 Recherche entreprises : "${CONFIG.searchQuery}"`, 10);
    const search = await httpGet(`${API_V2}/recherche?${p.toString()}`);
    const list = search.resultats || [];
    emitLog(`🏢 ${list.length} entreprise(s) trouvée(s)`, 20);

    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const pct = 20 + Math.floor((i / list.length) * 65);
      emitLog(`📋 [${i + 1}/${list.length}] ${r.nom_entreprise || r.siren}`, pct);
      try {
        const raw = await httpGet(
          `${API_V2}/entreprise?api_token=${CONFIG.apiToken}&siren=${r.siren}` +
          `&beneficiaires_effectifs=true&finances=true&dirigeants=true&etablissements=true`
        );
        const payload = formatApiCompany(raw);
        companies.push(payload);
        emitResult(payload);
      } catch (e) {
        emitLog(`❌ ${r.siren}: ${e.message}`, pct);
        companies.push({ name: r.nom_entreprise, siren: r.siren, error: e.message });
      }
      await sleep(rand(200, 500));
    }
  }

  // Dirigeants
  if (['directors', 'all'].includes(CONFIG.searchType)) {
    try {
      emitLog(`👤 Recherche dirigeants : "${CONFIG.rawQuery}"`, 88);
      const ds = await httpGet(
        `${API_V2}/recherche-dirigeants?api_token=${CONFIG.apiToken}` +
        `&q=${encodeURIComponent(CONFIG.rawQuery)}&par_page=${CONFIG.maxResults}`
      );
      (ds.resultats || []).forEach(d => {
        const payload = buildDirectorPayload(d);
        directors.push(payload);
        emitResult(payload);
      });
      emitLog(`👤 ${directors.length} dirigeant(s)`, 95);
    } catch (e) { emitLog(`⚠️ Dirigeants : ${e.message}`, 90); }
  }

  return { companies, directors };
}

// ── MODE PLAYWRIGHT ───────────────────────────────────────────────────────────
async function playwrightRun() {
  emitLog('⚙️  Mode : Playwright HTML (sans token API)', 5);

  const { browser, page } = await launchBrowser();
  const xhrCache = {};

  page.on('response', async response => {
    const url = response.url();
    if (!url.includes('api.pappers.fr')) return;
    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      const json = await response.json().catch(() => null);
      if (!json) return;
      if (json.siren) xhrCache[json.siren] = json;
      if (json.resultats) json.resultats.forEach(r => { if (r.siren) xhrCache[`s_${r.siren}`] = r; });
    } catch { }
  });

  const companies = [], directors = [];

  try {
    emitLog('🌐 Ouverture de Pappers...', 8);
    await gotoHuman(page, BASE);
    await sleep(rand(1000, 2000));

    // ── Entreprises ────────────────────────────────────────────────────────
    if (['companies', 'all'].includes(CONFIG.searchType)) {
      emitLog(`🔍 Recherche : "${CONFIG.searchQuery}"`, 10);
      await gotoHuman(page, `${BASE}/recherche?q=${encodeURIComponent(CONFIG.searchQuery)}`);
      await sleep(rand(2000, 3500));
      await humanScroll(page, rand(4, 6));

      const links = await page.evaluate(() => {
        const seen = new Set(), results = [];
        document.querySelectorAll('a[href*="/entreprise/"]').forEach(a => {
          const href = (a.href || '').split('?')[0];
          const siren = href.match(/-(\d{9})$/)?.[1] || '';
          if (!siren || seen.has(href)) return;
          seen.add(href);
          results.push({ url: href, siren, name: (a.textContent || '').trim().replace(/\s+/g, ' ') });
        });
        return results.slice(0, 30);
      });

      emitLog(`🏢 ${links.length} entreprise(s) trouvée(s)`, 20);

      for (let i = 0; i < Math.min(links.length, CONFIG.maxResults); i++) {
        const link = links[i];
        const pct = 20 + Math.floor((i / Math.min(links.length, CONFIG.maxResults)) * 65);
        emitLog(`📋 [${i + 1}/${Math.min(links.length, CONFIG.maxResults)}] ${link.name || link.siren}`, pct);

        if (xhrCache[link.siren]) {
          const payload = formatApiCompany(xhrCache[link.siren]);
          if (payload) { companies.push(payload); emitResult(payload); }
          await sleep(rand(300, 800));
          continue;
        }

        try {
          await humanMoveMouse(page);
          await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await sleep(rand(2000, 3500));
          await humanScroll(page, rand(5, 8));
          await sleep(rand(800, 1800));

          if (xhrCache[link.siren]) {
            const payload = formatApiCompany(xhrCache[link.siren]);
            if (payload) { companies.push(payload); emitResult(payload); }
          } else {
            const raw = await scrapeCompanyPage(page, link);
            const payload = buildPayload(raw);
            if (payload) { companies.push(payload); emitResult(payload); }
          }
        } catch (e) {
          emitLog(`❌ Fiche ${i + 1} : ${e.message}`, pct);
          companies.push({ name: link.name, siren: link.siren, error: e.message });
        }
        await jitter();
      }
    }

    // ── Dirigeants ─────────────────────────────────────────────────────────
    if (['directors', 'all'].includes(CONFIG.searchType)) {
      emitLog(`👤 Recherche dirigeants : "${CONFIG.rawQuery}"`, 88);
      await gotoHuman(page, `${BASE}/recherche-dirigeants?q=${encodeURIComponent(CONFIG.rawQuery)}`);
      await sleep(rand(2000, 3500));
      await humanScroll(page, rand(3, 5));

      const dirLinks = await page.evaluate(() => {
        const seen = new Set(), results = [];
        document.querySelectorAll('a[href*="/dirigeant/"]').forEach(a => {
          const href = (a.href || '').split('?')[0];
          if (seen.has(href)) return;
          seen.add(href);
          const cells = a.closest('tr, li')?.querySelectorAll('td') || [];
          results.push({ name: (a.textContent || '').trim().replace(/\s+/g, ' '), url: href, role: cells[1]?.textContent?.trim() || '' });
        });
        return results.filter(d => d.name);
      });

      emitLog(`👤 ${dirLinks.length} dirigeant(s) trouvé(s)`, 90);

      for (let i = 0; i < Math.min(dirLinks.length, CONFIG.maxResults); i++) {
        const d = dirLinks[i];
        try {
          await humanMoveMouse(page);
          await page.goto(d.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await sleep(rand(1800, 3000));
          await humanScroll(page, rand(3, 5));
          const detail = await scrapeDirPage(page, d);
          const payload = buildDirectorPayload(detail);
          directors.push(payload); emitResult(payload);
        } catch (e) {
          emitLog(`❌ Dirigeant ${i + 1} : ${e.message}`);
          directors.push({ name: d.name, url: d.url, error: e.message });
        }
        await jitter();
      }
    }

  } finally {
    await browser.close();
    emitLog('🏁 Navigateur fermé.');
  }

  return { companies, directors };
}

// ── Scraping fiche entreprise ─────────────────────────────────────────────────
async function scrapeCompanyPage(page, link) {
  return await page.evaluate(() => {

    function getByLabel(label) {
      for (const th of document.querySelectorAll('th')) {
        if (th.textContent?.trim().toLowerCase().includes(label.toLowerCase())) {
          const td = th.nextElementSibling || th.closest('tr')?.querySelector('td');
          if (td) return (td.textContent || '').trim().replace(/\s+/g, ' ');
        }
      }
      for (const dt of document.querySelectorAll('dt')) {
        if (dt.textContent?.trim().toLowerCase().includes(label.toLowerCase())) {
          const dd = dt.nextElementSibling;
          if (dd) return (dd.textContent || '').trim().replace(/\s+/g, ' ');
        }
      }
      const m = (document.body?.innerText || '').match(
        new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:?\\s*([^\\n]{2,120})', 'i')
      );
      return m ? m[1].trim() : '';
    }

    const bodyText = document.body?.innerText || '';

    const name = (document.querySelector('h1')?.textContent || '').trim();

    // Statut
    let status = '', dateRadiation = '';
    if (/inactive depuis le/i.test(bodyText)) {
      status = 'Inactive';
      const m = bodyText.match(/Inactive depuis le (\d{2}\/\d{2}\/\d{4})/i);
      if (m) dateRadiation = m[1];
    } else if (/en activité|active/i.test(bodyText)) {
      status = 'Active';
    } else if (/radi[eé]/i.test(bodyText)) {
      status = 'Radiée';
      const m = bodyText.match(/Radi[eé]e? le (\d{2}\/\d{2}\/\d{4})/i);
      if (m) dateRadiation = m[1];
    } else if (/cess[eé]/i.test(bodyText)) {
      status = 'Cessée';
    }

    const siren = getByLabel('SIREN').replace(/\s/g, '');
    const siret = (getByLabel('SIRET (siège)') || getByLabel('SIRET')).replace(/\s/g, '');
    const numeroTVA = (getByLabel('Numéro de TVA') || getByLabel('TVA')).replace(/\s/g, '');
    const formeJuridique = getByLabel('Forme juridique');
    const capitalSocial = getByLabel('Capital social') || getByLabel('Capital');
    const inscriptionRCS = getByLabel('Inscription au RCS') || getByLabel('RCS');
    const inscriptionRNE = getByLabel('Inscription au RNE') || getByLabel('RNE');
    const numeroRCS = getByLabel('Numéro RCS');
    const adresse = getByLabel('Adresse');
    const dateCreation = getByLabel('Création') || getByLabel('Date de création');
    const effectif = getByLabel('Effectif') || getByLabel('Effectifs');

    const activiteRaw = getByLabel('Activité principale déclarée') || getByLabel('Activité');
    const domaineActivite = getByLabel("Domaine d'activité") || getByLabel('Domaine');
    const formeExercice = getByLabel("Forme d'exercice");
    const conventionCollective = getByLabel('Convention collective');
    const dateCloture = getByLabel("Date de clôture d'exercice comptable") || getByLabel('Clôture');

    let codeNAF = '', activitePrincipale = activiteRaw;
    const nafMatch = activiteRaw.match(/^([0-9]{4}[A-Z])\s*[-–]\s*(.+)$/);
    if (nafMatch) { codeNAF = nafMatch[1]; activitePrincipale = nafMatch[2].trim(); }
    else { const nm = bodyText.match(/\b([0-9]{4}[A-Z])\b/); if (nm) codeNAF = nm[1]; }

    // ── Dirigeants et représentants ───────────────────────────────────────────
    // Structure réelle Pappers :
    // Pour chaque dirigeant, un bloc contient :
    //   <a href="/dirigeant/prenom-nom-...">Prenom Nom</a>   (lien avec date à droite)
    //   <p>Qualité</p>
    //   <p>63 ans - 09/1962</p>  (optionnel)
    //   <p>SIREN : 123456789</p>  (si personne morale)
    //   <p>Depuis le 27/10/2016</p>  ou  <p>Du XX/XX au XX/XX</p>
    // Le séparateur "Anciens dirigeants" sépare actifs/anciens
    const dirigeants = [], seenDirs = new Set();

    // Stratégie : parcourir TOUS les liens /dirigeant/ et /entreprise/ de la page
    // et remonter au bloc parent suffisamment haut pour avoir tout le contexte
    document.querySelectorAll('a[href*="/dirigeant/"], a[href*="/entreprise/"]').forEach(a => {
      const nom = (a.textContent || '').trim().replace(/\s+/g, ' ');
      if (!nom || seenDirs.has(nom) || nom.length < 2) return;

      // Vérifier qu'on est bien dans la section dirigeants (pas dans le menu nav)
      // en cherchant si un ancêtre contient "Dirigeants" dans son texte
      let parent = a.parentElement;
      let depth = 0;
      let inDirSection = false;
      while (parent && depth < 8) {
        const pt = parent.textContent || '';
        if (pt.includes('Dirigeants et représentants') || pt.includes('Anciens dirigeants')) {
          inDirSection = true;
          break;
        }
        parent = parent.parentElement;
        depth++;
      }
      if (!inDirSection) return;

      seenDirs.add(nom);
      const siren = (a.href || '').match(/-(\d{9})$/)?.[1] || '';

      // Remonter au bloc conteneur immédiat du dirigeant
      // Pappers : chaque dirigeant est dans un <div> ou <li> direct
      // On cherche le premier ancêtre qui contient "Depuis le" ou "Du XX au XX"
      let bloc = a.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!bloc) break;
        const bt = bloc.innerText || '';
        if (bt.includes('Depuis le') || bt.match(/Du \d{2}\/\d{2}/) || bt.match(/\d{2,3}\s+ans/)) break;
        bloc = bloc.parentElement;
      }
      const text = bloc?.innerText || a.parentElement?.innerText || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Index de la ligne contenant le nom
      const nomIdx = lines.findIndex(l =>
        l.replace(/\s+/g, ' ').toLowerCase().includes(nom.toLowerCase().substring(0, Math.min(nom.length, 12)))
      );

      // Qualité = ligne juste après le nom (avant les dates/âge)
      let qualite = '';
      if (nomIdx >= 0) {
        for (let j = nomIdx + 1; j < Math.min(nomIdx + 4, lines.length); j++) {
          const l = lines[j];
          // Ignorer si c'est une date ou un âge
          if (/^\d{2}\/\d{2}\/\d{4}/.test(l)) continue;
          if (/^Depuis le/i.test(l)) continue;
          if (/^Du \d/i.test(l)) continue;
          if (/^\d{2,3}\s+ans/i.test(l)) continue;
          if (/^SIREN\s*:/i.test(l)) continue;
          if (/^Suivre$/i.test(l)) continue;
          // C'est probablement la qualité
          qualite = l;
          break;
        }
      }

      // "Ancien" = présence de "Du XX/XX au XX/XX" ou dans la section "Anciens dirigeants"
      const duAuMatch = text.match(/Du (\d{2}\/\d{2}\/\d{4}) au (\d{2}\/\d{2}\/\d{4})/i);
      const depuisMatch = text.match(/Depuis le (\d{2}\/\d{2}\/\d{4})/i);
      const ageMatch = text.match(/(\d{2,3})\s+ans\s*[-–]\s*(\d{2}\/\d{4})/i);
      const sirenMatch = text.match(/SIREN\s*:\s*(\d+)/i);

      // Déterminer si ancien dirigeant
      // (si le bloc contient "Anciens dirigeants" avant ce dirigeant dans le texte de la section)
      const fullSectionText = document.body?.innerText || '';
      const ancienIdx = fullSectionText.indexOf('Anciens dirigeants');
      const nomInPageIdx = fullSectionText.indexOf(nom);
      const estAncien = duAuMatch !== null || (ancienIdx > -1 && nomInPageIdx > ancienIdx);

      dirigeants.push({
        nom,
        qualite: qualite || '',
        depuis: depuisMatch ? depuisMatch[1] : (duAuMatch ? `${duAuMatch[1]} → ${duAuMatch[2]}` : ''),
        dateDebut: depuisMatch ? depuisMatch[1] : (duAuMatch ? duAuMatch[1] : ''),
        dateFin: duAuMatch ? duAuMatch[2] : '',
        age: ageMatch ? `${ageMatch[1]} ans (${ageMatch[2]})` : '',
        siren: sirenMatch ? sirenMatch[1] : (siren || ''),
        actif: !estAncien,
        url: (a.href || '').split('?')[0],
        type: a.href?.includes('/entreprise/') ? 'personne_morale' : 'personne_physique',
      });
    });

    // ── Entreprises dirigées par ───────────────────────────────────────────────
    // Section "Entreprises dirigées par NOM"
    // Même approche : parcourir tous les liens /entreprise/ dans cette section
    const entreprisesDirigees = [];
    const seenEnts = new Set();

    document.querySelectorAll('a[href*="/entreprise/"]').forEach(a => {
      const href = (a.href || '').split('?')[0];
      const siren = href.match(/-(\d{9})$/)?.[1] || '';
      const nom = (a.textContent || '').trim().replace(/\s+/g, ' ');
      if (!nom || !siren || seenEnts.has(siren)) return;

      // Vérifier qu'on est dans la section "Entreprises dirigées par"
      let parent = a.parentElement;
      let depth = 0;
      let inEntSection = false;
      while (parent && depth < 8) {
        const pt = parent.textContent || '';
        if (pt.includes('Entreprises dirigées par') || pt.includes('Anciens mandats')) {
          inEntSection = true;
          break;
        }
        parent = parent.parentElement;
        depth++;
      }
      if (!inEntSection) return;

      seenEnts.add(siren);

      // Remonter au bloc conteneur
      let bloc = a.parentElement;
      for (let i = 0; i < 6; i++) {
        if (!bloc) break;
        const bt = bloc.innerText || '';
        if (bt.includes('Depuis le') || bt.match(/Du \d{2}\/\d{2}/) || bt.includes('Président') || bt.includes('Gérant')) break;
        bloc = bloc.parentElement;
      }
      const text = bloc?.innerText || a.parentElement?.innerText || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Qualité (Président, Gérant, DG...)
      const qualiteKeywords = ['Président', 'Gérant', 'Directeur général', 'Directeur', 'Administrateur', 'Associé', 'Liquidateur', 'PDG', 'DG'];
      let qualite = '';
      for (const l of lines) {
        if (qualiteKeywords.some(q => l.includes(q))) { qualite = l; break; }
      }

      const duAuMatch = text.match(/Du (\d{2}\/\d{2}\/\d{4}) au (\d{2}\/\d{2}\/\d{4})/i);
      const depuisMatch = text.match(/Depuis le (\d{2}\/\d{2}\/\d{4})/i);

      // Déterminer si ancien mandat (section "Anciens mandats")
      const fullText = document.body?.innerText || '';
      const ancienIdx = fullText.indexOf('Anciens mandats');
      const nomInPageIdx = fullText.indexOf(nom);
      const estAncien = duAuMatch !== null || (ancienIdx > -1 && nomInPageIdx > ancienIdx);

      entreprisesDirigees.push({
        nom,
        siren,
        qualite,
        depuis: depuisMatch ? depuisMatch[1] : (duAuMatch ? duAuMatch[1] : ''),
        dateFin: duAuMatch ? duAuMatch[2] : '',
        actif: !estAncien,
        url: href,
      });
    });

    // ── Établissements ─────────────────────────────────────────────────────────
    const etablissements = [];
    document.querySelectorAll('li[id*=".etablissement"]').forEach(li => {
      const id = li.getAttribute('id') || '';
      const siretEtab = id.replace('.etablissement', '').replace('siret-', '');
      const text = li.innerText || '';
      etablissements.push({
        siret: siretEtab,
        type: text.includes('principal') ? 'Principal' : 'Secondaire',
        dateCreation: text.match(/Date de cr[eé]ation\s*:\s*(\d{2}\/\d{2}\/\d{4})/)?.[1] || '',
        dateCloture: text.match(/Date de cl[oô]ture\s*:\s*(\d{2}\/\d{2}\/\d{4})/)?.[1] || '',
        statut: text.match(/Date de cl[oô]ture/)?.[0] ? 'Fermé' : 'Actif',
      });
    });

    // ── Finances ───────────────────────────────────────────────────────────────
    const finances = [];
    document.querySelectorAll('table tbody tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      const year = cells[0]?.textContent?.trim();
      if (!year || !/^20\d{2}$/.test(year)) return;
      finances.push({
        annee: year,
        chiffreAffaires: cells[1]?.textContent?.trim() || '',
        resultatNet: cells[2]?.textContent?.trim() || '',
        effectifs: cells[3]?.textContent?.trim() || '',
      });
    });

    // ── Contact (section "Comment contacter") ─────────────────────────────────
    // Pappers affiche "Réservé aux utilisateurs connectés" pour tel/email
    // → on scrape quand même l'adresse, le site, et les réseaux sociaux
    let telephone = '', email = '', website = '';
    const contactSection = Array.from(document.querySelectorAll('section, div, article')).find(
      el => el.textContent?.includes('Comment contacter')
    );
    if (contactSection) {
      const ct = contactSection.innerText || '';
      // Téléphone (si visible)
      const telMatch = ct.match(/(?:0|\+33\s?)[1-9](?:[\s.\-]?\d{2}){4}/);
      if (telMatch) telephone = telMatch[0].trim();
      // Email (si visible)
      const emailMatch = ct.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,}/);
      if (emailMatch) email = emailMatch[0];
      // Site web (ligne "Site internet :")
      const siteMatch = ct.match(/Site internet\s*:\s*([^\n]+)/i);
      if (siteMatch && !siteMatch[1].includes('Non disponible') && !siteMatch[1].includes('Réservé')) {
        website = siteMatch[1].trim();
      }
      // Adresse complète (ligne "Adresse complète :")
    }

    // Fallback téléphone/email sur toute la page
    if (!telephone) {
      const telPage = bodyText.match(/(?:0|\+33\s?)[1-9](?:[\s.\-]?\d{2}){4}/);
      if (telPage) telephone = telPage[0].trim();
    }
    if (!email) {
      const emailPage = bodyText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,}/);
      if (emailPage) email = emailPage[0];
    }
    if (!website) {
      website = Array.from(document.querySelectorAll('a[href^="http"]'))
        .map(a => a.href)
        .find(h =>
          !h.includes('pappers.fr') && !h.includes('google') &&
          !h.includes('infogreffe') && !h.includes('sirene.insee') &&
          !h.includes('europa.eu') && !h.includes('bodacc')
        ) || '';
    }

    // Réseaux sociaux (icônes LinkedIn, Facebook, Twitter dans la section contact)
    const socialLinks = {};
    if (contactSection) {
      const linkedinEl = contactSection.querySelector('a[href*="linkedin.com"]');
      const facebookEl = contactSection.querySelector('a[href*="facebook.com"]');
      const twitterEl = contactSection.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
      if (linkedinEl) socialLinks.linkedin = linkedinEl.href;
      if (facebookEl) socialLinks.facebook = facebookEl.href;
      if (twitterEl) socialLinks.twitter = twitterEl.href;
    }

    return {
      name, status, dateRadiation,
      siren, siret, numeroTVA, formeJuridique, capitalSocial,
      inscriptionRCS, inscriptionRNE, numeroRCS,
      adresse, dateCreation, effectif,
      activitePrincipale, codeNAF, domaineActivite,
      formeExercice, conventionCollective, dateCloture,
      dirigeants: dirigeants.slice(0, 20),
      entreprisesDirigees: entreprisesDirigees.slice(0, 20),
      etablissements,
      finances: finances.slice(0, 5),
      telephone, email, website, socialLinks,
      sourceUrl: window.location.href,
      source: 'HTML Playwright',
    };
  });
}

// ── Scraping fiche dirigeant ──────────────────────────────────────────────────
async function scrapeDirPage(page, link) {
  const result = await page.evaluate(() => {
    const bodyText = document.body?.innerText || '';
    const rx = pat => (bodyText.match(new RegExp(pat, 'i'))?.[1] || '').trim();

    const nom = (document.querySelector('h1')?.textContent || '').trim();
    const nationalite = rx('Nationalit[eé]\\s*[:\\-]?\\s*([^\\n]{3,40})');
    const naissance = rx('(?:N[eé]e?\\s+le|Date de naissance)\\s*[:\\-]?\\s*([^\\n]{5,30})');
    const age = rx('\\b(\\d{2})\\s+ans\\b');

    const mandats = [], seen = new Set();
    document.querySelectorAll('a[href*="/entreprise/"]').forEach(a => {
      const href = (a.href || '').split('?')[0];
      if (seen.has(href)) return;
      seen.add(href);
      const siren = href.match(/-(\d{9})$/)?.[1] || '';
      const nomE = (a.textContent || '').trim().replace(/\s+/g, ' ');
      if (!nomE) return;
      const cells = a.closest('tr, li')?.querySelectorAll('td') || [];
      mandats.push({
        denomination: nomE,
        siren,
        qualite: cells[1]?.textContent?.trim() || '',
        dateDebut: cells[2]?.textContent?.trim() || '',
        dateFin: cells[3]?.textContent?.trim() || '',
        statut: cells[4]?.textContent?.trim() || '',
        url: href,
      });
    });

    return { nom, nationalite, naissance, age, mandats };
  });

  return {
    nom: result.nom || link.name || '',
    nationalite: result.nationalite || '',
    dateNaissance: result.naissance || '',
    age: result.age ? `${result.age} ans` : '',
    mandats: result.mandats || [],
    source: 'HTML Playwright',
    url: link.url,
  };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  emitLog('🚀 Démarrage du scraper Pappers...', 0);
  emitLog(`📋 Requête : "${CONFIG.searchQuery}" | Limite : ${CONFIG.maxResults} | Type : ${TYPE}`, 2);

  const useApi = Boolean(CONFIG.apiToken && CONFIG.apiToken.length > 5);
  emitLog(useApi ? '🔑 Token API détecté → mode API' : '🌐 Pas de token → mode Playwright', 4);

  let companies = [], directors = [];

  try {
    const result = useApi ? await apiRun() : await playwrightRun();
    companies = result.companies;
    directors = result.directors;
  } catch (err) {
    emitLog(`💥 Erreur fatale : ${err.message}`, 99);
  }

  emitLog(`🏁 Terminé. ${companies.length} entreprise(s), ${directors.length} dirigeant(s).`, 100);

  fs.writeFileSync(CONFIG.outputFile, JSON.stringify({
    scrapedAt: new Date().toISOString(),
    query: CONFIG.searchQuery,
    mode: useApi ? 'API officielle v2' : 'Playwright HTML',
    total: companies.length + directors.length,
    companies,
    directors,
  }, null, 2), 'utf8');
}

main().catch(err => {
  emitLog(`💥 ${err.message}`, 99);
  console.error(err.stack);
  process.exit(1);
});
