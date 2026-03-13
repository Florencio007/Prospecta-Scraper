const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

function emitLog(msg, pct = undefined) {
  console.log(msg);
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}

function emitResult(data) {
  process.stdout.write(`RESULT:${JSON.stringify(data)}\n`);
}

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
let [,, arg1, arg2, arg3] = process.argv;

// Intelligent argument handling: if arg1 is not a mode, treat it as the query
let mode = 'entreprise';
let query = '';
let maxResults = 5;

if (arg1 && ['entreprise', 'dirigeant'].includes(arg1.toLowerCase())) {
  mode = arg1.toLowerCase();
  query = arg2 || '';
  maxResults = parseInt(arg3 || '5');
} else {
  query = arg1 || 'Gadait international';
  maxResults = parseInt(arg2 || '5');
}

const CONFIG = {
  mode,
  query,
  maxResults,
  headless: false,
  delay: 2500,
  outputDir: './output',
};

emitLog(`🚀 Societe.com Scraper — mode complet\n auditionné par Prospecta\n`, 5);
if (CONFIG.query) {
  emitLog(`💼 Cible : "${CONFIG.query}"\n📜 Mode : ${CONFIG.mode}\n`, 7);
}

const BASE = 'https://www.societe.com';
const sleep = ms => new Promise(r => setTimeout(r, ms + Math.floor(Math.random() * 600)));
const clean = s => (s || '').replace(/\s+/g, ' ').trim();

/**
 * Formate les données brutes extraites en un objet Prospect standard
 */
function mapToProspect(data) {
  return {
    id: data.siren || Math.random().toString(36).substr(2, 9),
    name: data.denomination || 'N/A',
    email: data.email || null,
    phone: data.telephone || null,
    company: data.denomination || null,
    role: data.dirigeants?.[0]?.nom || null,
    location: data.adresse || null,
    website: data.site_web || null,
    source_platform: 'societe_com',
    socialLinks: {
      linkedin: data.socials?.linkedin || null,
      facebook: data.socials?.facebook || null,
    },
    aiIntelligence: {
      activities: { posts: [], comments: [] },
      skills: [],
      experience: data.finances?.map(f => ({
        company: data.denomination,
        role: `CA: ${f.chiffreAffaires} | Result: ${f.resultatNet}`,
        duration: f.annee
      })) || [],
      education: [],
      certifications: data.marques?.map(m => m.nom) || [],
      recommendations: []
    },
    contractDetails: {
      siren: data.siren,
      siret: data.siret,
      tva: data.tva,
      legalForm: data.forme,
      capital: data.capital,
      activity: data.libelleNaf,
      activitePrincipaleDeclaree: data.activitePrincipaleDeclaree || null,
      typeActivite: data.typeActivite || null,
      sourcesMiseAJour: data.sourcesMisesAJour || null,
      status: data.statut,
      creationDate: data.dateCreation,
      employees: data.effectifs
    }
  };
}

/**
 * Gère l'acceptation automatique des cookies
 */
async function handleCookies(page) {
  const cookieSelectors = [
    '#didomi-notice-agree-button',
    '#acceptAll',
    'button[id*="accept"]',
    'button[class*="accept"]',
    '.didomi-continue-without-agreeing',
  ];

  for (const selector of cookieSelectors) {
    try {
      if (await page.isVisible(selector)) {
        await page.click(selector);
        await sleep(500);
        return;
      }
    } catch (e) {}
  }
}

async function applyHeaders(page) {
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://www.google.fr/',
  });
  await page.route('**/*', route => {
    const type = route.request().resourceType();
    ['image', 'media', 'font'].includes(type) ? route.abort() : route.continue();
  });
}

async function autoScroll(page, times = 3) {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(500);
  }
}

/**
 * Extraction détaillée d'une page entreprise
 */
async function scrapeCompanyPage(context, link) {
  const page = await context.newPage();
  await applyHeaders(page);

  try {
    let targetUrl = link.url;
    // Si redirection par SIREN demandée
    if (!targetUrl.includes('societe.com/societe/') && link.siren) {
      targetUrl = `${BASE}/cgi-bin/biland?rncs=${link.siren}`;
    }

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500);
    await handleCookies(page);
    await autoScroll(page, 2);

    const data = await page.evaluate(() => {
      const cleanVal = (s) => (s || '').replace(/\s+/g, ' ').trim();
      
      function findByLabel(...labels) {
        const elements = Array.from(document.querySelectorAll('td, dt, th, span, div, p, label, .label, .key'));
        for (const el of elements) {
          const txt = el.textContent?.trim().toLowerCase() || '';
          if (labels.some(l => txt === l.toLowerCase() || txt.startsWith(l.toLowerCase() + ':') || txt.startsWith(l.toLowerCase() + ' '))) {
            // Check next sibling or parent sibling
            let valEl = el.nextElementSibling;
            if (!valEl || valEl.textContent.trim() === '') {
                valEl = el.closest('tr')?.querySelector('td:last-child') || el.closest('div')?.querySelector('.value, span:last-child');
            }
            if (valEl && valEl !== el) return cleanVal(valEl.textContent);
          }
        }
        return '';
      }

      const bodyText = document.body.innerText;
      
      const denomination = cleanVal(document.querySelector('h1, .ui-app-title')?.textContent) || '';
      
      // SIREN / SIRET via copy buttons or regex
      let siren = cleanVal(document.querySelector('button[aria-label*="SIREN"]')?.closest('div, p, td')?.textContent?.match(/\d{3}\s?\d{3}\s?\d{3}/)?.[0]?.replace(/\s/g, '')) || '';
      let siret = cleanVal(document.querySelector('button[aria-label*="SIRET"]')?.closest('div, p, td')?.textContent?.match(/\d{3}\s?\d{3}\s?\d{3}\s?\d{5}/)?.[0]?.replace(/\s/g, '')) || '';
      
      if (!siren) siren = bodyText.match(/SIREN\s*[:-]?\s*(\d{3}\s?\d{3}\s?\d{3})/i)?.[1]?.replace(/\s/g, '') || '';
      if (!siret) siret = bodyText.match(/SIRET\s*[:-]?\s*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})/i)?.[1]?.replace(/\s/g, '') || '';

      const tva = bodyText.match(/\bFR[A-Z0-9]{2}\d{9}\b/i)?.[0] || findByLabel('Numéro de TVA', 'TVA Intracommunautaire') || '';
      const forme = findByLabel('Forme juridique', 'Statut juridique') || '';
      const statut = findByLabel('État', 'Statut') || (bodyText.includes('inscrite au registre') ? 'Inscrite' : '');
      const dateCreation = findByLabel('Date de création entreprise', 'Date de création', 'Création') || '';
      const capital = findByLabel('Capital social', 'Capital') || '';
      const effectifs = findByLabel('Effectifs', 'Salariés') || '';
      const libelleNaf = findByLabel('Activité (Code NAF ou APE)', 'Code APE', 'Code NAF') || '';
      
      const activitePrincipaleDeclaree = findByLabel('Activité principale déclarée') || '';
      const typeActivite = findByLabel("Type d'activité") || '';
      const sourcesMisesAJour = findByLabel('SOURCES & MISES À JOUR LE', 'Mises à jour') || '';

      const addrEl = document.querySelector('address, [class*="siege"] address, #address');
      const adresse = cleanVal(addrEl?.textContent) || findByLabel('Adresse') || '';
      
      const telMatch = bodyText.match(/(?:0|\+33[\s\.]?)[1-9](?:[\s\.\-]?\d{2}){4}/);
      const telephone = telMatch?.[0]?.replace(/\s/g, '') || '';
      const emailMatch = bodyText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-z]{2,}/);
      const email = emailMatch?.[0] || '';

      const dirigeants = [];
      document.querySelectorAll('a[href*="/dirigeant/"], .dirigeant-name').forEach(a => {
        const nom = cleanVal(a.textContent);
        if (nom && dirigeants.length < 3) dirigeants.push({ nom, url: a.href || '#' });
      });

      const finances = [];
      document.querySelectorAll('.finances-table tr, table tr').forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length >= 2) {
          const year = cells[0].textContent.trim();
          if (/^20\d{2}$/.test(year)) {
            finances.push({ annee: year, chiffreAffaires: cells[1].textContent.trim(), resultatNet: cells[2]?.textContent.trim() || '' });
          }
        }
      });

      return {
        denomination, siren, siret, tva, forme, statut, dateCreation, capital, effectifs, libelleNaf,
        activitePrincipaleDeclaree, typeActivite, sourcesMisesAJour,
        adresse, telephone, email, dirigeants, finances, socials: {}
      };
    });

    return data;
  } finally {
    await page.close();
  }
}

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
    page.on('console', msg => emitLog(`[BROWSER] ${msg.text()}`));
    await applyHeaders(page);

    emitLog(`🔍 Recherche sur ${BASE}...`);
    
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await handleCookies(page);
    
    // Fill the search input and search
    const searchInput = 'input[name="champs"], input[id="search"], .ui-search-input input';
    try {
      await page.waitForSelector(searchInput, { timeout: 5000 });
      await page.fill(searchInput, CONFIG.query);
      await page.press(searchInput, 'Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    } catch (e) {
      // Fallback
      await page.goto(`${BASE}/cgi-bin/search?champs=${encodeURIComponent(CONFIG.query).replace(/%20/g, '+')}`, { waitUntil: 'networkidle' });
    }

    await sleep(2000);
    await handleCookies(page);
    await page.screenshot({ path: 'search_debug.png' });

    const links = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      // Debug logs to see what's on the page
      console.log("Current URL:", window.location.href);
      console.log("Body text length:", document.body.innerText.length);
      
      const elements = document.querySelectorAll('.fl-body li a, #result_deno_societe a[href*="/societe/"], a[href*="/societe/"]');
      console.log("Found links total:", elements.length);
      
      elements.forEach((a, idx) => {
        const href = a.href.split('?')[0].split('#')[0];
        const linkName = a.getAttribute('title') || a.textContent.trim().split('\n')[0].trim();
        
        if (idx < 10) console.log(`Link ${idx}: ${linkName} -> ${href}`);

        if (!href.includes('/societe/') || href.endsWith('.html') === false) return;
        if (href.includes('entreprises-francaises.html') || href.includes('/bilan/') || href.includes('liste-derniere-societes.html')) return;
        
        if (seen.has(href)) return;
        seen.add(href);
        
        // Final sanity check on name
        const lowerName = linkName.toLowerCase();
        if (linkName && linkName.length > 2 && 
            !lowerName.includes('société française') && 
            !lowerName.includes('entreprises françaises') &&
            !lowerName.includes('entreprises de ') &&
            !lowerName.includes('sociétés à ')) {
          results.push({ url: href, name: linkName });
        }
      });
      return results;
    });

    emitLog(`✨ ${links.length} structures détectées.`, 25);

    for (let i = 0; i < Math.min(links.length, CONFIG.maxResults); i++) {
      const link = links[i];
      const currentPct = 25 + Math.round(((i + 1) / Math.min(links.length, CONFIG.maxResults)) * 70);
      emitLog(`   🏢 [${i + 1}/${CONFIG.maxResults}] ${link.name}`, currentPct);
      
      try {
        const data = await scrapeCompanyPage(context, link);
        if (data.denomination || data.siren) {
          emitResult(mapToProspect(data));
        }
      } catch (e) {
        emitLog(`⚠️ Erreur sur ${link.name}: ${e.message.split('\n')[0]}`);
      }
      await sleep(CONFIG.delay);
    }

  } catch (err) {
    emitLog(`❌ Erreur critique : ${err.message}`);
  } finally {
    await browser.close();
    emitLog("✅ Extraction terminée.", 100);
  }
}

main().catch(console.error);
