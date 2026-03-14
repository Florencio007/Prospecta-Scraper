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
              await detailPage.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
              await sleep(1500);

              // Tenter d'ouvrir les horaires
              try {
                const hoursBtn = detailPage.locator('[data-section-id="hours"] [jsaction*="pane.openhours"]').first();
                if (await hoursBtn.isVisible()) await hoursBtn.click();
              } catch (_) {}

              const detail = await detailPage.evaluate(() => {
                const getAttr = (sel, attr) => document.querySelector(sel)?.getAttribute(attr) || '';
                
                // Coordonnées GPS
                const gpsMatch = window.location.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                const gps = gpsMatch ? { lat: parseFloat(gpsMatch[1]), lng: parseFloat(gpsMatch[2]) } : null;

                // Site web & Plateforme
                const websiteEl = document.querySelector('a[data-item-id*="authority"], a[aria-label*="site"], a[href*="booking"], a[href*="tripadvisor"], a[href*="airbnb"]');
                const websiteUrl = websiteEl?.href || '';
                let platform = 'Site propre';
                if (websiteUrl.includes('booking.com')) platform = 'Booking.com';
                else if (websiteUrl.includes('tripadvisor')) platform = 'TripAdvisor';
                else if (websiteUrl.includes('airbnb')) platform = 'Airbnb';

                // Téléphone
                let phoneNum = getAttr('button[data-item-id^="phone:tel:"]', 'data-item-id')?.replace('phone:tel:', '');
                if (!phoneNum) {
                  const phoneEl = document.querySelector('button[data-tooltip*="phone"] .Io6YTe, [data-tooltip="Copier le numéro de téléphone"]');
                  phoneNum = phoneEl?.innerText?.trim() || '';
                }

                // Horaires
                const hours = {};
                document.querySelectorAll('.t39EBf tr, [data-section-id="hours"] tr').forEach(row => {
                  const day = row.querySelector('td:first-child, .ylH6lf')?.innerText?.trim();
                  const time = row.querySelector('td:last-child, .mxowUb li')?.innerText?.trim();
                  if (day && time) hours[day] = time;
                });

                // À propos & Équipements
                const amenities = Array.from(document.querySelectorAll('li.OyY9Kc span, .fontBodyLarge li span'))
                  .map(el => el.innerText.trim()).filter(t => t.length > 1 && t.length < 60);
                
                const description = document.querySelector('.OoXEc, .QoXOEc, [jslog*="metadata"] span')?.innerText?.trim() || '';

                // Avis
                const reviews = Array.from(document.querySelectorAll('[data-review-id], .jftiEf')).slice(0, 5).map(el => ({
                  author: el.querySelector('.d4r55, .hh2c6')?.innerText?.trim() || '',
                  stars: el.querySelector('[aria-label*="étoile"]')?.getAttribute('aria-label') || '',
                  text: el.querySelector('.wiI7pd, .MyEned span')?.innerText?.trim() || ''
                }));

                return { 
                  websiteUrl, 
                  phoneNum, 
                  gps, 
                  platform, 
                  hours: Object.keys(hours).length > 0 ? hours : null,
                  amenities: [...new Set(amenities)],
                  description,
                  reviews
                };
              });
              
              if (detail.websiteUrl) website = detail.websiteUrl;
              if (detail.phoneNum && detail.phoneNum.length > 5) phone = detail.phoneNum;
              
              // Enrichissement de l'objet résultat final
              item.gps = detail.gps;
              item.platform = detail.platform;
              item.hours = detail.hours;
              item.about = { amenities: detail.amenities, description: detail.description };
              item.reviews = detail.reviews;
              
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
            address: item.address || address,
            phone: phone || item.phone,
            website: website || '',
            rating: item.ratingStar,
            totalScore: item.totalScore || '',
            mapsUrl: item.href || '',
            // Nouvelles données
            gps: item.gps,
            platform: item.platform,
            hours: item.hours,
            about: item.about,
            reviews: item.reviews
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
