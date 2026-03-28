/**
 * site_scraper_module.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 *  Module partagé : Scraping des sites officiels pour tous les canaux Prospecta
 *  Usage : const { scrapeOfficialSite, isOfficialSite } = require('./site_scraper_module.cjs');
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Blacklist — plateformes / portails / agrégateurs (500+ domaines) ─────────
const BLACKLIST = new Set([
  // OTA & RÉSERVATION HÔTELS
  'booking.com', 'hotels.com', 'expedia.com', 'expedia.fr', 'agoda.com', 'trivago.com', 'trivago.fr',
  'hostelworld.com', 'hotelscombined.com', 'kayak.com', 'kayak.fr', 'priceline.com', 'orbitz.com',
  'lastminute.com', 'voyage-prive.com', 'skyscanner.com', 'skyscanner.fr', 'accorhotels.com',
  'marriott.com', 'hilton.com', 'ihg.com', 'hyatt.com', 'wyndhamhotels.com', 'bestwestern.com',
  'choicehotels.com', 'radissonhotels.com', 'melia.com', 'nh-hotels.com', 'novotel.com', 'ibis.com',
  'hrs.com', 'hotel.de', 'hoteltonight.com', 'ebookers.com', 'travelzoo.com', 'opodo.fr', 'edreams.fr',
  'govoyages.com', 'promovacances.com',

  // AVIS & NOTES
  'tripadvisor.com', 'tripadvisor.fr', 'yelp.com', 'yelp.fr', 'trustpilot.com', 'trustpilot.fr',
  'avis-verifies.com', 'verified-reviews.com', 'google.com', 'google.fr', 'google.mg', 'foursquare.com',

  // RESTAURANTS & LIVRAISON
  'thefork.com', 'thefork.fr', 'lafourchette.com', 'opentable.com', 'zomato.com', 'deliveroo.fr',
  'ubereats.com', 'just-eat.fr', 'doordash.com', 'grubhub.com', 'glovo.com', 'foodpanda.com',
  'happycow.net', 'zenchef.com', 'resy.com', 'quandoo.fr',

  // RÉSEAUX SOCIAUX
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'tiktok.com', 'youtube.com',
  'pinterest.com', 'pinterest.fr', 'snapchat.com', 'reddit.com', 'threads.net', 'tumblr.com',
  'flickr.com', 'vimeo.com', 'dailymotion.com', 'whatsapp.com', 'telegram.org', 'discord.com',

  // ANNUAIRES & INFOS ENTREPRISES
  'pagesjaunes.fr', 'annuaire.fr', 'societe.com', 'verif.com', 'infogreffe.fr', 'pappers.fr',
  'kompass.com', 'europages.com', 'infobel.com', 'cylex.fr', 'manageo.fr', 'sirene.fr',
  'yellowpages.com', 'manta.com', 'crunchbase.com', 'zoominfo.com', 'yell.com',

  // MÉDIAS & DIVERS
  'wikipedia.org', 'lemonde.fr', 'lefigaro.fr', 'bfmtv.com', '20minutes.fr', 'liberation.fr',
  'lexpress.fr', 'lepoint.fr', 'journaldunet.com', '01net.com', 'techcrunch.com', 'forbes.com',
  'bloomberg.com', 'bbc.com', 'cnn.com', 'nytimes.com', 'rfi.fr', 'france24.com',
  'amazon.com', 'amazon.fr', 'ebay.fr', 'leboncoin.fr', 'vinted.fr', 'aliexpress.com',
  'github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com', 'wordpress.com', 'wix.com',
]);

function getRootDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function isOfficialSite(url) {
  if (!url || !url.startsWith('http')) return false;
  const d = getRootDomain(url);
  if (BLACKLIST.has(d)) return false;
  if ([...BLACKLIST].some(b => d.endsWith('.' + b))) return false;
  return true;
}

const axios = require('axios');
const cheerio = require('cheerio');
const pLimit = require('p-limit');

/**
 * Crawl the site to collect substantial text from multiple key pages using Cheerio (Fast).
 */
async function crawlSiteText(startUrl, emitLog) {
  const domain = getRootDomain(startUrl);
  const visited = new Set();
  const toVisit = [startUrl];
  let fullText = '';
  let pagesCollected = 0;
  const limit = pLimit(3); // Concurrency of 3 pages

  emitLog(`   🕵️ Début du crawling ultra-rapide (Cheerio) pour : ${domain}`);

  while (toVisit.length > 0 && pagesCollected < 6) {
    const batch = toVisit.splice(0, 3);
    const results = await Promise.all(batch.map(url => limit(async () => {
      if (visited.has(url)) return null;
      visited.add(url);

      try {
        emitLog(`      📄 Lecture : ${url}`);
        const response = await axios.get(url, { 
          timeout: 10000,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' 
          }
        });

        if (!response.headers['content-type']?.includes('text/html')) return null;

        const $ = cheerio.load(response.data);
        $('script, style, noscript, iframe', 'head').remove();
        
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        const links = [];
        
        $('a[href]').each((_, el) => {
          try {
            const href = $(el).attr('href');
            if (!href) return;
            const absolute = new URL(href, url).href.split('#')[0].replace(/\/$/, '');
            const u = new URL(absolute);
            if (u.hostname.replace(/^www\./, '') === domain) {
              links.push(absolute);
            }
          } catch (e) {}
        });

        return { text, links, url };
      } catch (err) {
        // emitLog(`      ⚠️ Erreur sur ${url} : ${err.message}`);
        return null;
      }
    })));

    for (const res of results) {
      if (!res) continue;
      fullText += `\n\n--- PAGE: ${res.url} ---\n${res.text}\n`;
      pagesCollected++;

      const priorityTerms = [/contact/i, /about/i, /a-propos/i, /services/i, /equipe/i, /team/i, /faq/i, /offres/i];
      for (const link of res.links) {
        if (!visited.has(link) && !toVisit.includes(link)) {
          if (priorityTerms.some(term => term.test(link))) {
            toVisit.unshift(link); 
          } else if (toVisit.length < 10) {
            toVisit.push(link);
          }
        }
      }
    }
  }

  return fullText;
}

/**
 * Scrape an official website using AI structuring.
 */
async function scrapeOfficialSite(page, siteInfo, options = {}) {
  const { url, name: givenName, position, userId } = siteInfo;
  const emitLog = options.emitLog || (() => {});
  const serverUrl = options.serverUrl || `http://localhost:${process.env.PORT || 8080}`;

  const result = {
    url,
    domain: getRootDomain(url),
    googlePosition: position,
  };

  // ── 1. Crawling du texte (Cheerio) ─────────────────────────────────────────
  const rawText = await crawlSiteText(url, emitLog);
  if (!rawText || rawText.length < 100) {
    result.error = "Contenu insuffisant pour analyse";
    return result;
  }

  // ── 2. Extraction des métadonnées techniques (OG Images, Favicon...) ───────
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const techMeta = await page.evaluate(() => ({
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
    logo: document.querySelector('.logo img, header img, [class*="logo"] img')?.src || '',
    favicon: document.querySelector('link[rel="icon"]')?.getAttribute('href') || '',
    lang: document.documentElement.lang || '',
  }));

  // ── 3. Appel à l'IA pour la structuration ────────────────────────────────
  emitLog(`   🤖 Structuration des données par IA...`);
  try {
    const http = require('http');
    const payload = JSON.stringify({ rawText, url, userId });
    
    const aiData = await new Promise((resolve, reject) => {
      const internalUrl = new URL(`${serverUrl}/api/ai/extract-site-data`);
      const req = http.request({
        hostname: internalUrl.hostname,
        port: internalUrl.port,
        path: internalUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 400) reject(new Error(`Server returned ${res.statusCode}: ${body}`));
          else {
            try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    // ── 5. Native Extraction (Multi-Source Email/Phone/Socials) ───────────────
    // On extrait les contacts par regex en plus de l'IA pour maximiser les chances
    const nativeContacts = {
      emails: [...new Set(rawText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])]
        .filter(e => !['example','domain','test','sentry'].some(x => e.toLowerCase().includes(x))),
      phones: [...new Set(rawText.match(/(?:\+?\d[\d\s\-().]{7,18}\d)/g) || [])]
        .map(p => p.trim()).filter(p => p.length >= 8 && p.length <= 20),
      socials: {}
    };

    const socialPatterns = {
      facebook: /facebook\.com\/[^"'\s?<>#]+/i,
      instagram: /instagram\.com\/[^"'\s?<>#]+/i,
      linkedin: /linkedin\.com\/(?:company|in)\/[^"'\s?<>#]+/i,
      twitter: /(?:twitter|x)\.com\/[^"'\s?<>#]+/i
    };

    for (const [p, reg] of Object.entries(socialPatterns)) {
      const m = rawText.match(reg);
      if (m) nativeContacts.socials[p] = m[0].startsWith('http') ? m[0] : 'https://' + m[0];
    }

    // Fusionner les résultats Natis + IA
    const finalResult = {
      ...aiData,
      url,
      domain: result.domain,
      googlePosition: position,
      ogImage: techMeta.ogImage,
      logo: techMeta.logo || aiData.logo || techMeta.favicon,
      favicon: techMeta.favicon,
      lang: techMeta.lang,
      scrapedAt: new Date().toISOString(),
      platform: 'Site Officiel (IA + Logic v5)',
      aiEnriched: true
    };

    // Merge contacts
    finalResult.contacts = finalResult.contacts || {};
    finalResult.contacts.emails = [...new Set([...(finalResult.contacts.emails || []), ...nativeContacts.emails])];
    finalResult.contacts.phones = [...new Set([...(finalResult.contacts.phones || []), ...nativeContacts.phones])];
    finalResult.socials = { ...(finalResult.socials || {}), ...nativeContacts.socials };

    return finalResult;

  } catch (err) {
    emitLog(`   ❌ Erreur IA : ${err.message}. Fallback partiel.`);
    // Fallback minimal sans IA
    return {
      ...result,
      emails: [...new Set(rawText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])],
      error: `AI Error: ${err.message}`,
      scrapedAt: new Date().toISOString(),
      platform: 'Site Officiel (Logic v5 Only)'
    };
  }
}

module.exports = { scrapeOfficialSite, isOfficialSite };
