/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║      PROSPECTA — Scraper Pappers.fr  (Playwright v3.0 FULL EXTRACT)    ║
 * ║      Entreprises · Dirigeants · Finances · Actes · BODACC · Contacts   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

const { chromium } = require('playwright');
const https = require('https');
const http = require('http');
const fs = require('fs');

function emitLog(msg, pct = undefined) {
  console.log(msg);
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}
function emitResult(data) {
  process.stdout.write(`RESULT:${JSON.stringify(data)}\n`);
}

// ─── CONFIGURATION CLI ────────────────────────────────────────────────────────
const [, , argQuery, argLocation, argMax, argToken] = process.argv;

const CONFIG = {
  query: argQuery || 'hotel',
  location: argLocation || '',
  maxResults: parseInt(argMax || '5'),
  apiToken: argToken || '',
  headless: true,
  delay: 2500,
  outputFile: 'pappers-results.json',
};

const BASE = 'https://www.pappers.fr';
const API_V2 = 'https://api.pappers.fr/v2';
const sleep = ms => new Promise(r => setTimeout(r, ms + Math.floor(Math.random() * 400)));

// ─── HTTP helper ──────────────────────────────────────────────────────────────
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

// ─── FORMAT PROSPECT ─────────────────────────────────────────────────────────
function formatToProspect(r, isApi = false) {
  if (isApi) {
    const s = r.siege || {};
    const dirigeants = (r.dirigeants || []).map(d => ({
      nom: d.nom || '',
      prenom: d.prenom || '',
      fonction: d.fonction || d.qualite || '',
      dateNaissance: d.date_naissance_formate || '',
      nationalite: d.nationalite || '',
      siren: d.siren || '',
    }));
    const finances = (r.finances || []).map(f => ({
      annee: f.annee,
      chiffreAffaires: f.chiffre_affaires,
      resultatNet: f.resultat,
      effectifs: f.effectifs,
      ebitda: f.ebitda,
      dette: f.dette_nette,
      tresorerie: f.tresorerie,
    }));
    const beneficiaires = (r.beneficiaires_effectifs || []).map(b => ({
      nom: b.nom || '',
      prenom: b.prenom || '',
      dateNaissance: b.date_naissance_formate || '',
      nationalite: b.nationalite || '',
      pourcentageParts: b.pourcentage_parts || '',
    }));

    return {
      id: r.siren || Math.random().toString(36).substr(2, 9),
      // ── Identité principale
      name: r.nom_entreprise || r.denomination || 'N/A',
      denomination: r.denomination,
      sigle: r.sigle || null,
      company: r.nom_entreprise || r.denomination || null,
      // ── Contact
      email: r.email || s.email || null,
      phone: r.telephone || s.telephone || null,
      website: r.site_web || null,
      // ── Adresse siège
      location: s.ville || r.ville || null,
      adresse: [s.adresse_ligne_1, s.adresse_ligne_2, s.code_postal, s.ville, s.pays]
        .filter(Boolean).join(', '),
      codePostal: s.code_postal || null,
      ville: s.ville || null,
      pays: s.pays || null,
      // ── Identifiants légaux
      siren: r.siren || null,
      siret: s.siret || r.siret_siege || null,
      tva: r.numero_tva_intracomm || r.tva_intracom || null,
      rcs: r.numero_rcs || null,
      // ── Infos juridiques
      formeJuridique: r.forme_juridique || null,
      capital: r.capital || r.capital_social || null,
      deviseCapital: r.devise_capital || 'EUR',
      dateCreation: r.date_creation || null,
      dateClotureFiscale: r.date_cloture_exercice || null,
      statut: r.etat === 'A' ? 'En activité' : (r.statut || 'N/A'),
      // ── Activité
      codeNaf: r.code_naf || null,
      libelleNaf: r.libelle_code_naf || r.libelle_naf || null,
      domaine: r.domaine_activite || null,
      // ── Effectifs
      employees: r.tranche_effectif_salarie || r.effectifs || null,
      // ── Personnes clés
      dirigeants,
      beneficiaires,
      // ── Finances
      finances,
      dernierCA: finances[0]?.chiffreAffaires || null,
      dernierResultat: finances[0]?.resultatNet || null,
      // ── Établissements
      nbEtablissements: r.nombre_etablissements || null,
      etablissements: (r.etablissements || []).map(e => ({
        siret: e.siret,
        siretSiege: e.siret_siege,
        ville: e.ville,
        codePostal: e.code_postal,
        activite: e.libelle_code_naf,
        statut: e.etat === 'A' ? 'En activité' : 'Fermé',
      })),
      // ── Documents & Actes
      dernierActe: r.derniers_statuts?.date_depot || null,
      // ── Source
      source_platform: 'pappers',
      sourceUrl: `${BASE}/entreprise/${r.nom_entreprise?.toLowerCase().replace(/\s+/g, '-')}-${r.siren}`,
      socialLinks: {},
      // ── Historique complet pour l'onglet aiIntelligence
      aiIntelligence: {
        activities: { posts: [], comments: [] },
        skills: [],
        experience: finances.map(f => ({
          company: r.nom_entreprise || r.denomination,
          role: `CA: ${f.chiffreAffaires ?? '?'} € | Résultat: ${f.resultatNet ?? '?'} € | Effectifs: ${f.effectifs ?? '?'}`,
          duration: String(f.annee ?? '?'),
        })),
        education: [],
        certifications: [],
        recommendations: [],
      },
      contractDetails: {
        siren: r.siren,
        siret: s.siret || r.siret_siege,
        tva: r.numero_tva_intracomm || r.tva_intracom,
        legalForm: r.forme_juridique,
        capital: r.capital || r.capital_social,
        activity: r.libelle_code_naf || r.libelle_naf,
        status: r.etat === 'A' ? 'En activité' : (r.statut || 'N/A'),
        creationDate: r.date_creation,
        employees: r.tranche_effectif_salarie || r.effectifs,
      },
    };
  } else {
    // ── Mapping HTML ──────────────────────────────────────────────────────────
    return {
      id: r.siren || Math.random().toString(36).substr(2, 9),
      name: r.denomination || 'N/A',
      denomination: r.denomination,
      sigle: r.sigle || null,
      company: r.denomination || null,
      email: r.email || null,
      phone: r.telephone || null,
      website: r.siteWeb || null,
      location: r.ville || r.adresse || null,
      adresse: r.adresseComplete || null,
      codePostal: r.codePostal || null,
      ville: r.ville || null,
      pays: r.pays || null,
      siren: r.siren || null,
      siret: r.siret || null,
      tva: r.tvaIntracom || null,
      rcs: r.rcs || null,
      formeJuridique: r.formeJuridique || null,
      capital: r.capital || null,
      deviseCapital: 'EUR',
      dateCreation: r.dateCreation || null,
      dateClotureFiscale: r.dateClotureFiscale || null,
      statut: r.statut || null,
      codeNaf: r.codeNaf || null,
      libelleNaf: r.libelleNaf || null,
      domaine: r.domaine || null,
      employees: r.effectifs || null,
      dirigeants: r.dirigeants || [],
      beneficiaires: r.beneficiaires || [],
      finances: r.finances || [],
      dernierCA: r.finances?.[0]?.chiffreAffaires || null,
      dernierResultat: r.finances?.[0]?.resultatNet || null,
      nbEtablissements: r.nbEtablissements || null,
      etablissements: r.etablissements || [],
      publications: r.publications || [],
      actes: r.actes || [],
      source_platform: 'pappers',
      sourceUrl: r.sourceUrl || null,
      socialLinks: {},
      aiIntelligence: {
        activities: { posts: [], comments: [] },
        skills: [],
        experience: (r.finances || []).map(f => ({
          company: r.denomination,
          role: `CA: ${f.chiffreAffaires ?? '?'} € | Résultat: ${f.resultatNet ?? '?'} €`,
          duration: String(f.annee ?? '?'),
        })),
        education: [],
        certifications: [],
        recommendations: [],
      },
      contractDetails: {
        siren: r.siren,
        siret: r.siret,
        tva: r.tvaIntracom,
        legalForm: r.formeJuridique,
        capital: r.capital,
        activity: r.libelleNaf,
        status: r.statut,
        creationDate: r.dateCreation,
        employees: r.effectifs,
      },
    };
  }
}

// ─── SCRAPING FULL D'UNE FICHE ───────────────────────────────────────────────
/**
 * Extrait TOUTES les données disponibles sur une fiche Pappers
 * en visitant les différents onglets : résumé, dirigeants, finances, BODACC, actes
 */
async function scrapeFullPage(context, url) {
  const page = await context.newPage();
  const result = {};

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500);

    // ── 1. ONGLET RÉSUMÉ / DONNÉES PRINCIPALES ──────────────────────────────
    const base = await page.evaluate(() => {
      const getText = sel => document.querySelector(sel)?.textContent?.trim() || '';
      const getAll = sel => Array.from(document.querySelectorAll(sel)).map(el => el.textContent.trim()).filter(Boolean);
      const body = document.body.innerText;
      const rx = (pat, flags = 'i') => body.match(new RegExp(pat, flags))?.[1]?.trim() || null;

      // Adresse
      const adresseEl = document.querySelector('[class*="adresse"], [class*="address"], [itemprop="address"]');
      const adresseComplete = adresseEl?.textContent?.trim().replace(/\s+/g, ' ') || null;

      // SIREN propre
      const sirenRaw = rx('SIREN\\s*[:\\s]*(\\d{3}\\s*\\d{3}\\s*\\d{3})');
      const siren = sirenRaw ? sirenRaw.replace(/\s/g, '') : null;

      // SIRET
      const siretRaw = rx('SIRET\\s*[:\\s]*(\\d{3}\\s*\\d{3}\\s*\\d{3}\\s*\\d{5})');
      const siret = siretRaw ? siretRaw.replace(/\s/g, '') : null;

      // TVA
      const tvaIntracom = rx('TVA\\s*(?:intracom[^\\s]*)?\\s*[:\\s]*(FR\\s*\\d{2}\\s*\\d{9})');

      // RCS
      const rcs = rx('RCS\\s+([A-Z][A-Z\\s]+\\d{3}\\s*\\d{3}\\s*\\d{3})');

      // Forme juridique
      const formeJuridique = rx('Forme\\s+juridique\\s*[:\\s]*([^\\n\\r]+)');

      // Capital
      const capital = rx('Capital\\s+social?\\s*[:\\s]*([\\d\\s.,]+(?:€|EUR)?)');

      // Date création
      const dateCreation = rx('(?:Création|Immatriculation)\\s*[:\\s]*(\\d{2}[\\s/.-]\\d{2}[\\s/.-]\\d{4})');

      // Date clôture
      const dateClotureFiscale = rx('Clôture\\s+(?:de\\s+)?(?:l\')?exercice\\s*[:\\s]*(\\d{2}[\\s/.-]\\d{2})');

      // Statut
      const statut = body.includes('En activité') ? 'En activité'
        : body.includes('Radiée') ? 'Radiée'
          : body.includes('En liquidation') ? 'En liquidation'
            : 'N/A';

      // Code NAF / APE
      const codeNaf = rx('(?:Code\\s+)?(?:NAF|APE)\\s*[:\\s]*([0-9]{4}[A-Z])');

      // Libellé NAF
      const libelleNaf = rx('(?:Activité\\s+principale|Libellé)?\\s*(?:NAF|APE)\\s*[:\\s]*[0-9]{4}[A-Z]\\s*[:\\-]\\s*([^\\n\\r]+)');

      // Effectifs
      const effectifs = rx('(?:Effectif|Salariés?)\\s*[:\\s]*([^\\n\\r]+)');

      // CP / Ville / Pays
      const codePostal = rx('\\b(\\d{5})\\b');
      const pays = rx('(?:Pays\\s*[:\\s]*)([A-Za-zÀ-ÿ]+)');

      // Téléphone
      const telephone = rx('(?:Tél(?:éphone)?|Tel|Phone)\\s*[:\\s]*([+\\d][\\d\\s.\\-()]{7,20})');

      // Email
      const emailMatch = body.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch ? emailMatch[0] : null;

      // Site web
      const siteWebEl = document.querySelector('a[href*="http"][href*="."][target="_blank"]:not([href*="pappers"])');
      const siteWeb = siteWebEl?.href || null;

      // Sigle / Enseigne
      const sigle = rx('(?:Sigle|Enseigne)\\s*[:\\s]*([^\\n\\r]+)');

      // Nom entreprise (H1)
      const denomination = getText('h1') || getText('[class*="company-name"], [class*="nom-entreprise"]');

      // Nb établissements
      const nbEtabMatch = body.match(/(\d+)\s+établissement/i);
      const nbEtablissements = nbEtabMatch ? parseInt(nbEtabMatch[1]) : null;

      // Domaine d'activité
      const domaine = rx('Domaine\\s+d\'activité\\s*[:\\s]*([^\\n\\r]+)');

      return {
        denomination, siren, siret, tvaIntracom, rcs,
        formeJuridique, capital, dateCreation, dateClotureFiscale,
        statut, codeNaf, libelleNaf, effectifs, adresseComplete,
        codePostal, pays, telephone, email, siteWeb, sigle,
        nbEtablissements, domaine,
      };
    });

    Object.assign(result, base);
    result.sourceUrl = url;

    // ── 2. DIRIGEANTS ────────────────────────────────────────────────────────
    try {
      // Cliquer sur l'onglet dirigeants si présent
      const tabDirigeants = page.locator('a, button', { hasText: /dirigeants?/i }).first();
      if (await tabDirigeants.isVisible({ timeout: 2000 })) {
        await tabDirigeants.click();
        await sleep(1000);
      }

      result.dirigeants = await page.evaluate(() => {
        const items = [];
        // Différentes structures possibles selon la version du site
        const rows = document.querySelectorAll(
          '[class*="dirigeant"], [class*="manager"], tr[class*="person"], [data-type="dirigeant"]'
        );
        if (rows.length === 0) {
          // Fallback : liens /dirigeant/ dans le texte
          document.querySelectorAll('a[href*="/dirigeant/"]').forEach(a => {
            const text = a.textContent.trim();
            if (text && !items.find(i => i.nom === text)) {
              items.push({ nom: text, lien: a.href });
            }
          });
          return items;
        }
        rows.forEach(row => {
          const text = row.textContent.trim().replace(/\s+/g, ' ');
          const nom = row.querySelector('[class*="nom"], strong, b')?.textContent?.trim() || '';
          const fonction = row.querySelector('[class*="fonction"], [class*="role"], em')?.textContent?.trim() || '';
          items.push({ nom: nom || text, fonction });
        });
        return items;
      });
    } catch (e) {
      result.dirigeants = result.dirigeants || [];
    }

    // ── 3. BÉNÉFICIAIRES EFFECTIFS ───────────────────────────────────────────
    try {
      result.beneficiaires = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('[class*="beneficiaire"]').forEach(el => {
          items.push({ info: el.textContent.trim().replace(/\s+/g, ' ') });
        });
        return items;
      });
    } catch (e) { result.beneficiaires = []; }

    // ── 4. FINANCES ──────────────────────────────────────────────────────────
    try {
      const tabFinances = page.locator('a, button', { hasText: /finance/i }).first();
      if (await tabFinances.isVisible({ timeout: 2000 })) {
        await tabFinances.click();
        await sleep(1200);
      }

      result.finances = await page.evaluate(() => {
        const rows = [];
        // Tables financières
        document.querySelectorAll('table tbody tr, [class*="finance-row"], [class*="bilan-row"]').forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.textContent.trim());
          if (cells.length >= 2 && cells.some(c => /\d/.test(c))) {
            rows.push({
              label: cells[0],
              values: cells.slice(1),
            });
          }
        });

        // Récupérer aussi les lignes clés directement
        const body = document.body.innerText;
        const annees = [...body.matchAll(/\b(20\d{2})\b/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
        const caMatches = [...body.matchAll(/([\d\s]+)\s*€?\s*(?:de\s+)?(?:chiffre\s+d['']affaires|CA)/gi)];
        const resMatches = [...body.matchAll(/([\d\s]+)\s*€?\s*(?:de\s+)?résultat\s+net/gi)];

        return {
          tableRows: rows,
          anneesDetectees: annees,
          caRaw: caMatches.map(m => m[1]?.replace(/\s/g, '')).slice(0, 5),
          resultatRaw: resMatches.map(m => m[1]?.replace(/\s/g, '')).slice(0, 5),
        };
      });
    } catch (e) { result.finances = []; }

    // ── 5. BODACC / ANNONCES LÉGALES ─────────────────────────────────────────
    try {
      const tabBodacc = page.locator('a, button', { hasText: /bodacc|annonce/i }).first();
      if (await tabBodacc.isVisible({ timeout: 2000 })) {
        await tabBodacc.click();
        await sleep(1000);
      }

      result.publications = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('[class*="annonce"], [class*="bodacc"], [class*="publication"]').forEach(el => {
          const date = el.querySelector('[class*="date"]')?.textContent?.trim() || '';
          const type = el.querySelector('[class*="type"], strong')?.textContent?.trim() || '';
          const contenu = el.textContent.trim().replace(/\s+/g, ' ').substring(0, 300);
          items.push({ date, type, contenu });
        });
        return items.slice(0, 20);
      });
    } catch (e) { result.publications = []; }

    // ── 6. ACTES & STATUTS ───────────────────────────────────────────────────
    try {
      const tabActes = page.locator('a, button', { hasText: /actes?|statuts?/i }).first();
      if (await tabActes.isVisible({ timeout: 2000 })) {
        await tabActes.click();
        await sleep(1000);
      }

      result.actes = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('[class*="acte"], [class*="document"]').forEach(el => {
          const date = el.querySelector('[class*="date"]')?.textContent?.trim() || '';
          const type = el.querySelector('[class*="type"], [class*="nature"], strong')?.textContent?.trim() || '';
          items.push({ date, type });
        });
        return items.slice(0, 15);
      });
    } catch (e) { result.actes = []; }

    // ── 7. ÉTABLISSEMENTS ────────────────────────────────────────────────────
    try {
      result.etablissements = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('[class*="etablissement"], [class*="establishment"]').forEach(el => {
          const siret = el.querySelector('[class*="siret"]')?.textContent?.trim() || '';
          const adresse = el.querySelector('[class*="adresse"], [class*="address"]')?.textContent?.trim() || '';
          const statut = el.textContent.includes('En activité') ? 'En activité' : 'Inconnu';
          items.push({ siret, adresse, statut });
        });
        return items.slice(0, 20);
      });
    } catch (e) { result.etablissements = []; }

    // ── 8. PROCÉDURES COLLECTIVES ────────────────────────────────────────────
    try {
      result.proceduresCollectives = await page.evaluate(() => {
        const body = document.body.innerText;
        const mentions = [];
        ['sauvegarde', 'redressement judiciaire', 'liquidation judiciaire', 'mandat ad hoc', 'conciliation']
          .forEach(t => { if (body.toLowerCase().includes(t)) mentions.push(t); });
        return mentions;
      });
    } catch (e) { result.proceduresCollectives = []; }

    // ── 9. DONNÉES COMPLÉMENTAIRES (JSON-LD / meta) ───────────────────────────
    try {
      const jsonLd = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const data = [];
        scripts.forEach(s => {
          try { data.push(JSON.parse(s.textContent)); } catch { }
        });
        return data;
      });
      if (jsonLd.length > 0) result.jsonLd = jsonLd;
    } catch (e) { }

  } catch (err) {
    emitLog(`  ⚠️  Erreur extraction ${url}: ${err.message}`);
  } finally {
    await page.close();
  }
  return result;
}

// ─── RUN API ──────────────────────────────────────────────────────────────────
async function apiRun() {
  emitLog('🛰️ Connexion à l\'API officielle Pappers...', 10);
  try {
    const search = await httpGet(
      `${API_V2}/recherche?api_token=${CONFIG.apiToken}&q=${encodeURIComponent(CONFIG.query + ' ' + CONFIG.location)}&par_page=${CONFIG.maxResults}&finances=true&dirigeants=true&beneficiaires=true&effectifs=true&publications=true&actes=true`
    );
    const list = search.resultats || [];
    emitLog(`✨ ${list.length} entreprises trouvées via l'API.`, 15);

    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const pct = 15 + Math.round(((i + 1) / list.length) * 85);
      emitLog(`   🏢 [${i + 1}/${list.length}] ${r.denomination || r.siren}`, pct);
      try {
        const raw = await httpGet(
          `${API_V2}/entreprise?api_token=${CONFIG.apiToken}&siren=${r.siren}` +
          `&finances=true&dirigeants=true&beneficiaires=true&effectifs=true` +
          `&publications=true&actes=true&etablissements=true&procedures=true`
        );
        emitResult(formatToProspect(raw, true));
      } catch (e) {
        emitLog(`  ⚠️  API erreur ${r.siren}: ${e.message}`);
      }
      await sleep(300);
    }
  } catch (e) {
    emitLog(`Erreur API fatale: ${e.message}`);
  }
}

// ─── RUN PLAYWRIGHT ──────────────────────────────────────────────────────────
async function playwrightRun() {
  emitLog('🛰️ Initialisation du navigateur Prospecta...', 10);
  const browser = await chromium.launch({ headless: CONFIG.headless });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
  });

  try {
    const searchUrl = `${BASE}/recherche?q=${encodeURIComponent(CONFIG.query + (CONFIG.location ? ' ' + CONFIG.location : ''))}`;
    emitLog(`\n── ANALYSE DU REGISTRE ────────────────────────────────\n`, 15);
    emitLog(`🔍 Indexation sur ${BASE}...`);

    const searchPage = await context.newPage();
    await searchPage.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    // Récupérer les liens vers les fiches
    const links = await searchPage.evaluate((max) => {
      const seen = new Set();
      const items = [];
      document.querySelectorAll('a[href*="/entreprise/"]').forEach(a => {
        const sirenMatch = a.href.match(/-(\d{9})$/);
        if (sirenMatch && !seen.has(a.href) && items.length < max * 2) {
          seen.add(a.href);
          items.push({ url: a.href, siren: sirenMatch[1] });
        }
      });
      return items;
    }, CONFIG.maxResults);

    await searchPage.close();
    emitLog(`✨ ${links.length} fiches entreprises détectées.`, 25);
    emitLog(`\n── EXTRACTION DÉTAILLÉE ─────────────────────────────────\n`);

    const toProcess = links.slice(0, CONFIG.maxResults);

    for (let i = 0; i < toProcess.length; i++) {
      const link = toProcess[i];
      const pct = 25 + Math.round(((i + 1) / toProcess.length) * 70);
      emitLog(`   🏢 [${i + 1}/${toProcess.length}] Extraction complète de ${link.siren}...`, pct);

      try {
        const raw = await scrapeFullPage(context, link.url);

        // Champs SIREN manquants → depuis l'URL
        if (!raw.siren) raw.siren = link.siren;

        const prospect = formatToProspect(raw, false);
        emitLog(`      ✅ ${prospect.name || prospect.denomination || link.siren} — ${prospect.statut || ''}`);
        emitResult(prospect);
      } catch (e) {
        emitLog(`  ⚠️  Erreur sur ${link.siren}: ${e.message}`);
      }

      await sleep(CONFIG.delay);
    }

  } catch (err) {
    emitLog(`Erreur critique : ${err.message}`);
  } finally {
    await browser.close();
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  emitLog(`🚀 Pappers Scraper v3.0 — Extraction Maximale\n  auditionné par Prospecta\n`, 5);
  emitLog(`🏢 Cible : "${CONFIG.query}"\n📍 Localisation : "${CONFIG.location}"\n🔢 Limite : ${CONFIG.maxResults}\n`, 7);

  if (CONFIG.apiToken && CONFIG.apiToken.length > 5) {
    await apiRun();
  } else {
    await playwrightRun();
  }

  emitLog(`\n── SYNTHÈSE ──────────────────────────────────────────\n`);
  emitLog('✅ Extraction Pappers v3.0 terminée avec succès.', 100);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});