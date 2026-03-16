'use strict';
/**
 * scraper_google.cjs — Prospecta AI
 * Scrape Google Maps + résultats organiques pour trouver des prospects B2B
 * Utilisé par server.js via l'agent local port 7842
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LOCK_FILE = path.join(__dirname, 'cancel_scrape.lock');

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isCancelled() {
  return fs.existsSync(LOCK_FILE);
}

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Scrape Google Maps pour trouver des entreprises locales
 */
async function scrapeGoogleMaps({ query, maxResults = 20, res }) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: rand(1280, 1440), height: rand(800, 960) },
    locale: 'fr-FR',
  });

  const page = await context.newPage();
  const prospects = [];
  let scraped = 0;

  try {
    send(res, 'PROGRESS', { message: 'Ouverture de Google Maps...', progress: 5 });

    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(mapsUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(rand(2000, 3000));

    // Accepter les cookies Google si présents
    const cookieBtn = page.locator('button:has-text("Tout accepter"), button:has-text("Accept all")');
    if (await cookieBtn.count() > 0) {
      await cookieBtn.first().click();
      await sleep(1000);
    }

    send(res, 'PROGRESS', { message: `Recherche "${query}" sur Google Maps...`, progress: 20 });

    let attempts = 0;
    const seenUrls = new Set();

    while (scraped < maxResults && attempts < 15) {
      if (isCancelled()) {
        send(res, 'CANCELLED', { message: 'Scraping annulé.' });
        break;
      }
      attempts++;

      // Récupérer les fiches visibles dans le panneau gauche
      const listings = await page.evaluate(() => {
        const items = [];
        // Sélecteurs Google Maps pour les fiches d'établissements
        const cards = document.querySelectorAll('[role="article"] a[href*="/maps/place/"], a[data-value="Directions"]');
        const seen = new Set();

        document.querySelectorAll('[role="article"]').forEach(article => {
          const linkEl = article.querySelector('a[href*="/maps/place/"]');
          const href = linkEl?.href || '';
          if (!href || seen.has(href)) return;
          seen.add(href);

          const nameEl = article.querySelector('[class*="fontHeadlineSmall"], .qBF1Pd');
          const ratingEl = article.querySelector('[role="img"][aria-label*="étoile"], [role="img"][aria-label*="star"]');
          const categoryEl = article.querySelector('.W4Efsd > span:first-child');
          const addressEl = article.querySelector('.W4Efsd > span:last-child');

          items.push({
            name: nameEl?.textContent?.trim() || '',
            href,
            rating: ratingEl?.getAttribute('aria-label') || '',
            category: categoryEl?.textContent?.trim() || '',
            address: addressEl?.textContent?.trim() || '',
          });
        });
        return items;
      });

      for (const listing of listings) {
        if (scraped >= maxResults) break;
        if (isCancelled()) break;
        if (!listing.name || seenUrls.has(listing.href)) continue;
        seenUrls.add(listing.href);

        try {
          // Cliquer sur la fiche pour voir les détails
          const card = page.locator(`a[href="${listing.href}"]`).first();
          if (await card.count() > 0) {
            await card.click();
            await sleep(rand(1500, 2500));
          }

          // Extraire les détails depuis le panneau de droite
          const details = await page.evaluate(() => {
            const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
            const getAttr = (sel, attr) => document.querySelector(sel)?.getAttribute(attr) || '';

            const allText = document.body.innerText;
            const emailMatch = allText.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
            const phoneEl = document.querySelector('button[data-tooltip="Copier le numéro de téléphone"], [data-item-id*="phone"]');
            const websiteEl = document.querySelector('a[data-item-id*="authority"]');

            return {
              phone: phoneEl?.getAttribute('aria-label')?.replace('Téléphone: ', '') || '',
              website: websiteEl?.href || '',
              email: emailMatch ? emailMatch[0] : '',
              hours: getText('[aria-label*="horaires"]'),
            };
          });

          const prospect = {
            id: `gmaps_${Date.now()}_${scraped}`,
            source: 'google_maps',
            name: listing.name,
            company: listing.name,
            title: listing.category || 'Entreprise',
            address: listing.address || '',
            rating: listing.rating || '',
            phone: details.phone || '',
            website: details.website || '',
            email: details.email || '',
            profileUrl: listing.href,
            scrapedAt: new Date().toISOString(),
          };

          prospects.push(prospect);
          scraped++;

          send(res, 'RESULT', { prospect });
          send(res, 'PROGRESS', {
            message: `${scraped} entreprises trouvées...`,
            progress: Math.min(20 + (scraped / maxResults) * 75, 95),
          });

        } catch (e) {
          // Fiche inaccessible, continuer
        }

        await sleep(rand(800, 1500));
      }

      // Scroll dans le panneau gauche pour charger plus
      if (scraped < maxResults) {
        await page.evaluate(() => {
          const panel = document.querySelector('[role="main"] > div > div');
          if (panel) panel.scrollBy(0, 500);
        });
        await sleep(rand(1500, 2500));
      }
    }

    send(res, 'DONE', {
      message: `Scraping terminé. ${scraped} entreprises trouvées.`,
      total: scraped,
      prospects,
    });

  } catch (err) {
    send(res, 'ERROR', { message: `Erreur Google Maps: ${err.message}` });
  } finally {
    await browser.close();
  }
}

/**
 * Enrichissement Google — trouve email/tel/site d'un prospect via recherche ciblée
 */
async function enrichViaGoogle({ name, company, location = '', email = '', res }) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });

  const page = await context.newPage();
  const enriched = {};

  try {
    const queries = [
      `"${company}" contact email ${location}`,
      `"${name}" "${company}" email téléphone`,
      `site:${company?.toLowerCase().replace(/\s+/g, '')}.com contact`,
    ].filter(Boolean);

    for (const q of queries) {
      if (isCancelled()) break;

      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`, {
        waitUntil: 'domcontentloaded', timeout: 15000,
      });
      await sleep(rand(1000, 2000));

      const found = await page.evaluate(() => {
        const text = document.body.innerText;
        const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/g);
        const phoneMatch = text.match(/\+?[\d\s\-().]{8,15}/g);
        const urlMatches = [...document.querySelectorAll('a[href^="http"]')]
          .map(a => a.href)
          .filter(h => !h.includes('google') && !h.includes('youtube'));

        return {
          emails: emailMatch ? [...new Set(emailMatch)].filter(e => !e.includes('google')) : [],
          phones: phoneMatch ? [...new Set(phoneMatch.map(p => p.trim()))].filter(p => p.length >= 8) : [],
          websites: urlMatches.slice(0, 3),
        };
      });

      if (found.emails.length) enriched.email = found.emails[0];
      if (found.phones.length) enriched.phone = found.phones[0];
      if (found.websites.length && !enriched.website) enriched.website = found.websites[0];

      if (enriched.email && enriched.phone && enriched.website) break;
      await sleep(rand(500, 1000));
    }

  } catch (err) {
    // Silencieux
  } finally {
    await browser.close();
  }

  return enriched;
}

module.exports = { scrapeGoogleMaps, enrichViaGoogle };
