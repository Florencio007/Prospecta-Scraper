'use strict';
// ═══════════════════════════════════════════════
// Google Maps Scraper — Playwright Edition v2.0
// ═══════════════════════════════════════════════
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

chromium.use(StealthPlugin());

const QUERY         = process.argv[2] || 'hotel';
const LOCATION      = process.argv[3] || 'Antananarivo';
const MAX_RESULTS_RAW = process.argv[4] || '20';
const MAX_RESULTS   = MAX_RESULTS_RAW === 'unlimited' ? 9999 : parseInt(MAX_RESULTS_RAW, 10);
const USER_ID       = process.argv[5] || null;
const TYPE          = process.argv[6] || 'tous';

const OUTPUT_FILE      = path.join(__dirname, 'last_gmaps_results.json');
const CANCEL_LOCK_FILE = path.join(__dirname, 'cancel_scrape.lock');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function emitLog(msg, pct = undefined) {
  // Console log pour l'exécution locale
  console.log(msg);
  // Envoi vers le frontend (SSE) afin d'être capté par le terminal Prospecta
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}
function sendResult(result) {
  process.stdout.write(`RESULT:${JSON.stringify(result)}\n`);
}
function checkCancel() {
  if (fs.existsSync(CANCEL_LOCK_FILE)) {
    emitLog('🛑 Arrêt demandé (Google Maps).', 100);
    process.exit(0);
  }
}

async function main() {
  emitLog(`🚀 Google Maps Scraper — mode complet\n auditionné par Prospecta\n`, 5);
  emitLog('🛰️ Lancement du moteur de recherche spécialisé...', 7);
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--headless=new',
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--lang=fr-FR'
    ],
  });

  const ctx  = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  // Bloquer images et fonts pour accélérer et éviter les hangs
  await page.route('**/*', route => {
    const type = route.request().resourceType();
    if (['image', 'font', 'media'].includes(type) || route.request().url().includes('google-analytics')) {
      route.abort();
    } else {
      route.continue();
    }
  });

  // Clean up stale lock
  if (fs.existsSync(CANCEL_LOCK_FILE)) fs.unlinkSync(CANCEL_LOCK_FILE);

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${QUERY} ${LOCATION}`)}`;
    emitLog(`\n── RECHERCHE ──────────────────────────────────────────\n`);
    emitLog(`🗺️  Cible : "${QUERY}"\n📍 Localisation : "${LOCATION}"\n`, 10);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Accept consent if present
    try {
      const consentBtn = page.locator('button:has-text("Tout accepter"), button:has-text("Accept all")');
      if (await consentBtn.count() > 0) {
        await consentBtn.first().click();
        await sleep(750);
      }
    } catch (_) {}

    await sleep(1500);
    emitLog('🔍 Analyse de la zone géographique et extraction des nœuds...', 20);

    const results = [];
    emitLog(`\n── ÉTABLISSEMENTS ─────────────────────────────────────\n`);

    // Scroll the feed to load more results
    for (let scroll = 0; scroll < 10 && results.length < MAX_RESULTS; scroll++) {
      checkCancel();

      const extracted = await page.evaluate(() => {
        const results = [];
        const links = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
        
        for (const link of links) {
          const container = link.closest('[role="feed"] > div') || link.parentElement.parentElement;
          if (!container) continue;

          // Nom de l'établissement
          const nameEl = container.querySelector('.fontHeadlineSmall, [jsan*="heading"], h3, .qBF1Pd');
          const name = nameEl ? nameEl.innerText.trim() : link.getAttribute('aria-label') || '';
          if (!name || name.length < 2) continue;

          // Extraction des meta-textes
          const texts = Array.from(container.querySelectorAll('.W4Efsd > span')).map(s => s.innerText.trim());
          const category = texts[0] || '';
          
          let ratingStar = 0;
          let totalScore = '';
          const ratingText = texts.find(t => /^\d[.,]\d/.test(t) || t.includes('avis'));
          if (ratingText) {
             const mStar = ratingText.match(/(\d[.,]\d)/);
             if (mStar) ratingStar = parseFloat(mStar[1].replace(',', '.'));
             const mTotal = ratingText.match(/\(([\d,]+)\)/);
             if (mTotal) totalScore = mTotal[1].replace(/,/g, '');
          }

          const address = texts.filter(t => t.includes(',') || t.match(/\d{2,}/)).slice(-1)[0] || '';
          const phone = texts.find(t => /^\+?[\d\s\-().]{7,}$/.test(t)) || '';
          const websiteEl = container.querySelector('a[data-value="Website"]');
          const website = websiteEl ? websiteEl.getAttribute('href') : '';
          const href = link.getAttribute('href');

          results.push({ name, category, ratingStar, totalScore, address, phone, website, href });
        }
        return results;
      }).catch(e => {
        return [];
      });

      if (extracted.length === 0) {
        emitLog('⚠️ Extraction échouée pour cette itération de scroll.');
        break;
      }

      for (const item of extracted) {
         if (results.find(r => r.name === item.name)) continue;
         if (results.length >= MAX_RESULTS) break;

         let phone = item.phone;
         let website = item.website;
         let address = item.address;

          // --- DEEP EXTRACTION VIA NEW TAB ---
          if (item.href) {
            let detailPage = null;
            try {
              detailPage = await ctx.newPage();
              await detailPage.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
              await sleep(750);
              
              const detail = await detailPage.evaluate(() => {
                 const getAttr = (sel, attr) => document.querySelector(sel)?.getAttribute(attr) || '';
                 
                 let websiteUrl = getAttr('a[data-item-id="authority"]', 'href') || 
                                    getAttr('[data-item-id="authority"] a', 'href') || '';
                 if (!websiteUrl) {
                    const allLinks = Array.from(document.querySelectorAll('a[href^="http"]'));
                    const possible = allLinks.find(a => !a.href.includes('google.') && !a.href.includes('maps.google.') && a.offsetParent !== null);
                    if (possible) websiteUrl = possible.href;
                 }
                 
                 let phoneNum = getAttr('button[data-item-id^="phone:tel:"]', 'data-item-id')?.replace('phone:tel:', '');
                 if (!phoneNum) {
                    const phoneEl = document.querySelector('button[aria-label*="0"], button[aria-label*="+33"], [data-item-id^="phone"]');
                    if (phoneEl) {
                        const m = phoneEl.getAttribute('aria-label')?.match(/(?:\+33|0)[1-9](?:[\s.-]*\d{2}){4}/);
                        if (m) phoneNum = m[0];
                    }
                 }
                 
                 let addr = getAttr('button[data-item-id="address"]', 'aria-label') || 
                            getAttr('button[aria-label*="Adresse"]', 'aria-label');
                 if (addr) addr = addr.replace(/^Adresse:\s*/i, '');
                 if (!addr) {
                    const addrEl = document.querySelector('button[data-item-id="address"]');
                    if (addrEl) addr = addrEl.innerText.trim();
                 }
                 
                 return { websiteUrl, phoneNum, addr };
              });
              
              if (detail.websiteUrl) website = detail.websiteUrl;
              if (detail.phoneNum && (!phone || phone.length < 5)) phone = detail.phoneNum;
              if (detail.addr && detail.addr.length > (address || '').length) address = detail.addr;
              
            } catch (err) {
              // Ignore detail extraction errors
            } finally {
              if (detailPage) await detailPage.close().catch(()=> {});
            }
          }
          // -----------------------------------

          const r = {
            name: item.name,
            category: item.category,
            address,
            phone,
            website: website || '',
            rating: item.ratingStar,
            totalScore: item.totalScore || '',
            mapsUrl: item.href || '',
          };
          results.push(r);
          sendResult(r);

          const pct = 20 + Math.round((results.length / MAX_RESULTS) * 75);
          emitLog(`   📍 ${item.name} [${item.category}]`, Math.min(pct, 95));
      }

      // Scroll the feed
      try {
        await page.evaluate(() => {
          const feed = document.querySelector('[role="feed"]');
          if (feed) feed.scrollBy(0, 800);
          else window.scrollBy(0, 800);
        });
      } catch (e) {
         emitLog('⚠️ Erreur mineure lors du scroll : ' + e.message);
      }
      await sleep(1000);

      // Check if all loaded
      const endText = await page.locator("text=Vous avez atteint la fin").count().catch(() => 0);
      if (endText > 0) break;
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    emitLog(`\n── SYNTHÈSE ───────────────────────────────────────────\n`);
    emitLog(`✅ ${results.length} établissements identifiés et exportés.\n`, 100);
    emitLog(`💾 Sauvegardé → ${path.basename(OUTPUT_FILE)}`);
  } catch (err) {
    process.stderr.write(`[GMaps Playwright] Error: ${err.message}\n`);
    emitLog(`❌ Erreur: ${err.message}`, 100);
  } finally {
    await browser.close();
    if (fs.existsSync(CANCEL_LOCK_FILE)) fs.unlinkSync(CANCEL_LOCK_FILE);
  }
}

main().catch(err => {
  process.stderr.write(`[GMaps Playwright] Unhandled: ${err.message}\n`);
  process.exit(1);
});
