/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║   PROSPECTA — Scraper PagesJaunes.fr  (Playwright v3.0 FULL EXTRACT)   ║
 * ║   Entreprises · Contacts · Avis · Horaires · Réseaux · Catégories      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { scrapeOfficialSite } = require('./site_scraper_module.cjs');

// ─── UTILITAIRES ──────────────────────────────────────────────────────────────
function emitLog(msg, pct = undefined) {
  console.log(msg);
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}
function emitResult(data) {
  process.stdout.write(`RESULT:${JSON.stringify(data)}\n`);
}
const sleep = ms => new Promise(r => setTimeout(r, ms + Math.floor(Math.random() * 400)));

// ─── CONFIGURATION CLI (alignée sur les inputs du finder: q, l, limit, type) ───
const [, , argQuery, argLocation, argMax, argType, argFields] = process.argv;
const requestedFields = argFields ? argFields.split(',').map(s => s.trim()).filter(Boolean) : [];

// type: "entreprise" | "personne" | "tous" (finder) → mode: "entreprise" | "personne"
const modeFromType = (t) => (t === 'personne' ? 'personne' : 'entreprise');

const CONFIG = {
  mode: modeFromType((argType || 'tous').toLowerCase()),
  query: argQuery || 'hotel',
  location: argLocation || 'Paris',
  maxResults: parseInt(argMax || '10', 10),
  headless: true,
  delay: 2000,
};

const BASE = 'https://www.pagesjaunes.fr';

// ─── FORMAT PROSPECT ─────────────────────────────────────────────────────────
function formatToProspect(d) {
  return {
    id: `pj_${Math.random().toString(36).substr(2, 9)}`,

    // ── Identité
    name: d.name || 'N/A',
    denomination: d.name || null,
    company: d.name || null,
    role: d.role || null,
    description: d.description || null,
    slogan: d.slogan || null,

    // ── Contact principal
    email: d.email || null,
    phone: d.phone || null,
    phoneSecondaire: d.phoneSecondaire || null,
    fax: d.fax || null,
    website: d.website || null,
    pjUrl: d.sourceUrl || null,

    // ── Adresse complète
    location: d.city || d.address || null,
    adresse: d.address || null,
    complement: d.complement || null,
    codePostal: d.postalCode || null,
    ville: d.city || null,
    departement: d.departement || null,
    region: d.region || null,
    pays: d.pays || 'France',
    coordonnees: d.coordonnees || null,   // { lat, lng }

    // ── Activité
    category: d.category || null,
    sousCategories: d.sousCategories || [],
    specialites: d.specialites || [],
    marques: d.marques || [],
    keywords: d.keywords || [],
    siret: d.siret || null,
    nafCode: d.nafCode || null,

    // ── Évaluation & réputation
    rating: d.rating || null,
    reviewCount: d.reviewCount || null,
    avis: d.avis || [],                   // tableau des derniers avis

    // ── Horaires
    horaires: d.horaires || null,
    horairesDetailles: d.horairesDetailles || [],

    // ── Réseaux sociaux
    socialLinks: {
      facebook: d.socials?.facebook || null,
      instagram: d.socials?.instagram || null,
      twitter: d.socials?.twitter || null,
      linkedin: d.socials?.linkedin || null,
      youtube: d.socials?.youtube || null,
      tiktok: d.socials?.tiktok || null,
      pinterest: d.socials?.pinterest || null,
    },

    // ── Photos / médias
    photos: d.photos || [],

    // ── Certifications & labels
    labels: d.labels || [],
    certifications: d.certifications || [],
    verified: d.verified || false,

    // ── Liens associés (autres établissements, chaîne...)
    liensAssocies: d.liensAssocies || [],

    // ── Source
    source_platform: 'pages_jaunes',

    // ── Bloc AI Intelligence
    aiIntelligence: {
      activities: { posts: [], comments: [] },
      skills: d.specialites || [],
      experience: [],
      education: [],
      certifications: d.certifications || [],
      recommendations: (d.avis || []).slice(0, 5).map(a => ({
        text: a.texte,
        author: a.auteur,
        rating: a.note,
        date: a.date,
      })),
    },

    // ── Bloc contractDetails
    contractDetails: {
      activity: d.category,
      sousCategories: d.sousCategories,
      status: d.verified ? 'Certifié PJ' : 'Standard',
      address: d.address,
      postalCode: d.postalCode,
      city: d.city,
      siret: d.siret,
      rating: d.rating,
      reviewCount: d.reviewCount,
      horaires: d.horaires,
    },
  };
}

// ─── GESTION COOKIES ─────────────────────────────────────────────────────────
async function handleCookies(page) {
  try {
    const sel = '#didomi-notice-agree-button, button[id*="accept"], button[class*="agree"]';
    await page.waitForSelector(sel, { timeout: 4000 });
    await page.click(sel);
    await sleep(600);
  } catch { }
}

// ─── EXTRACTION COMPLÈTE D'UNE FICHE ─────────────────────────────────────────
async function scrapeDetail(context, url) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(1200);
    await handleCookies(page);

    const data = await page.evaluate(() => {
      const get = sel => document.querySelector(sel)?.textContent?.trim() || null;
      const getAll = sel => Array.from(document.querySelectorAll(sel)).map(e => e.textContent.trim()).filter(Boolean);
      const getHref = sel => document.querySelector(sel)?.getAttribute('href') || null;

      // ── Nom principal
      const name =
        get('h1[class*="denom"], h1[itemprop="name"], h1') ||
        get('[class*="denomination"]');

      // ── Description / présentation
      const description =
        get('[class*="description"], [class*="presentation"], [itemprop="description"]');
      const slogan = get('[class*="slogan"], [class*="tagline"]');

      // ── Téléphone(s)
      const phoneEls = Array.from(document.querySelectorAll(
        '[itemprop="telephone"], [class*="numero"], [class*="phone"], a[href^="tel:"]'
      ));
      const phones = [...new Set(phoneEls.map(el =>
        (el.getAttribute('href') || el.textContent).replace('tel:', '').trim()
      ))].filter(p => p.match(/[\d\s.+()-]{7,}/));
      const phone = phones[0] || null;
      const phoneSecondaire = phones[1] || null;

      // ── Fax
      const faxEl = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent.toLowerCase().includes('fax') &&
        el.querySelector('a[href^="tel:"]')
      );
      const fax = faxEl?.querySelector('a[href^="tel:"]')
        ?.getAttribute('href')?.replace('tel:', '') || null;

      // ── Email
      const emailHref = getHref('a[href^="mailto:"]');
      const email = emailHref ? emailHref.replace('mailto:', '') : null;

      // ── Site web
      const websiteEl = document.querySelector(
        'a[data-pj-action="website"], a[class*="website"], a[rel="nofollow noopener"][target="_blank"]:not([href*="pagesjaunes"])'
      );
      const website = websiteEl?.href || null;

      // ── Adresse complète
      const adresseEl = document.querySelector(
        'address, [itemprop="address"], [class*="address-container"], [class*="adresse"]'
      );
      const adresseText = adresseEl?.textContent?.replace(/\s+/g, ' ').trim() || null;

      // Décomposition adresse
      const streetEl = get('[itemprop="streetAddress"], [class*="street"]');
      const postalEl = get('[itemprop="postalCode"], [class*="postal"]');
      const cityEl = get('[itemprop="addressLocality"], [class*="city"], [class*="ville"]');
      const regionEl = get('[itemprop="addressRegion"], [class*="region"]');

      const cpMatch = adresseText?.match(/\b(\d{5})\b/);
      const postalCode = postalEl || cpMatch?.[1] || null;
      const city = cityEl || adresseText?.replace(/.*\d{5}\s*/, '').split('\n')[0].trim() || null;

      // ── Coordonnées GPS
      let coordonnees = null;
      const mapEl = document.querySelector('[data-lat], [data-lng], [data-latitude], [data-longitude]');
      if (mapEl) {
        coordonnees = {
          lat: mapEl.dataset.lat || mapEl.dataset.latitude,
          lng: mapEl.dataset.lng || mapEl.dataset.longitude,
        };
      }
      // Fallback JSON-LD geo
      if (!coordonnees) {
        try {
          const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
          ldScripts.forEach(s => {
            const d = JSON.parse(s.textContent);
            if (d?.geo) coordonnees = { lat: d.geo.latitude, lng: d.geo.longitude };
          });
        } catch { }
      }

      // ── Catégorie principale & sous-catégories
      const category = get(
        '[class*="activite"], [class*="category"], [itemprop="description"] span, [class*="rubrique"]'
      );
      const sousCategories = getAll('[class*="sous-rubrique"], [class*="sub-category"], [class*="specialite-tag"]');

      // ── Spécialités / services
      const specialites = getAll(
        '[class*="specialite"]:not([class*="tag"]), [class*="service-item"], [class*="prestation"]'
      );

      // ── Marques représentées
      const marques = getAll('[class*="marque"], [class*="brand"]');

      // ── SIRET / NAF
      const bodyText = document.body.innerText;
      const siretMatch = bodyText.match(/\bSIRET\s*[:\s]*([\d\s]{14,17})/i);
      const siret = siretMatch ? siretMatch[1].replace(/\s/g, '') : null;
      const nafMatch = bodyText.match(/\bNAF\s*[:\s]*([0-9]{4}[A-Z])/i);
      const nafCode = nafMatch ? nafMatch[1] : null;

      // ── Note & avis
      const ratingEl = document.querySelector(
        '[itemprop="ratingValue"], [class*="rating-value"], [class*="note-moyenne"]'
      );
      const rating = ratingEl ? parseFloat(ratingEl.textContent.replace(',', '.')) : null;
      const reviewCountEl = document.querySelector(
        '[itemprop="reviewCount"], [class*="avis-count"], [class*="nb-avis"]'
      );
      const reviewCount = reviewCountEl ? parseInt(reviewCountEl.textContent.replace(/\D/g, '')) : null;

      // Textes des avis
      const avis = [];
      document.querySelectorAll('[class*="avis-item"], [class*="review-item"], [itemprop="review"]').forEach(el => {
        const auteur = el.querySelector('[class*="auteur"], [itemprop="author"]')?.textContent?.trim() || 'Anonyme';
        const note = el.querySelector('[class*="note"], [itemprop="ratingValue"]')?.textContent?.trim() || null;
        const texte = el.querySelector('[class*="texte"], [itemprop="reviewBody"], p')?.textContent?.trim() || null;
        const date = el.querySelector('[class*="date"], time')?.textContent?.trim() || null;
        if (texte) avis.push({ auteur, note, texte, date });
      });

      // ── Horaires
      const horaires = get('[class*="horaire"], [class*="opening-hours"], [itemprop="openingHours"]');
      const horairesDetailles = [];
      document.querySelectorAll('[class*="horaire-item"], [class*="day-row"]').forEach(el => {
        const jour = el.querySelector('[class*="jour"], [class*="day"]')?.textContent?.trim() || '';
        const heure = el.querySelector('[class*="heure"], [class*="hour"]')?.textContent?.trim() || '';
        if (jour) horairesDetailles.push({ jour, heure });
      });
      // Fallback schema.org
      if (horairesDetailles.length === 0) {
        document.querySelectorAll('[itemprop="openingHoursSpecification"]').forEach(el => {
          const jour = el.querySelector('[itemprop="dayOfWeek"]')?.textContent?.trim() || '';
          const open = el.querySelector('[itemprop="opens"]')?.getAttribute('content') || '';
          const close = el.querySelector('[itemprop="closes"]')?.getAttribute('content') || '';
          if (jour) horairesDetailles.push({ jour, heure: `${open} - ${close}` });
        });
      }

      // ── Réseaux sociaux
      const socials = {};
      const socialMap = {
        facebook: ['facebook.com'],
        instagram: ['instagram.com'],
        twitter: ['twitter.com', 'x.com'],
        linkedin: ['linkedin.com'],
        youtube: ['youtube.com'],
        tiktok: ['tiktok.com'],
        pinterest: ['pinterest.com'],
      };
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        Object.entries(socialMap).forEach(([key, domains]) => {
          if (domains.some(d => href.includes(d)) && !socials[key]) {
            socials[key] = href;
          }
        });
      });

      // ── Photos
      const photos = [];
      document.querySelectorAll(
        'img[class*="photo"], img[class*="gallery"], [class*="media"] img'
      ).forEach(img => {
        const src = img.src || img.dataset.src;
        if (src && !src.includes('placeholder') && !src.includes('logo') && photos.length < 10) {
          photos.push(src);
        }
      });

      // ── Labels / certifications PJ
      const labels = getAll('[class*="label"], [class*="badge"], [class*="certification"]');

      // ── Vérification (badge certifié)
      const verified = !!document.querySelector(
        '[class*="certified"], [class*="verifie"], [class*="pro-certifie"]'
      );

      // ── Liens associés (chaîne, groupe, établissements liés)
      const liensAssocies = [];
      document.querySelectorAll('a[href*="/pros/"][class*="assoc"], a[href*="/pros/"][class*="related"]').forEach(a => {
        liensAssocies.push({ nom: a.textContent.trim(), url: a.href });
      });

      // ── Mots-clés meta
      const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
      const keywords = metaKeywords.split(',').map(k => k.trim()).filter(Boolean);

      // ── Département / région depuis breadcrumb ou URL
      const breadcrumbs = getAll('[class*="breadcrumb"] a, nav[aria-label*="fil"] a');
      const departement = breadcrumbs.find(b => /\d{2}/.test(b)) || null;

      return {
        name, description, slogan,
        phone, phoneSecondaire, fax, email, website,
        address: adresseText || streetEl, complement: null,
        postalCode, city, departement, region: regionEl, pays: 'France',
        coordonnees,
        category, sousCategories, specialites, marques, keywords,
        siret, nafCode,
        rating, reviewCount, avis,
        horaires, horairesDetailles,
        socials, photos,
        labels, verified, liensAssocies,
        sourceUrl: window.location.href,
      };
    });

    return data;
  } catch (e) {
    emitLog(`  ⚠️  Erreur détail ${url}: ${e.message}`);
    return null;
  } finally {
    await page.close();
  }
}

// ─── SCRAPING PAGE DE RÉSULTATS ───────────────────────────────────────────────
async function scrapeResultsPage(page) {
  return page.evaluate(() => {
    const items = [];
    const seen = new Set();
    const selCard = [
      'article.bi-pjcard',
      'div[class*="bi-pjcard"]',
      'article[class*="result"]',
      'li[class*="result"]',
      '[class*="search-result-item"]',
    ].join(', ');

    document.querySelectorAll(selCard).forEach(el => {
      const nameEl = el.querySelector('h3, h2, [class*="denomination"], [itemprop="name"]');
      const linkEl = el.querySelector(
        'a[href*="/pros/"], a[href*="/pagesblanches/"], a[href*="/annuaire/"]'
      );
      if (!nameEl || !linkEl) return;
      const url = linkEl.href;
      if (seen.has(url)) return;
      seen.add(url);

      // Données rapides depuis la card
      const phone = el.querySelector('[itemprop="telephone"], a[href^="tel:"]')
        ?.textContent?.trim() || null;
      const address = el.querySelector('address, [itemprop="address"], [class*="address"]')
        ?.textContent?.replace(/\s+/g, ' ').trim() || null;
      const category = el.querySelector('[class*="activite"], [class*="category"]')
        ?.textContent?.trim() || null;
      const ratingEl = el.querySelector('[class*="rating"], [class*="note"]');
      const rating = ratingEl ? parseFloat(ratingEl.textContent.replace(',', '.')) : null;

      items.push({ name: nameEl.textContent.trim(), url, phone, address, category, rating });
    });
    return items;
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  emitLog(`🚀 PagesJaunes Scraper v3.0 — Extraction Maximale\n  auditionné par Prospecta\n`, 5);
  emitLog(`📖 Cible : "${CONFIG.query}"\n📍 Localisation : "${CONFIG.location}"\n🔢 Limite : ${CONFIG.maxResults}\n`, 7);
  emitLog('🛰️ Initialisation du navigateur...', 10);

  const browser = await chromium.launch({ headless: CONFIG.headless });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  });

  try {
    const page = await context.newPage();

    // URL selon le mode
    const searchUrl = CONFIG.mode === 'personne'
      ? `${BASE}/pagesblanches/recherche?quoiqui=${encodeURIComponent(CONFIG.query)}&ou=${encodeURIComponent(CONFIG.location)}`
      : `${BASE}/annuaire/chercherlespros?quoiqui=${encodeURIComponent(CONFIG.query)}&ou=${encodeURIComponent(CONFIG.location)}`;

    emitLog(`\n── RECHERCHE ANNUAIRE ─────────────────────────────────\n`, 15);
    emitLog(`🔍 Indexation sur ${BASE}...`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    await handleCookies(page);

    // Collecte des cards (avec pagination si besoin)
    let allCards = [];
    let pageNum = 1;

    while (allCards.length < CONFIG.maxResults) {
      const cards = await scrapeResultsPage(page);
      emitLog(`  📄 Page ${pageNum} — ${cards.length} fiches trouvées`);
      allCards = [...allCards, ...cards];

      if (allCards.length >= CONFIG.maxResults) break;

      // Pagination
      try {
        const nextBtn = page.locator(
          'a[rel="next"], [class*="next-page"], [aria-label="Page suivante"]'
        ).first();
        if (await nextBtn.isVisible({ timeout: 2000 })) {
          await nextBtn.click();
          await sleep(2500);
          pageNum++;
        } else break;
      } catch { break; }
    }

    const toProcess = allCards.slice(0, CONFIG.maxResults);
    emitLog(`✨ ${toProcess.length} fiches à traiter.`, 25);
    emitLog(`\n── EXTRACTION DÉTAILLÉE ────────────────────────────────\n`);

    for (let i = 0; i < toProcess.length; i++) {
      const card = toProcess[i];
      const pct = 25 + Math.round(((i + 1) / toProcess.length) * 70);
      emitLog(`   📖 [${i + 1}/${toProcess.length}] ${card.name}`, pct);

      // Mega-optimisation: on évite d'ouvrir la fiche détaillée si les champs requis
      // sont déjà tous fournis par la carte de recherche globale (nom, téléphone, adresse, catégorie, note).
      const needsDetail = requestedFields.length === 0 || requestedFields.some(f => 
        ['email', 'website', 'description', 'about', 'horaires', 'photos', 'certifications', 'socials'].includes(f)
      );

      let detail = null;
      if (needsDetail) {
        detail = await scrapeDetail(context, card.url);
      } else {
        emitLog(`      ⏩ Profil détaillé ignoré (champs exhaustifs non cochés). Gain de temps direct.`);
      }

      let prospect = null;
      if (detail) {
        // Fusion données card + détail (détail prioritaire)
        const merged = {
          name: detail.name || card.name,
          phone: detail.phone || card.phone,
          address: detail.address || card.address,
          category: detail.category || card.category,
          rating: detail.rating ?? card.rating,
          ...detail,
        };
        prospect = formatToProspect(merged);
      } else {
        // Fallback : on envoie les données de la card sans détail
        prospect = formatToProspect(card);
      }

      // Filtrer les data
      if (requestedFields.length > 0) {
        const allowedKeys = new Set(['id', 'source', 'source_platform', 'platform', 'mapsUrl', 'pjUrl']);
        if (requestedFields.includes('name')) allowedKeys.add('name');
        if (requestedFields.includes('address') || requestedFields.includes('location')) { allowedKeys.add('location'); allowedKeys.add('adresse'); allowedKeys.add('ville'); allowedKeys.add('codePostal'); allowedKeys.add('pays'); }
        if (requestedFields.includes('phone') || requestedFields.includes('email')) { allowedKeys.add('phone'); allowedKeys.add('email'); }
        if (requestedFields.includes('website')) allowedKeys.add('website');
        if (requestedFields.includes('rating') || requestedFields.includes('review_count')) { allowedKeys.add('rating'); allowedKeys.add('reviewCount'); }
        if (requestedFields.includes('category')) { allowedKeys.add('category'); allowedKeys.add('sousCategories'); }
        if (requestedFields.includes('description') || requestedFields.includes('about')) { allowedKeys.add('description'); allowedKeys.add('slogan'); }
        if (requestedFields.includes('horaires')) { allowedKeys.add('horaires'); allowedKeys.add('horairesDetailles'); }
        
        allowedKeys.add('contractDetails');
        allowedKeys.add('aiIntelligence');

        for (const key of Object.keys(prospect)) {
            if (!allowedKeys.has(key)) delete prospect[key];
        }
      }

      emitLog(`      ✅ ${prospect.name} — ${prospect.phone || 'no phone'}`);
      emitResult(prospect);

      // ── Enrichissement site officiel ──────────────────────────────────────
      const websiteUrl = prospect.website || detail?.website;
      if (websiteUrl) {
        try {
          emitLog(`      🌐 Enrichissement site : ${websiteUrl}`);
          const enrichPage = await context.newPage();
          try {
            const siteData = await scrapeOfficialSite(enrichPage, { url: websiteUrl, name: prospect.name }, { visitContactPage: true, emitLog });
            prospect.siteEnrichment = siteData;
            if (siteData.contacts?.emails?.length) prospect.email = prospect.email || siteData.contacts.emails[0];
            if (siteData.contacts?.phones?.length) prospect.phone = prospect.phone || siteData.contacts.phones[0];
            if (siteData.socials) prospect.socialLinks = { ...prospect.socialLinks, ...Object.fromEntries(Object.entries(siteData.socials).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) };
            if (siteData.team?.length) prospect.team = siteData.team;
            if (siteData.technologies) prospect.technologies = siteData.technologies;
          } finally {
            await enrichPage.close();
          }
        } catch (siteErr) {
          emitLog(`      ⚠️  Site enrichment failed : ${siteErr.message}`);
        }
      }

      await sleep(CONFIG.delay);
    }

    emitLog(`\n── SYNTHÈSE ───────────────────────────────────────────\n`);
    emitLog('✅ Extraction PagesJaunes v3.0 terminée avec succès.', 100);

  } catch (err) {
    emitLog(`❌ Erreur fatale : ${err.message}`, 100);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});