/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║      PROSPECTA — Scraper PagesJaunes.fr  (Playwright v2.0)     ║
 * ║      Export CSV + JSON | Mode Entreprise & Personne             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// Dépendances nécessaires : Playwright pour l'automatisation, fs/path pour le système de fichiers
const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

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
// Récupération des paramètres : mode (entreprise/personne), terme de recherche, lieu, limite
emitLog(`🚀 PagesJaunes Scraper — mode complet\n auditionné par Prospecta\n`, 5);
if (argQuery) {
  emitLog(`📖 Cible : "${CONFIG.query}"\n📍 Localisation : "${CONFIG.location}"\n`, 7);
}

/**
 * Mappe les données PagesJaunes vers le format Prospect interne
 */
function formatToProspect(d) {
  return {
    id: `pj_${Math.random().toString(36).substr(2, 9)}`,
    name: d.name || 'N/A',
    email: d.email || null,
    phone: d.phone || null,
    company: d.name || null,
    role: null,
    location: d.city || d.address || null,
    website: d.website || null,
    source_platform: 'pages_jaunes',
    socialLinks: {
      facebook: d.socials?.facebook || null,
      instagram: d.socials?.instagram || null,
      twitter: d.socials?.twitter || null,
      linkedin: d.socials?.linkedin || null,
    },
    aiIntelligence: {
      activities: { posts: [], comments: [] },
      skills: d.specialites || [],
      experience: [],
      education: [],
      certifications: [],
      recommendations: []
    },
    // Informations spécifiques à PagesJaunes
    contractDetails: {
      activity: d.category,
      status: d.verified ? 'Certifié PJ' : 'Standard',
      address: d.address,
      postalCode: d.postalCode,
      rating: d.rating,
      reviewCount: d.reviewCount
    }
  };
}

async function handleCookies(page) {
    try {
        const cookieSel = '#didomi-notice-agree-button, button[id*="accept"]';
        await page.waitForSelector(cookieSel, { timeout: 4000 });
        await page.click(cookieSel);
        await sleep(500);
    } catch {}
}

/**
 * Extrait les détails profonds (site web, email, réseaux sociaux) d'une fiche spécifique
 */
async function scrapeDetail(context, url) {
    const page = await context.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(1000);
        
        // Analyse du DOM pour récupérer les coordonnées précises
        return await page.evaluate(() => {
            const get = sel => document.querySelector(sel)?.textContent?.trim() || '';
            const getHref = sel => document.querySelector(sel)?.getAttribute('href') || '';
            
            const socials = {};
            document.querySelectorAll('a[href*="facebook.com"]').forEach(a => socials.facebook = a.href);
            document.querySelectorAll('a[href*="linkedin.com"]').forEach(a => socials.linkedin = a.href);

            return {
                email: getHref('a[href^="mailto:"]').replace('mailto:', ''),
                website: getHref('a[data-pj-action="website"]'),
                phone: get('[itemprop="telephone"], .coord-numero'),
                address: get('address, [class*="address"]'),
                specialites: Array.from(document.querySelectorAll('[class*="specialite"]')).map(e => e.textContent.trim()),
                socials
            };
        });
    } catch (e) {
        return null;
    } finally {
        await page.close();
    }
}

/**
 * Fonction principale pilotant le processus de recherche et d'extraction
 */
async function main() {
  emitLog('🛰️ Initialisation de la session PagesJaunes...', 10);

  // Initialisation du navigateur
  const browser = await chromium.launch({ headless: CONFIG.headless });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });

  try {
    const page = await context.newPage();
    // Construction de l'URL de recherche selon le mode
    const searchUrl = CONFIG.mode === 'personne' 
        ? `${BASE}/pagesblanches/recherche?quoiqui=${encodeURIComponent(CONFIG.query)}&ou=${encodeURIComponent(CONFIG.location)}`
        : `${BASE}/annuaire/chercherlespros?quoiqui=${encodeURIComponent(CONFIG.query)}&ou=${encodeURIComponent(CONFIG.location)}`;
    
    emitLog(`\n── RECHERCHE ANNUAIRE ─────────────────────────────────\n`, 15);
    emitLog(`🔍 Indexation sur ${BASE}...`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await handleCookies(page);

    // Extraction des cartes de résultats (cards)
    const cards = await page.evaluate(() => {
        const items = [];
        const sel = 'article.bi-pjcard, div[class*="bi-pjcard"], article[class*="personne"]';
        document.querySelectorAll(sel).forEach(el => {
            const name = el.querySelector('h3, [class*="denomination"]')?.textContent?.trim();
            const url = el.querySelector('a[href*="/pros/"], a[href*="/pagesblanches/"]')?.href;
            if (name && url && items.length < 20) items.push({ name, url });
        });
        return items;
    });

    emitLog(`✨ ${cards.length} fiches identifiées dans l'annuaire.`, 25);
    emitLog(`\n── EXTRACTION DÉTAILLÉE ────────────────────────────────\n`);

    // Traitement détaillé de chaque résultat trouvé
    for (let i = 0; i < Math.min(cards.length, CONFIG.maxResults); i++) {
        const card = cards[i];
        const currentPct = 25 + Math.round(((i + 1) / Math.min(cards.length, CONFIG.maxResults)) * 70);
        emitLog(`   📖 [${i + 1}/${CONFIG.maxResults}] ${card.name}`, currentPct);
        
        // On visite la page de détails pour avoir les infos complètes
        const detail = await scrapeDetail(context, card.url);
        if (detail) {
            // Livraison du résultat converti
            emitResult(formatToProspect({ ...card, ...detail }));
        }
        // Respect du délai entre les fiches
        await sleep(CONFIG.delay);
    }

    emitLog(`\n── SYNTHÈSE ───────────────────────────────────────────\n`);
    emitLog("✅ Extraction PagesJaunes terminée avec succès.", 100);
  } catch (err) {
    emitLog(`❌ Erreur fatale : ${err.message}`, 100);
  } finally {
    // Fermeture du navigateur
    await browser.close();
  }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
