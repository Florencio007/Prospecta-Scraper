/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║      PROSPECTA — Scraper Pappers.fr  (Playwright v2.0)         ║
 * ║      Entreprises · Dirigeants · Finances · Actes · BODACC      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// Initialisation des dépendances pour le scraping et les appels API
const { chromium } = require('playwright');
const https = require('https');
const http = require('http');
const fs = require('fs');
const readline = require('readline');

function emitLog(msg, pct = undefined) {
  // Console log pour l'exécution locale
  console.log(msg);
  // Envoi vers le frontend (SSE) afin d'être capté par le terminal Prospecta
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}
function emitResult(data) {
  process.stdout.write(`RESULT:${JSON.stringify(data)}\n`);
}

// ─── CONFIGURATION CLI ────────────────────────────────────────────────────────
// Récupération des arguments : requête, localisation, limite, token API
const [,, argQuery, argLocation, argMax, argToken] = process.argv;

const CONFIG = {
  mode: 'entreprise',
  query: argQuery || 'Gadait international',
  location: argLocation || '',
  maxResults: parseInt(argMax || '5'),
  apiToken: argToken || '', // Utilisé si un token valide est fourni
  headless: false, // Modification pour voir la progression
  delay: 2500,
  outputFile: 'pappers-results.json',
};

const BASE = 'https://www.pappers.fr';
const API_V2 = 'https://api.pappers.fr/v2';
// Fonctions utilitaires
const sleep = ms => new Promise(r => setTimeout(r, ms + Math.floor(Math.random() * 400)));



/**
 * Transforme un objet brut Pappers (API ou HTML) en objet Prospect standard
 */
function formatToProspect(r, isApi = false) {
  if (isApi) {
    // Mapping pour les données issues de l'API JSON
    const s = r.siege || {};
    return {
      id: r.siren || Math.random().toString(36).substr(2, 9),
      name: r.nom_entreprise || r.denomination || 'N/A',
      email: r.email || s.email || null,
      phone: r.telephone || s.telephone || null,
      company: r.nom_entreprise || r.denomination || null,
      role: r.dirigeants?.[0]?.nom || null,
      location: r.ville || s.ville || null,
      website: r.site_web || null,
      source_platform: 'pappers',
      socialLinks: {},
      aiIntelligence: {
        activities: { posts: [], comments: [] },
        skills: [],
        experience: (r.finances || []).map(f => ({
          company: r.nom_entreprise || r.denomination,
          role: `CA: ${f.chiffre_affaires || '?'} | Result: ${f.resultat || '?'}`,
          duration: f.annee || '?'
        })),
        education: [],
        certifications: [],
        recommendations: []
      },
      contractDetails: {
        siren: r.siren,
        siret: s.siret || r.siret_siege,
        tva: r.numero_tva_intracomm || r.tva_intracom,
        legalForm: r.forme_juridique,
        capital: r.capital || r.capital_social,
        activity: r.libelle_code_naf || r.libelle_naf,
        status: r.etat === 'A' ? 'Active' : (r.statut || 'N/A'),
        creationDate: r.date_creation,
        employees: r.tranche_effectif_salarie || r.effectifs
      }
    };
  } else {
    // Mapping pour les données extraites directement du HTML (sans API)
    return {
      id: r.siren || Math.random().toString(36).substr(2, 9),
      name: r.denomination || 'N/A',
      email: r.email || null,
      phone: r.telephone || null,
      company: r.denomination || null,
      role: r.dirigeants?.[0]?.nom || null,
      location: r.ville || r.adresse || r.code_postal || null,
      website: r.site_web || null,
      source_platform: 'pappers',
      socialLinks: {},
      aiIntelligence: {
        activities: { posts: [], comments: [] },
        skills: [],
        experience: (r.finances || []).map(f => ({
          company: r.denomination,
          role: `CA: ${f.chiffreAffaires || '?'} | Result: ${f.resultatNet || '?'}`,
          duration: f.annee || '?'
        })),
        education: [],
        certifications: [],
        recommendations: []
      },
      contractDetails: {
        siren: r.siren,
        siret: r.siret_siege,
        tva: r.tva_intracom,
        legalForm: r.forme_juridique,
        capital: r.capital_social,
        activity: r.libelle_naf,
        status: r.statut,
        creationDate: r.date_creation,
        employees: r.effectifs
      }
    };
  }
}

// ─── HTTP helper pour l'API ───────────────────────────────────────────────────
/**
 * Petit helper pour effectuer des requêtes GET HTTP/HTTPS simples
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        } else reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      });
    }).on('error', reject);
  });
}

/**
 * Exécution via l'API officielle de Pappers (recommandé si token fourni)
 */
async function apiRun() {
  emitLog('🛰️ Inscription à la passerelle API Pappers...', 10);
  try {
    const search = await httpGet(`${API_V2}/recherche?api_token=${CONFIG.apiToken}&q=${encodeURIComponent(CONFIG.query + ' ' + CONFIG.location)}&par_page=${CONFIG.maxResults}`);
    const list = search.resultats || [];
    emitLog(`\n── RÉSULTATS API ──────────────────────────────────────\n`, 15);
    emitLog(`✨ ${list.length} entreprises trouvées via le registre API.`);

    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const currentPct = 15 + Math.round(((i + 1) / list.length) * 85);
      emitLog(`   🏢 [${i+1}/${list.length}] ${r.denomination || r.siren}`, currentPct);
      try {
        const raw = await httpGet(`${API_V2}/entreprise?api_token=${CONFIG.apiToken}&siren=${r.siren}&finances=true&dirigeants=true`);
        emitResult(formatToProspect(raw, true));
      } catch (e) {
        emitLog(`Erreur API sur ${r.siren}: ${e.message}`);
      }
      await sleep(300);
    }
  } catch (e) {
    emitLog(`Erreur fatale lors de l'appel API: ${e.message}`);
  }
}

/**
 * Exécution via Playwright (Scraping HTML) si aucun token API n'est disponible
 */
async function playwrightRun() {
  emitLog('🛰️ Initialisation de la session Pappers (Simulateur)...', 10);
  const browser = await chromium.launch({ headless: CONFIG.headless });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    const searchUrl = `${BASE}/recherche?q=${encodeURIComponent(CONFIG.query + ' ' + CONFIG.location)}`;
    emitLog(`\n── ANALYSE DU REGISTRE ────────────────────────────────\n`, 15);
    emitLog(`🔍 Indexation sur ${BASE}...`);
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    await sleep(2000);

    // Extraction des liens vers les fiches entreprises
    const links = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('a[href*="/entreprise/"]').forEach(a => {
            const sirenMatch = a.href.match(/-(\d{9})$/);
            // On limite la liste initiale avant filtrage
            if (items.length < 15) items.push({ url: a.href, siren: sirenMatch?.[1] || '' });
        });
        return items;
    });

    emitLog(`✨ ${links.length} fiches entreprises détectées dans l'index.`, 25);
    emitLog(`\n── EXTRACTION DÉTAILLÉE ────────────────────────────────\n`);

    // Boucle de visite de chaque fiche
    for (let i = 0; i < Math.min(links.length, CONFIG.maxResults); i++) {
        const link = links[i];
        const currentPct = 25 + Math.round(((i + 1) / Math.min(links.length, CONFIG.maxResults)) * 70);
        emitLog(`   🏢 [${i+1}/${CONFIG.maxResults}] ${link.siren}`, currentPct);
        const p2 = await context.newPage();
        try {
            await p2.goto(link.url, { waitUntil: 'domcontentloaded' });
            await sleep(1500);
            
            // Extraction des données clés via JS injecté
            const data = await p2.evaluate(() => {
                const bodyText = document.body.innerText;
                const rx = pat => bodyText.match(new RegExp(pat, 'i'))?.[1]?.trim() || '';
                return {
                    denomination: document.querySelector('h1')?.textContent?.trim() || '',
                    siren: rx('SIREN\\s*[\\s:-]*(\\d{3}\\s*\\d{3}\\s*\\d{3})').replace(/\s/g, ''),
                    forme_juridique: rx('Forme juridique\\s*[\\s:-]*([^\\n]+)'),
                    statut: bodyText.includes('En activité') ? 'En activité' : 'N/A',
                    code_postal: rx('\\b(\\d{5})\\b'),
                    libelle_naf: rx('\\b([0-9]{4}[A-Z])\\b'),
                    dirigeants: Array.from(document.querySelectorAll('a[href*="/dirigeant/"]')).map(a => ({ nom: a.textContent.trim() }))
                };
            });
            // Envoi du résultat converti
            emitResult(formatToProspect(data, false));
        } catch (e) {
            emitLog(`Erreur sur la fiche ${link.siren}: ${e.message}`);
        } finally {
            await p2.close();
        }
        await sleep(CONFIG.delay);
    }
  } catch (err) {
    emitLog(`Erreur critique durant le scraping : ${err.message}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  emitLog(`🚀 Pappers Scraper — mode complet\n auditionné par Prospecta\n`, 5);
  emitLog(`🏢 Cible : "${CONFIG.query}"\n📍 Localisation : "${CONFIG.location}"\n`, 7);

  if (CONFIG.apiToken && CONFIG.apiToken.length > 5) {
    await apiRun();
  } else {
    await playwrightRun();
  }
  emitLog(`\n── SYNTHÈSE ───────────────────────────────────────────\n`);
  emitLog('✅ Extraction Pappers terminée avec succès.', 100);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
