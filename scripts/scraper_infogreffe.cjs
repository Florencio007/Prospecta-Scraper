/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║     PROSPECTA — Scraper Infogreffe.fr  (Playwright v1.0)       ║
 * ║     Identité · Documents · Dirigeants · Bénéficiaires          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// Initialisation des dépendances
const { chromium } = require('playwright');
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

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
// Récupération des arguments dynamiques (mode, terme de recherche, limite de résultats)
emitLog(`🚀 Infogreffe Scraper — mode complet\n auditionné par Prospecta\n`, 5);
if (argQuery) {
  emitLog(`⚖️ Cible : "${CONFIG.query}"\n📊 Mode : ${CONFIG.mode}\n`, 7);
}

/**
 * Mappe les données techniques d'Infogreffe vers le format Prospect de Prospecta
 */
function mapToProspect(data) {
  return {
    id: data.siren || Math.random().toString(36).substr(2, 9),
    name: data.denomination || 'N/A',
    email: data.email || null,
    phone: data.telephone || null,
    company: data.denomination || null,
    role: data.dirigeants?.[0]?.nom || null,
    location: data.ville || data.adresse || null,
    website: data.site_web || null,
    source_platform: 'infogreffe',
    socialLinks: {
      linkedin: null,
      facebook: null,
    },
    aiIntelligence: {
      activities: { posts: [], comments: [] },
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      recommendations: []
    },
    // Détails contractuels et légaux extraits
    contractDetails: {
      siren: data.siren,
      legalForm: data.forme_juridique,
      capital: data.capital,
      activity: data.activite,
      status: data.statut,
      creationDate: data.date_creation,
      employees: data.effectifs
    }
  };
}

/**
 * Tente d'accepter les bandeaux de cookies automatiquement
 */
async function handleCookies(page) {
    try {
        const cookieSel = '#didomi-notice-agree-button, button[id*="accept"]';
        await page.waitForSelector(cookieSel, { timeout: 4000 });
        await page.click(cookieSel);
        await sleep(500);
    } catch { /* pas de bandeau détecté */ }
}

/**
 * Point d'entrée principal du scraper
 */
async function main() {
    emitLog('🛰️ Inscription au guichet Infogreffe...', 10);

    // Initialisation de Playwright (moteur Chromium)
    const browser = await chromium.launch({
        headless: CONFIG.headless,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    // Configuration de la session utilisateur
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1440, height: 900 },
        locale: 'fr-FR',
    });

    try {
        const page = await context.newPage();
        const searchUrl = `${BASE}/recherche-entreprise-greffe-tribunal-commerce?term=${encodeURIComponent(CONFIG.query)}`;
        
        emitLog(`\n── RECHERCHE LÉGALE ───────────────────────────────────\n`, 15);
        emitLog(`🔍 Recherche sur le registre central : ${CONFIG.query}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 40000 });
        await sleep(2000);
        await handleCookies(page);

        // Récupération des liens d'entreprises depuis la page de résultats
        const links = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('a[href*="/entreprise/"]').forEach(a => {
                const href = a.href.split('?')[0];
                const name = a.textContent.trim();
                // On limite à 15 liens maximum avant le tri final
                if (name && results.length < 15) {
                    results.push({ url: href, name });
                }
            });
            return results;
        });

        emitLog(`✨ ${links.length} fiches légales identifiées.`, 25);
        emitLog(`\n── EXTRACTION DÉTAILLÉE ────────────────────────────────\n`);

        // Parcours de chaque entreprise pour l'extraction de détails
        for (let i = 0; i < Math.min(links.length, CONFIG.maxResults); i++) {
            const link = links[i];
            const currentPct = 25 + Math.round(((i + 1) / Math.min(links.length, CONFIG.maxResults)) * 70);
            emitLog(`   🏛️ [${i + 1}/${CONFIG.maxResults}] ${link.name}`, currentPct);
            
            const p2 = await context.newPage();
            try {
                await p2.goto(link.url, { waitUntil: 'networkidle' });
                await sleep(1500);
                
                // Analyse de la page entreprise via evaluate (JS injecté)
                const data = await p2.evaluate(() => {
                    const getText = sel => document.querySelector(sel)?.textContent?.trim() || '';
                    const bodyText = document.body.innerText;
                    const rx = pat => bodyText.match(new RegExp(pat, 'i'))?.[1]?.trim() || '';

                    return {
                        denomination: getText('h1') || rx('Dénomination\\s*[\\s:-]*([^\\n]+)'),
                        siren: rx('SIREN\\s*[\\s:-]*(\\d{3}\\s*\\d{3}\\s*\\d{3})').replace(/\s/g, ''),
                        forme_juridique: rx('Forme juridique\\s*[\\s:-]*([^\\n]+)'),
                        capital: rx('Capital\\s*[\\s:-]*([\\d\\s,]+€)'),
                        statut: bodyText.includes('En activité') ? 'En activité' : 'N/A',
                        activite: rx('Activité\\s*[\\s:-]*([^\\n]+)'),
                        date_creation: rx('Date de création\\s*[\\s:-]*(\\d{2}/\\d{2}/\\d{4})'),
                        adresse: rx('Siège social\\s*[\\s:-]*([^\\n]+)'),
                        telephone: rx('Téléphone\\s*[\\s:-]*((?:0|\\+33)[\\s.\\d]+)'),
                        email: rx('Email\\s*[\\s:-]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-z]{2,})'),
                        dirigeants: Array.from(document.querySelectorAll('a[href*="/dirigeant/"]')).map(a => ({ nom: a.textContent.trim() }))
                    };
                });

                if (data.denomination) {
                    // Envoi du prospect converti vers l'application
                    emitResult(mapToProspect(data));
                }
            } catch (e) {
                emitLog(`Erreur lors de l'extraction de ${link.name}: ${e.message}`);
            } finally {
                await p2.close();
            }
            // Temporisation entre deux fiches pour charger moins agressivement
            await sleep(CONFIG.delay);
        }

    emitLog(`\n── SYNTHÈSE ───────────────────────────────────────────\n`);
    emitLog("✅ Extraction Infogreffe terminée avec succès.", 100);
  } catch (err) {
    emitLog(`❌ Erreur fatale : ${err.message}`, 100);
  } finally {
    // Fermeture propre du navigateur
    await browser.close();
  }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
