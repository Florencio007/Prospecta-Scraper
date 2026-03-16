const { chromium } = require('playwright');
const fs = require('fs');

/**
 * Google Maps Hotel Scraper - Antananarivo (Playwright version)
 * Données récupérées par hôtel :
 *   - Nom, Téléphone, Site web, Plateforme
 *   - Heures d'ouverture, Coordonnées GPS
 *   - À propos, Avis (note + commentaires)
 *
 * Usage  : node scraper_googlemaps.cjs
 * Output : hotels.json
 */

const QUERY = process.argv[2] || 'hotel';
const LOCATION = process.argv[3] || 'Antananarivo';
const MAX_RESULTS = parseInt(process.argv[4] || '20', 10);
const USER_ID = process.argv[5] || null;
const TYPE = process.argv[6] || 'tous';

const CONFIG = {
  searchQuery: `${QUERY} ${LOCATION}`.trim(),
  maxHotels: MAX_RESULTS,
  outputFile: 'last_gmaps_results.json',
  headless: true, // forcé à true en backend
  delayBetweenHotels: 1000,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const cleanText = (text) => {
  if (!text) return '';
  return text.replace(/^[\uE000-\uF8FF\u2000-\u200B\u2028\u2029\uFEFF\u00A0]|[\uE000-\uF8FF]/g, '').trim();
};

function emitLog(msg, pct = undefined) {
  console.log(msg);
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}

function emitResult(result) {
  process.stdout.write(`RESULT:${JSON.stringify(result)}\n`);
}

// ── Helpers de filtrage ───────────────────────────────────────────────────────

/**
 * Retourne true si le texte ressemble à un prix (ex: "452 320 Ar", "579997 Ar")
 */
function isPriceLike(t) {
  // Montants en Ariary (avec ou sans espaces) ou en devises courantes
  return /^\d[\d\s]*\s*Ar\b/.test(t) || /^\d[\d\s,.']*\s*(€|\$|USD|EUR|MGA)\b/.test(t);
}

/**
 * Retourne true si le texte ressemble à une plage de dates ou une date de dispo
 * ex: "29-30 mars", "15-17 avr.", "lun. 10 avr."
 */
function isDateLike(t) {
  return /\d{1,2}\s*[-–]\s*\d{1,2}\s*(jan|fév|mar|avr|mai|juin|juil|août|sep|oct|nov|déc)/i.test(t)
    || /^(lun|mar|mer|jeu|ven|sam|dim)\.\s*\d/i.test(t)
    || /^\d{1,2}\s+(jan|fév|mar|avr|mai|juin|juil|août|sep|oct|nov|déc)/i.test(t);
}

/**
 * Retourne true si le texte est clairement une catégorie d'étoiles standalone
 * ex: "Hôtel 4 étoiles" seul dans un tag — on le garde uniquement comme starRating
 */
function isStarCategoryOnly(t) {
  return /^hôtel\s+\d\s+étoile/i.test(t) || /^hotel\s+\d\s+star/i.test(t);
}

/**
 * Filtre principal appliqué à chaque candidat amenity
 */
function isValidAmenity(t) {
  if (!t || t.length <= 2) return false;
  if (/^\d+$/.test(t)) return false;           // chiffre seul
  if (isPriceLike(t)) return false;             // prix
  if (isDateLike(t)) return false;              // date de dispo
  if (isStarCategoryOnly(t)) return false;      // "Hôtel 4 étoiles" standalone
  // Exclure les textes trop courts qui sont souvent des artefacts UI
  if (t.length < 4) return false;
  return true;
}

/**
 * Filtre pour la description : exclure les blocs qui ne sont que prix/dates
 */
function isValidDescription(t) {
  if (!t || t.length <= 20) return false;
  if (isPriceLike(t.trim())) return false;
  if (isDateLike(t.trim())) return false;
  // Exclure si le texte contient majoritairement des chiffres (prix formatés)
  if (/^\d[\d\s]*Ar/.test(t.trim())) return false;
  return true;
}

// ── Scroll la liste latérale pour charger plus de cartes ─────────────────────
async function scrollList(page) {
  await page.evaluate(async () => {
    const feed = document.querySelector('[role="feed"]');
    if (!feed) return;
    await new Promise(resolve => {
      let last = 0;
      const timer = setInterval(() => {
        feed.scrollBy(0, 400);
        if (feed.scrollTop === last) { clearInterval(timer); resolve(); }
        last = feed.scrollTop;
      }, 400);
    });
  });
}

// ── Récupérer les liens de toutes les cartes dans la liste ───────────────────
async function getHotelLinks(page) {
  try {
    const selector = page.locator('[role="feed"] .Nv2PK a').first();
    await selector.waitFor({ state: 'attached', timeout: 15000 });
  } catch (_) {
    emitLog("   ⚠️ Feed non trouvé ou timeout.");
  }

  // Scroll several times to load a maximum of results
  for (let i = 0; i < 6; i++) {
    await scrollList(page);
    await sleep(1200);
  }

  const links = await page.evaluate(() => {
    const cards = document.querySelectorAll('[role="feed"] .Nv2PK a[href*="/maps/place/"]');
    const seen = new Set();
    const result = [];
    cards.forEach(a => {
      const clean = a.href.split('?')[0];
      if (!seen.has(clean)) { seen.add(clean); result.push(a.href); }
    });
    return result;
  });

  emitLog(`🔗 ${links.length} liens trouvés dans la liste`);
  return links;
}

// ── Scraper les détails d'une fiche hôtel ────────────────────────────────────
async function scrapeHotelDetail(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try { await page.waitForSelector('h1', { state: 'attached', timeout: 15000 }); } catch (e) { console.log("⚠️ Nom non trouvé, attente prolongée."); }
  const earlyName = await page.evaluate(() => { const el = document.querySelector('h1'); return el ? el.textContent.trim() : ''; });
  console.log('DEBUG H1s:', earlyName);
  await sleep(2000);

  // Ouvrir le panneau "Heures d'ouverture" s'il est réduit
  try {
    const hoursBtn = page.locator('[data-section-id="hours"] [jsaction*="pane.openhours"]').first();
    if (await hoursBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await hoursBtn.click();
      await sleep(800);
    }
  } catch (_) { }

  // ── 1. Extraire les infos de base ─────────────────────────────────────────
  const coreData = await page.evaluate(() => {
    const data = {};
    data.name = document.querySelector('h1')?.textContent?.trim() || '';
    const addrEl = document.querySelector('[data-item-id="address"] .Io6YTe, [data-item-id="address"]');
    data.address = addrEl ? addrEl.textContent.trim() : '';
    const phoneEl = document.querySelector('[data-item-id*="phone"] .Io6YTe, [data-item-id*="phone"]');
    data.phone = phoneEl ? phoneEl.textContent.trim() : '';
    const webEl = document.querySelector('[data-item-id="authority"]');
    data.website = webEl ? (webEl.href || webEl.querySelector('a')?.href || '') : '';
    const plusCodeEl = document.querySelector('[data-item-id="oloc"] .Io6YTe, [data-item-id="oloc"]');
    if (plusCodeEl) data.plusCode = plusCodeEl.textContent.trim().split(' ')[0];
    return data;
  });

  // ── 2. Parcourir les onglets ──────────────────────────────────────────────
  let aboutData = { amenities: [], description: '', plusCode: '' };
  let reviews = [];

  const tabs = await page.$$('.buttonText, .m6QErb button, [role="tab"]');
  for (const tab of tabs) {
    try {
      const text = await tab.textContent();

      // ── Onglet "À propos" ──────────────────────────────────────────────────
      if (text && (text.includes('À propos') || text.includes('About'))) {
        await tab.click();
        await sleep(2000);

        const aData = await page.evaluate(() => {
          const amenities = [];

          // Sélecteurs ciblant les vraies sections d'équipements Google Maps
          const amenitySelectors = [
            '.iP2t7d .fontBodyMedium',
            '.iP2t7d span.fontBodyMedium',
            'ul.ZQ6we li span',
            'ul.ZQ6we li',
            '.OyY9Kc .fontBodyMedium',
            '.OyY9Kc span:not(.fontBodySmall)',
          ];

          for (const sel of amenitySelectors) {
            document.querySelectorAll(sel).forEach(el => {
              let t = el.textContent?.trim();
              t = t?.replace(/^[\uE000-\uF8FF\u2000-\u200B\u2028\u2029\uFEFF\u00A0]/, '').trim();
              if (t && !amenities.includes(t)) amenities.push(t);
            });
          }

          const descSelectors = [
            '.PYv6f',
            '.drf9m',
            '.OoXEc',
            '.QoXOEc',
            '[jslog*="metadata"] span',
          ];
          let descParts = [];
          for (const sel of descSelectors) {
            document.querySelectorAll(sel).forEach(el => {
              const t = el.textContent?.replace(/^[\uE000-\uF8FF]/, '').trim();
              if (t && t.length > 30) descParts.push(t);
            });
          }

          return { amenities, description: descParts.join('\n\n') };
        });

        // Appliquer les filtres côté Node (plus fiable qu'en page.evaluate)
        const filteredAmenities = aData.amenities.filter(isValidAmenity);
        const filteredDesc = aData.description
          .split('\n\n')
          .filter(isValidDescription)
          .join('\n\n');

        aboutData = {
          ...aboutData,
          amenities: filteredAmenities,
          description: filteredDesc,
        };
      }

      // ── Onglet "Avis" ──────────────────────────────────────────────────────
      if (text && (text.includes('Avis') || text.includes('Reviews'))) {
        await tab.click();
        await sleep(2000);

        reviews = await page.evaluate(() => {
          const items = [];
          const texts = new Set();
          document.querySelectorAll('.jftiEf, .G67oK, [data-review-id]').forEach(el => {
            const author = el.querySelector('.d4r55, .TSZ61b')?.textContent?.trim() || 'Client Maps';
            const text = el.querySelector('.wiI7c, .MyEned, .wiI7cb')?.textContent?.trim() || '';
            const date = el.querySelector('.rsqaUf, .P76i9c, .rsqawe')?.textContent?.trim() || '';
            const ratingEl = el.querySelector('span[role="img"][aria-label*="étoile"], .kv96bc, .kvMYC');
            const rating = ratingEl ? ratingEl.getAttribute('aria-label') || ratingEl.textContent : '';
            if (author && (text || rating) && !texts.has(text)) {
              items.push({ author, text, date, rating });
              if (text) texts.add(text);
            }
          });
          return items.slice(0, 10);
        });
      }
    } catch (_) { }
  }

  // ── 3. Finalisation ───────────────────────────────────────────────────────
  const data = await page.evaluate((context) => {
    const { coreData, aboutData, reviews } = context;
    const gpsMatch = window.location.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const gps = gpsMatch ? { lat: parseFloat(gpsMatch[1]), lng: parseFloat(gpsMatch[2]) } : null;

    const clean = (t) => {
      if (!t) return '';
      return t.replace(/^[\uE000-\uF8FF\u2000-\u200B\u2028\u2029\uFEFF\u00A0]|[\uE000-\uF8FF]/g, '').trim();
    };

    const rating = document.querySelector('.F7nice span[aria-hidden="true"]')?.textContent?.trim() || '';
    const reviewCount = document.querySelector('.F7nice span[aria-label*="avis"]')?.textContent?.trim()?.replace(/[()]/g, '').trim() || '';
    const category = document.querySelector('button[jsaction*="pane.rating.category"], .DkEaL, .fontBodyMedium .fontBodyMedium')?.textContent?.trim() || '';

    const starsEl = Array.from(document.querySelectorAll('.fontBodyMedium, span'))
      .find(el => /Hôtel \d étoile|Hotel \d star/i.test(el.textContent));
    const starRating = starsEl ? starsEl.textContent.trim() : '';

    const coreDataCleaned = {
      name: clean(coreData.name),
      address: clean(coreData.address),
      phone: clean(coreData.phone),
      plusCode: clean(coreData.plusCode),
      website: coreData.website,
    };

    return {
      name: coreDataCleaned.name || clean(document.querySelector('h1')?.textContent),
      address: coreDataCleaned.address,
      phone: coreDataCleaned.phone,
      website: coreDataCleaned.website,
      plusCode: coreDataCleaned.plusCode || clean(aboutData.plusCode),
      rating,
      reviewCount,
      gps,
      category,
      starRating,
      about: {
        amenities: aboutData.amenities || [],
        description: clean(aboutData.description),
      },
      reviews: reviews.map(r => ({ ...r, author: clean(r.author), text: clean(r.text) })),
      url: window.location.href,
      platform: coreDataCleaned.website ? 'Site propre' : 'Google Maps',
    };
  }, { coreData, aboutData, reviews });

  return data;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Démarrage du scraper Google Maps (Playwright)...\n');

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--lang=fr-FR',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    javaScriptEnabled: true,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'log') console.log(`[PAGE LOG] ${msg.text()}`);
  });

  try {
    // 1. Page de recherche Google Maps
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(CONFIG.searchQuery)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // 2. Accepter les cookies si présents
    try {
      const btn = page.locator('form[action*="consent"] button, button[aria-label*="Accepter"], button[aria-label*="Accept"]').first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await sleep(1500);
      }
    } catch (_) { }

    // 3. Collecter les liens
    emitLog(`🛰️ Recherche de "${CONFIG.searchQuery}" sur Maps...`, 10);
    const links = await getHotelLinks(page);
    const toScrape = links.slice(0, CONFIG.maxHotels);
    emitLog(`📋 ${links.length} résultats trouvés, analyse détaillée de ${toScrape.length} fiches...`, 30);

    // 4. Visiter chaque fiche
    const hotels = [];
    for (let i = 0; i < toScrape.length; i++) {
      const url = toScrape[i];
      const progress = 30 + Math.floor((i / toScrape.length) * 60);
      emitLog(`📍 Analyse de la fiche [${i + 1}/${toScrape.length}]`, progress);

      try {
        const detail = await scrapeHotelDetail(page, url);

        const payload = {
          name: detail.name,
          category: detail.category,
          address: detail.address,
          phone: detail.phone,
          website: detail.website || '',
          rating: detail.rating,
          totalScore: detail.reviewCount || '',
          mapsUrl: detail.url || url,
          gps: detail.gps,
          platform: detail.platform,
          hours: detail.hours,
          about: detail.about,
          reviews: detail.reviews,

          contractDetails: detail,
          aiIntelligence: {
            activities: {
              posts: [],
              comments: [],
            },
            contactInfo: {
              phones: detail.phone ? [detail.phone] : [],
              emails: [],
              addresses: detail.address ? [detail.address] : [],
            },
            executiveSummary: detail.about?.description ||
              (detail.category
                ? `${detail.name} est un établissement de type "${detail.category}".`
                : `Établissement professionnel listé sur Google Maps.`),
            companyCulture: {
              mission: detail.about?.amenities?.length
                ? `Équipements et services : ${detail.about.amenities.join(', ')}`
                : '',
            },
          },
        };

        hotels.push(payload);
        emitResult(payload);
      } catch (err) {
        emitLog(`❌ Erreur sur la fiche ${i + 1}: ${err.message}`, progress);
        hotels.push({ url, error: err.message });
      }

      await sleep(CONFIG.delayBetweenHotels);
    }

    emitLog(`🏁 Fin de l'extraction. ${hotels.length} fiches analysées.`, 100);

    // 5. Sauvegarde JSON
    const output = {
      scrapedAt: new Date().toISOString(),
      query: CONFIG.searchQuery,
      total: hotels.length,
      hotels,
    };
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2), 'utf8');

  } finally {
    await browser.close();
    emitLog('🏁 Navigateur fermé.');
  }
}

main().catch(console.error);
