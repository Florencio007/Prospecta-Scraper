const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const fs = require('fs');
const path = require('path');

// ── CONFIGURATION & ARGUMENTS ───────────────────────────────────────────────
const argQuery = process.argv[2] || '';
const argLocation = process.argv[3] || '';
const argMaxResults = parseInt(process.argv[4], 10) || 10;
const argType = process.argv[5] || 'tous';
const argFields = process.argv[6] || ''; // Champs demandés (séparés par virgules)

const requestedFields = argFields ? argFields.split(',').map(f => f.trim()) : [];

const CONFIG = {
  searchQuery: `${argQuery} ${argLocation}`.trim(),
  maxResults: argMaxResults,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  blacklist: [
    'booking.com', 'tripadvisor.com', 'tripadvisor.ca', 'tripadvisor.fr', 
    'expedia.com', 'expedia.fr', 'hotels.com', 'trivago.com', 'trivago.fr',
    'agoda.com', 'kayak.com', 'kayak.fr', 'hotelscombined.com', 'trip.com',
    'yelp.com', 'pagesjaunes.fr', 'societe.com', 'pappers.fr', 'infogreffe.fr',
    'facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'twitter.com',
    'pinterest.com', 'tiktok.com'
  ]
};

// ── UTILS ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function emitLog(message, percentage) {
  const log = { message };
  if (percentage !== undefined) log.percentage = percentage;
  console.log(`PROGRESS:${JSON.stringify(log)}`);
}

function emitResult(data) {
  // Filtrage des champs
  if (requestedFields.length > 0) {
    const filtered = {};
    const essential = ['id', 'name', 'source', 'score', 'initials', 'prospect_type'];
    essential.forEach(k => { if (data[k] !== undefined) filtered[k] = data[k]; });
    
    // Mapping des champs demandés vers le JSON interne
    const fieldMap = {
      'Nom / Raison sociale': 'name',
      'Téléphone': 'phone',
      'Site web': 'website',
      'Adresse': 'address',
      'Note / Avis': 'rating',
      'Bio': 'description',
      'Email': 'email',
      'LinkedIn': 'linkedin',
      'Facebook': 'facebook',
      'Instagram': 'instagram'
    };

    requestedFields.forEach(f => {
      const key = fieldMap[f];
      if (key && data[key] !== undefined) filtered[key] = data[key];
    });
    console.log(`RESULT:${JSON.stringify(filtered)}`);
  } else {
    console.log(`RESULT:${JSON.stringify(data)}`);
  }
}

// ── EXTRACTION DE CONTACTS SUR UN SITE WEB ──────────────────────────────────
async function scrapeWebsite(page, url) {
  try {
    emitLog(`   🌐 Analyse de ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);

    const data = await page.evaluate(() => {
      const html = document.body.innerText;
      const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      // Regex téléphone plus large (FR + International)
      const phones = html.match(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}|(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g) || [];
      
      const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
      const social = {
        linkedin: links.find(l => l.includes('linkedin.com/company') || l.includes('linkedin.com/in')),
        facebook: links.find(l => l.includes('facebook.com/')),
        instagram: links.find(l => l.includes('instagram.com/')),
      };

      return {
        email: [...new Set(emails)][0] || "",
        phone: [...new Set(phones)][0] || "",
        social,
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || ""
      };
    });

    return data;
  } catch (err) {
    return null;
  }
}

// ── MOTEUR PRINCIPAL ────────────────────────────────────────────────────────
(async () => {
  if (!CONFIG.searchQuery) {
    console.log('ERROR:Requête vide');
    process.exit(1);
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({ 
    userAgent: CONFIG.userAgent,
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  });
  const page = await context.newPage();

  try {
    emitLog(`🔎 Recherche Google : "${CONFIG.searchQuery}"`, 10);
    
    // 1. Recherche Google
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(CONFIG.searchQuery)}&num=${CONFIG.maxResults + 5}`, { waitUntil: 'networkidle', timeout: 60000 });
    
    // Gérer l'éventuel bouton de cookies
    try {
      const cookieBtn = page.locator('button:has-text("Tout accepter"), button:has-text("I agree"), button:has-text("Accepter tout"), button:has-text("Accept all")').first();
      if (await cookieBtn.isVisible({ timeout: 5000 })) {
        await cookieBtn.click();
        await sleep(1500);
      }
    } catch(e) {}

    // 2. Extraire les liens
    const searchResults = await page.evaluate(() => {
      const items = [];
      const containers = document.querySelectorAll('#search .g, [data-hveid] .tF2Cxc, .MjjYud, .g');
      
      containers.forEach(el => {
        const titleEl = el.querySelector('h3');
        const linkEl = el.querySelector('a');
        const snippetEl = el.querySelector('.VwiC3b, .st, .yDsk6d');
        
        if (titleEl && linkEl && linkEl.href && linkEl.href.startsWith('http')) {
          const url = linkEl.href.toLowerCase();
          
          // Filtrer Google et les domaines en blacklist
          const isGoogle = url.includes('google.com');
          const isBlacklisted = CONFIG.blacklist.some(domain => url.includes(domain));
          
          if (!isGoogle && !isBlacklisted) {
            if (!items.find(it => it.website === linkEl.href)) {
              items.push({
                name: titleEl.innerText,
                website: linkEl.href,
                description: snippetEl ? snippetEl.innerText : ""
              });
            }
          }
        }
      });
      return items;
    });

    if (searchResults.length === 0) {
      const bodyPreview = await page.evaluate(() => document.body.innerText.substring(0, 1000));
      if (bodyPreview.includes("détecté un trafic exceptionnel") || bodyPreview.includes("captcha") || bodyPreview.includes("robot")) {
        emitLog(`   🚫 GOOGLE BLOQUÉ. Basculement sur le moteur secondaire (DuckDuckGo)...`);
        
        // --- FALLBACK DUCKDUCKGO ---
        emitLog(`   🔎 Tentative DuckDuckGo pour : ${CONFIG.searchQuery}`);
        await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(CONFIG.searchQuery)}`, { waitUntil: 'networkidle' });
        await sleep(3000);
        
        const ddgResults = await page.evaluate((blacklist) => {
          const items = [];
          // Sélecteurs pour DuckDuckGo (version moderne JS)
          const results = document.querySelectorAll('article, [data-testid="result"]');
          results.forEach(el => {
            const titleEl = el.querySelector('h2 a');
            const snippetEl = el.querySelector('[data-testid="result-snippet"], .result__snippet');
            
            if (titleEl && titleEl.href) {
              const url = titleEl.href.toLowerCase();
              const isDDG = url.includes('duckduckgo.com');
              const isBlacklisted = blacklist.some(domain => url.includes(domain));
              
              if (!isDDG && !isBlacklisted) {
                items.push({
                  name: titleEl.innerText,
                  website: titleEl.href,
                  description: snippetEl ? snippetEl.innerText : ""
                });
              }
            }
          });
          return items;
        }, CONFIG.blacklist);
        
        emitLog(`   ✅ DuckDuckGo a trouvé ${ddgResults.length} résultats potentiels.`);
        searchResults.push(...ddgResults);
      } else {
        const bodyPreview = await page.evaluate(() => document.body.innerText.substring(0, 500));
        emitLog(`   ⚠️ Aucun résultat trouvé. Aperçu : ${bodyPreview.replace(/\n/g, ' ')}`);
      }
    }

    const toProcess = searchResults.slice(0, CONFIG.maxResults);
    emitLog(`✅ ${toProcess.length} sites web identifiés (sur ${searchResults.length} trouvés).`, 30);

    // 3. Crawler chaque site
    let count = 0;
    for (const item of toProcess) {
      count++;
      const progress = 30 + Math.round((count / toProcess.length) * 60);
      
      const siteData = await scrapeWebsite(page, item.website);
      
      const result = {
        id: `google_${Math.random().toString(36).substr(2, 9)}`,
        name: item.name,
        website: item.website,
        description: siteData?.description || item.description,
        email: siteData?.email || "",
        phone: siteData?.phone || "",
        linkedin: siteData?.social?.linkedin || "",
        facebook: siteData?.social?.facebook || "",
        instagram: siteData?.social?.instagram || "",
        source: 'google',
        score: 40,
        initials: (item.name[0] || "G").toUpperCase(),
        prospect_type: 'company'
      };

      if (result.email) result.score += 30;
      if (result.phone) result.score += 15;
      if (result.linkedin) result.score += 10;

      emitResult(result);
      emitLog(`   ✅ Extrait : ${item.name}`, progress);
    }

    emitLog("🚀 Recherche Google Web terminée", 100);

  } catch (err) {
    console.log(`ERROR:${err.message}`);
  } finally {
    await browser.close();
  }
})();
