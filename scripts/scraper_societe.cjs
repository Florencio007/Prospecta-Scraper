/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║   PROSPECTA — Scraper Societe.com  (Playwright v3.0 FULL EXTRACT)      ║
 * ║   Identité · Dirigeants · Finances · Actes · Établissements · Marques  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

const { chromium } = require('playwright');
const fs = require('fs');

// ─── UTILITAIRES ──────────────────────────────────────────────────────────────
function emitLog(msg, pct = undefined) {
  console.log(msg);
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}
function emitResult(data) {
  process.stdout.write(`RESULT:${JSON.stringify(data)}\n`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms + Math.floor(Math.random() * 600)));
const clean = s => (s || '').replace(/\s+/g, ' ').trim();

// ─── CONFIGURATION CLI (alignée finder: type, q, limit) ──────────────────────
const [, , argType, argQuery, argLimit] = process.argv;

// type finder: "entreprise" | "personne" | "tous" → mode societe: "entreprise" | "dirigeant"
const mode = (argType && (argType.toLowerCase() === 'personne' || argType.toLowerCase() === 'dirigeant')) ? 'dirigeant' : 'entreprise';
const query = argQuery || '';
const maxResults = parseInt(argLimit || '5', 10);

const CONFIG = { mode, query, maxResults, headless: true, delay: 2500 };
const BASE = 'https://www.societe.com';

emitLog(`🚀 Societe.com Scraper v3.0 — Extraction Maximale\n  auditionné par Prospecta\n`, 5);
emitLog(`💼 Cible : "${CONFIG.query}"\n📜 Mode : ${CONFIG.mode}\n🔢 Limite : ${CONFIG.maxResults}\n`, 7);

// ─── FORMAT PROSPECT ─────────────────────────────────────────────────────────
function mapToProspect(d) {
  return {
    id: d.siren || Math.random().toString(36).substr(2, 9),

    // ── Identité
    name: d.denomination || 'N/A',
    denomination: d.denomination || null,
    sigle: d.sigle || null,
    company: d.denomination || null,
    role: d.dirigeants?.[0]?.fonction || d.dirigeants?.[0]?.nom || null,
    description: d.description || null,

    // ── Contact
    email: d.email || null,
    phone: d.telephone || null,
    website: d.siteWeb || null,

    // ── Adresse siège
    location: d.adresse || null,
    adresse: d.adresse || null,
    codePostal: d.codePostal || null,
    ville: d.ville || null,
    pays: d.pays || 'France',
    coordonnees: d.coordonnees || null,

    // ── Identifiants légaux
    siren: d.siren || null,
    siret: d.siret || null,
    tva: d.tva || null,
    rcs: d.rcs || null,

    // ── Infos juridiques
    formeJuridique: d.forme || null,
    capital: d.capital || null,
    deviseCapital: d.deviseCapital || 'EUR',
    dateCreation: d.dateCreation || null,
    dateClotureFiscale: d.dateCloture || null,
    statut: d.statut || null,
    procedureCollective: d.procedureCollective || null,

    // ── Activité
    codeNaf: d.codeNaf || null,
    libelleNaf: d.libelleNaf || null,
    activitePrincipaleDeclaree: d.activitePrincipaleDeclaree || null,
    typeActivite: d.typeActivite || null,
    domaine: d.domaine || null,

    // ── Effectifs
    employees: d.effectifs || null,
    trancheEffectif: d.trancheEffectif || null,

    // ── Personnes clés
    dirigeants: d.dirigeants || [],
    beneficiaires: d.beneficiaires || [],

    // ── Finances
    finances: d.finances || [],
    dernierCA: d.finances?.[0]?.chiffreAffaires || null,
    dernierResultat: d.finances?.[0]?.resultatNet || null,
    derniereAnnee: d.finances?.[0]?.annee || null,

    // ── Établissements
    nbEtablissements: d.nbEtablissements || null,
    etablissements: d.etablissements || [],

    // ── Marques & brevets
    marques: d.marques || [],
    brevets: d.brevets || [],

    // ── Actes & publications
    actes: d.actes || [],
    publications: d.publications || [],

    // ── Liens associés (filiales, groupe)
    filiales: d.filiales || [],
    actionnaires: d.actionnaires || [],

    // ── Réseaux sociaux
    socialLinks: {
      linkedin: d.socials?.linkedin || null,
      facebook: d.socials?.facebook || null,
      twitter: d.socials?.twitter || null,
      instagram: d.socials?.instagram || null,
    },

    // ── Source
    source_platform: 'societe_com',
    sourceUrl: d.sourceUrl || null,
    sourcesMisesAJour: d.sourcesMisesAJour || null,

    // ── Bloc AI Intelligence
    aiIntelligence: {
      activities: { posts: [], comments: [] },
      skills: [],
      experience: (d.finances || []).map(f => ({
        company: d.denomination,
        role: `CA: ${f.chiffreAffaires ?? '?'} € | Résultat: ${f.resultatNet ?? '?'} € | Effectifs: ${f.effectifs ?? '?'}`,
        duration: String(f.annee ?? '?'),
      })),
      education: [],
      certifications: (d.marques || []).map(m => m.nom || m),
      recommendations: [],
    },

    // ── Bloc contractDetails
    contractDetails: {
      siren: d.siren,
      siret: d.siret,
      tva: d.tva,
      legalForm: d.forme,
      capital: d.capital,
      activity: d.libelleNaf,
      activitePrincipaleDeclaree: d.activitePrincipaleDeclaree,
      typeActivite: d.typeActivite,
      status: d.statut,
      creationDate: d.dateCreation,
      employees: d.effectifs,
      sourcesMisesAJour: d.sourcesMisesAJour,
    },
  };
}

// ─── COOKIES ─────────────────────────────────────────────────────────────────
async function handleCookies(page) {
  const sels = [
    '#didomi-notice-agree-button', '#acceptAll',
    'button[id*="accept"]', 'button[class*="accept"]',
    '.didomi-continue-without-agreeing',
  ];
  for (const sel of sels) {
    try {
      if (await page.isVisible(sel, { timeout: 1000 })) {
        await page.click(sel);
        await sleep(500);
        return;
      }
    } catch { }
  }
}

// ─── HEADERS & OPTIMISATIONS ─────────────────────────────────────────────────
async function applyHeaders(page) {
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://www.google.fr/',
  });
  // Bloquer images/médias/polices pour accélérer
  await page.route('**/*', route => {
    const type = route.request().resourceType();
    ['image', 'media', 'font'].includes(type) ? route.abort() : route.continue();
  });
}

async function autoScroll(page, times = 3) {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(400);
  }
}

// ─── EXTRACTION COMPLÈTE D'UNE FICHE ─────────────────────────────────────────
async function scrapeCompanyPage(context, link) {
  const page = await context.newPage();
  await applyHeaders(page);

  try {
    let targetUrl = link.url;
    if (!targetUrl.includes('/societe/') && link.siren) {
      targetUrl = `${BASE}/cgi-bin/biland?rncs=${link.siren}`;
    }

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500);
    await handleCookies(page);
    await autoScroll(page, 3);

    // ── DONNÉES PRINCIPALES ───────────────────────────────────────────────────
    const base = await page.evaluate(() => {
      const c = s => (s || '').replace(/\s+/g, ' ').trim();

      // Recherche générique label → valeur
      function findByLabel(...labels) {
        const els = Array.from(document.querySelectorAll('td, dt, th, span, div, p, label, .label, .key, [class*="label"]'));
        for (const el of els) {
          const txt = c(el.textContent).toLowerCase();
          if (labels.some(l => txt === l.toLowerCase() || txt.startsWith(l.toLowerCase() + ':'))) {
            let val = el.nextElementSibling;
            if (!val || !val.textContent.trim()) {
              val = el.closest('tr')?.querySelector('td:last-child')
                || el.closest('div')?.querySelector('.value, [class*="value"], span:last-child');
            }
            if (val && val !== el) return c(val.textContent);
          }
        }
        return null;
      }

      const body = document.body.innerText;

      // ── Identité
      const denomination = c(document.querySelector('h1, .ui-app-title, [class*="company-name"]')?.textContent) || '';
      const sigle = findByLabel('Sigle', 'Enseigne');
      const description = c(document.querySelector('[class*="description"], [itemprop="description"]')?.textContent) || null;

      // ── Identifiants
      const sirenRaw = document.querySelector('button[aria-label*="SIREN"]')
        ?.closest('div, p, td')?.textContent?.match(/\d{3}\s?\d{3}\s?\d{3}/)?.[0]
        || body.match(/SIREN\s*[:-]?\s*(\d{3}\s?\d{3}\s?\d{3})/i)?.[1] || '';
      const siren = sirenRaw.replace(/\s/g, '');

      const siretRaw = document.querySelector('button[aria-label*="SIRET"]')
        ?.closest('div, p, td')?.textContent?.match(/\d{3}\s?\d{3}\s?\d{3}\s?\d{5}/)?.[0]
        || body.match(/SIRET\s*[:-]?\s*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})/i)?.[1] || '';
      const siret = siretRaw.replace(/\s/g, '');

      const tva = body.match(/\bFR[A-Z0-9]{2}\s*\d{9}\b/i)?.[0]?.replace(/\s/g, '')
        || findByLabel('Numéro de TVA', 'TVA Intracommunautaire', 'N° TVA');

      const rcs = findByLabel('RCS', 'Numéro RCS')
        || body.match(/RCS\s+([A-Z][A-Za-zÀ-ÿ\s]+\d{3}\s?\d{3}\s?\d{3})/)?.[1] || null;

      // ── Juridique
      const forme = findByLabel('Forme juridique', 'Statut juridique', 'Forme');
      const capital = findByLabel('Capital social', 'Capital');
      const deviseCapital = capital?.match(/[€$£]|EUR|USD/)?.[0] || 'EUR';
      const dateCreation = findByLabel('Date de création entreprise', 'Date de création', 'Création', 'Immatriculation');
      const dateCloture = findByLabel('Date de clôture', 'Clôture de l\'exercice', 'Clôture exercice');
      const statut = findByLabel('État', 'Statut', 'Situation')
        || (body.includes('En activité') ? 'En activité'
          : body.includes('Radiée') ? 'Radiée'
            : body.includes('En liquidation') ? 'En liquidation' : null);
      const procedureCollective = findByLabel('Procédure collective')
        || (body.match(/(sauvegarde|redressement judiciaire|liquidation judiciaire)/i)?.[1] || null);

      // ── Activité
      const libelleNaf = findByLabel('Activité (Code NAF ou APE)', 'Code APE', 'Code NAF', 'Activité principale');
      const codeNaf = body.match(/\b([0-9]{4}[A-Z])\b/)?.[1] || null;
      const activitePrincipaleDeclaree = findByLabel('Activité principale déclarée');
      const typeActivite = findByLabel("Type d'activité");
      const domaine = findByLabel('Domaine d\'activité', 'Secteur');
      const sourcesMisesAJour = findByLabel('SOURCES & MISES À JOUR LE', 'Mises à jour', 'Dernière mise à jour');

      // ── Effectifs
      const effectifs = findByLabel('Effectifs', 'Salariés', 'Nombre de salariés');
      const trancheEffectif = findByLabel('Tranche d\'effectif', 'Tranche effectif');

      // ── Adresse
      const addrEl = document.querySelector(
        'address, [class*="siege"] address, #address, [itemprop="address"], [class*="adresse"]'
      );
      const adresse = c(addrEl?.textContent) || findByLabel('Adresse', 'Siège social') || '';
      const cpMatch = adresse.match(/\b(\d{5})\b/);
      const codePostal = cpMatch?.[1] || null;
      const villeMatch = adresse.match(/\d{5}\s+([A-ZÀ-Ÿa-zà-ÿ\s\-]+)/);
      const ville = villeMatch?.[1]?.trim() || null;

      // ── Coordonnées GPS
      let coordonnees = null;
      const mapEl = document.querySelector('[data-lat], [data-lng], [data-latitude], [data-longitude]');
      if (mapEl) coordonnees = { lat: mapEl.dataset.lat || mapEl.dataset.latitude, lng: mapEl.dataset.lng || mapEl.dataset.longitude };
      if (!coordonnees) {
        try {
          document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
            const d = JSON.parse(s.textContent);
            if (d?.geo) coordonnees = { lat: d.geo.latitude, lng: d.geo.longitude };
          });
        } catch { }
      }

      // ── Contact
      const telMatch = body.match(/(?:0|\+33[\s.]?)[1-9](?:[\s.\-]?\d{2}){4}/);
      const telephone = telMatch?.[0]?.replace(/[\s.\-]/g, '') || null;
      const emailMatch = body.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,}/);
      const email = emailMatch?.[0] || null;
      const siteWebEl = document.querySelector('a[href*="http"][rel*="nofollow"]:not([href*="societe.com"])');
      const siteWeb = siteWebEl?.href || null;

      // ── Réseaux sociaux
      const socials = {};
      const socialMap = { linkedin: ['linkedin.com'], facebook: ['facebook.com'], twitter: ['twitter.com', 'x.com'], instagram: ['instagram.com'] };
      document.querySelectorAll('a[href]').forEach(a => {
        Object.entries(socialMap).forEach(([k, domains]) => {
          if (domains.some(d => a.href.includes(d)) && !socials[k]) socials[k] = a.href;
        });
      });

      // ── Dirigeants (jusqu'à 10)
      const dirigeants = [];
      const dirSeen = new Set();
      document.querySelectorAll('a[href*="/dirigeant/"], [class*="dirigeant"], [class*="manager"]').forEach(el => {
        const nom = c(el.querySelector('[class*="nom"], strong, b')?.textContent || el.textContent);
        const fonction = c(el.querySelector('[class*="fonction"], [class*="role"], em')?.textContent || '');
        const url = el.tagName === 'A' ? el.href : (el.querySelector('a')?.href || null);
        if (nom && !dirSeen.has(nom) && dirigeants.length < 10) {
          dirSeen.add(nom);
          dirigeants.push({ nom, fonction, url });
        }
      });

      // ── Bénéficiaires effectifs
      const beneficiaires = [];
      document.querySelectorAll('[class*="beneficiaire"]').forEach(el => {
        beneficiaires.push({ info: c(el.textContent) });
      });

      // ── Finances (toutes les années disponibles)
      const finances = [];
      const finSeen = new Set();
      document.querySelectorAll('table tr, [class*="finance-row"], [class*="bilan-row"]').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.textContent.trim());
        if (cells.length >= 2 && /^20\d{2}$/.test(cells[0]) && !finSeen.has(cells[0])) {
          finSeen.add(cells[0]);
          finances.push({
            annee: cells[0],
            chiffreAffaires: cells[1] || null,
            resultatNet: cells[2] || null,
            effectifs: cells[3] || null,
            ebitda: cells[4] || null,
          });
        }
      });

      // ── Établissements
      const etablissements = [];
      document.querySelectorAll('[class*="etablissement"], [class*="establishment"]').forEach(el => {
        const siretEl = el.querySelector('[class*="siret"]')?.textContent?.trim() || '';
        const adresseE = el.querySelector('[class*="adresse"], address')?.textContent?.replace(/\s+/g, ' ').trim() || '';
        const statutE = el.textContent.includes('En activité') ? 'En activité' : 'Inconnu';
        etablissements.push({ siret: siretEl, adresse: adresseE, statut: statutE });
      });
      const nbEtablissements = etablissements.length || parseInt(body.match(/(\d+)\s+établissement/i)?.[1]) || null;

      // ── Marques & brevets
      const marques = [];
      document.querySelectorAll('[class*="marque"], [class*="brand"]').forEach(el => {
        marques.push({ nom: c(el.textContent) });
      });
      const brevets = [];
      document.querySelectorAll('[class*="brevet"], [class*="patent"]').forEach(el => {
        brevets.push({ info: c(el.textContent) });
      });

      // ── Actes & annonces
      const actes = [];
      document.querySelectorAll('[class*="acte"], [class*="document"], [class*="depot"]').forEach(el => {
        const date = el.querySelector('[class*="date"], time')?.textContent?.trim() || '';
        const type = el.querySelector('[class*="type"], [class*="nature"], strong')?.textContent?.trim() || '';
        if (type || date) actes.push({ date, type });
      });

      // ── Publications BODACC
      const publications = [];
      document.querySelectorAll('[class*="bodacc"], [class*="annonce"], [class*="publication"]').forEach(el => {
        const date = el.querySelector('[class*="date"]')?.textContent?.trim() || '';
        const type = el.querySelector('[class*="type"], strong')?.textContent?.trim() || '';
        const contenu = c(el.textContent).substring(0, 250);
        publications.push({ date, type, contenu });
      });

      // ── Filiales & actionnaires
      const filiales = [];
      document.querySelectorAll('[class*="filiale"], a[href*="/societe/"][class*="sub"]').forEach(el => {
        filiales.push({ nom: c(el.textContent), url: el.href || null });
      });
      const actionnaires = [];
      document.querySelectorAll('[class*="actionnaire"], [class*="shareholder"]').forEach(el => {
        actionnaires.push({ info: c(el.textContent) });
      });

      return {
        denomination, sigle, description,
        siren, siret, tva, rcs,
        forme, capital, deviseCapital, dateCreation, dateCloture, statut, procedureCollective,
        codeNaf, libelleNaf, activitePrincipaleDeclaree, typeActivite, domaine, sourcesMisesAJour,
        effectifs, trancheEffectif,
        adresse, codePostal, ville, pays: 'France', coordonnees,
        telephone, email, siteWeb, socials,
        dirigeants, beneficiaires,
        finances,
        etablissements, nbEtablissements,
        marques, brevets,
        actes: actes.slice(0, 15),
        publications: publications.slice(0, 20),
        filiales, actionnaires,
        sourceUrl: window.location.href,
      };
    });

    return base;

  } catch (err) {
    emitLog(`  ⚠️  Erreur scraping ${link.url}: ${err.message}`);
    return {};
  } finally {
    await page.close();
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  emitLog('🛰️ Initialisation de la session sécurisée...', 10);

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'fr-FR',
  });

  try {
    const page = await context.newPage();
    await applyHeaders(page);

    emitLog(`🔍 Connexion à ${BASE}...`);
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await handleCookies(page);

    // ── Recherche
    const searchInput = 'input[name="champs"], input[id="search"], .ui-search-input input, input[placeholder*="recherch"]';
    try {
      await page.waitForSelector(searchInput, { timeout: 5000 });
      await page.fill(searchInput, CONFIG.query);
      await page.press(searchInput, 'Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => { });
    } catch {
      await page.goto(
        `${BASE}/cgi-bin/search?champs=${encodeURIComponent(CONFIG.query).replace(/%20/g, '+')}`,
        { waitUntil: 'networkidle', timeout: 30000 }
      );
    }

    await sleep(2000);
    await handleCookies(page);

    emitLog(`\n── ANALYSE DES RÉSULTATS ──────────────────────────────\n`, 20);

    // ── Collecte des liens résultats
    const links = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      const SKIP = ['entreprises-francaises.html', '/bilan/', 'liste-derniere-societes', 'societes-de-', 'etablissements-'];

      document.querySelectorAll(
        '.fl-body li a[href*="/societe/"], #result_deno_societe a[href*="/societe/"], a[href*="/societe/"]'
      ).forEach(a => {
        const href = a.href.split('?')[0].split('#')[0];
        if (!href.endsWith('.html')) return;
        if (SKIP.some(s => href.includes(s))) return;
        if (seen.has(href)) return;
        seen.add(href);

        const name = (a.getAttribute('title') || a.textContent.trim().split('\n')[0]).trim();
        const lower = name.toLowerCase();
        if (name.length < 3) return;
        if (['société française', 'entreprises', 'sociétés à'].some(k => lower.includes(k))) return;

        // Extraire SIREN depuis l'URL
        const sirenMatch = href.match(/-(\d{9})\.html$/);
        results.push({ url: href, name, siren: sirenMatch?.[1] || '' });
      });
      return results;
    });

    emitLog(`✨ ${links.length} structures détectées.`, 25);
    emitLog(`\n── EXTRACTION DÉTAILLÉE ─────────────────────────────────\n`);

    const toProcess = links.slice(0, CONFIG.maxResults);

    for (let i = 0; i < toProcess.length; i++) {
      const link = toProcess[i];
      const pct = 25 + Math.round(((i + 1) / toProcess.length) * 70);
      emitLog(`   🏢 [${i + 1}/${toProcess.length}] ${link.name}`, pct);

      try {
        const data = await scrapeCompanyPage(context, link);
        if (data.denomination || data.siren) {
          const prospect = mapToProspect(data);
          emitLog(`      ✅ ${prospect.name} — SIREN: ${prospect.siren || '?'} — ${prospect.statut || ''}`);
          emitResult(prospect);
        }
      } catch (e) {
        emitLog(`  ⚠️  Erreur sur ${link.name}: ${e.message.split('\n')[0]}`);
      }

      await sleep(CONFIG.delay);
    }

  } catch (err) {
    emitLog(`❌ Erreur critique : ${err.message}`);
  } finally {
    await browser.close();
    emitLog(`\n── SYNTHÈSE ──────────────────────────────────────────\n`);
    emitLog('✅ Extraction Societe.com v3.0 terminée avec succès.', 100);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});