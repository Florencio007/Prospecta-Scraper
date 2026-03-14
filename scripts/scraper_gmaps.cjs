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
    headless: false, // Modification pour voir la progression
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=fr-FR'],
  });

  const ctx  = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

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

      const items = await page.locator('[role="feed"] > div').all();
      for (const item of items) {
        checkCancel();
        if (results.length >= MAX_RESULTS) break;

        try {
          const nameEl = item.locator('.fontHeadlineSmall, [jsan*="heading"]').first();
          const name = await nameEl.innerText({ timeout: 1000 }).catch(() => '');
          if (!name || results.find(r => r.name === name)) continue;

          const texts = await item.locator('.W4Efsd > span').allInnerTexts().catch(() => []);
          const category = texts[0] || '';
          const ratingText = texts.find(t => /^\d[.,]\d/.test(t)) || '';
          const ratingStar = parseFloat(ratingText.replace(',', '.')) || 0;
          const totalScore = texts.find(t => /^\([\d,]+\)$/.test(t)) || '';
          const address = texts.filter(t => t.includes(',') || t.match(/\d{2,}/)).slice(-1)[0] || '';
          
          const linkEl = item.locator('a[href*="maps"]').first();
          const href = await linkEl.getAttribute('href').catch(() => '');
          let phone = texts.find(t => /^\+?[\d\s\-().]{7,}$/.test(t)) || '';
          const websiteEl = item.locator('a[data-value="Website"]');
          let website = await websiteEl.getAttribute('href').catch(() => '');

          // --- DEEP EXTRACTION VIA NEW TAB ---
          if (href) {
            let detailPage = null;
            try {
              detailPage = await ctx.newPage();
              await detailPage.goto(href, { waitUntil: 'domcontentloaded', timeout: 15000 });
              await sleep(750);
              
              const detail = await detailPage.evaluate(() => {
                 const getAttr = (sel, attr) => document.querySelector(sel)?.getAttribute(attr) || '';
                 const getText = sel => document.querySelector(sel)?.innerText?.trim() || '';
                 
                 // Website
                 let websiteUrl = getAttr('a[data-item-id="authority"]', 'href') || 
                                    getAttr('[data-item-id="authority"] a', 'href') || '';
                 if (!websiteUrl) {
                    const allLinks = Array.from(document.querySelectorAll('a[href^="http"]'));
                    const possible = allLinks.find(a => !a.href.includes('google.') && !a.href.includes('maps.google.') && a.offsetParent !== null);
                    if (possible) websiteUrl = possible.href;
                 }
                 
                 // Phone
                 let phoneNum = getAttr('button[data-item-id^="phone:tel:"]', 'data-item-id')?.replace('phone:tel:', '');
                 if (!phoneNum) {
                    const phoneEl = document.querySelector('button[aria-label*="0"], button[aria-label*="+33"], [data-item-id^="phone"]');
                    if (phoneEl) {
                        const m = phoneEl.getAttribute('aria-label')?.match(/(?:\+33|0)[1-9](?:[\s.-]*\d{2}){4}/);
                        if (m) phoneNum = m[0];
                    }
                 }
                 if (!phoneNum) {
                    const bodyText = document.body.innerText;
                    const m = bodyText.match(/(?:\+33|0)[1-9](?:[\s.-]*\d{2}){4}/);
                    if (m) phoneNum = m[0];
                 }
                 
                 // Address
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
            name,
            category,
            address,
            phone,
            website: website || '',
            rating: ratingStar,
            totalScore: totalScore.replace(/[()\s]/g, ''),
            mapsUrl: href || '',
          };
          results.push(r);
          sendResult(r);

          const pct = 20 + Math.round((results.length / MAX_RESULTS) * 75);
          emitLog(`   📍 ${name} [${category}]`, Math.min(pct, 95));
        } catch (_) {}
      }

      // Scroll the feed
      await page.evaluate(() => {
        const feed = document.querySelector('[role="feed"]');
        if (feed) feed.scrollBy(0, 600);
      });
      await sleep(750);

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
    sendProgress(100, `❌ Erreur: ${err.message}`);
  } finally {
    await browser.close();
    if (fs.existsSync(CANCEL_LOCK_FILE)) fs.unlinkSync(CANCEL_LOCK_FILE);
  }
}

main().catch(err => {
  process.stderr.write(`[GMaps Playwright] Unhandled: ${err.message}\n`);
  process.exit(1);
});
