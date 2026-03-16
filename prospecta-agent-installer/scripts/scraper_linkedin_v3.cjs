/**
 * scraper_linkedin.cjs — v3
 *
 * NOUVEAUTÉS vs v2 :
 *  ✅ Filtres avancés : mots-clés + type (personne/entreprise/tous) + ville + pays
 *  ✅ Visite de chaque profil pour extraire les données complètes
 *  ✅ Extraction email, téléphone, site web depuis la modale "Coordonnées"
 *  ✅ Scraping entreprise complet (page About, spécialités, effectif, fondation)
 *  ✅ Pour les personnes : poste actuel, entreprise, localisation, photo, résumé
 *  ✅ Pour les entreprises : recherche du responsable principal via "Employés"
 *  ✅ Session persistante + ralentissement adaptatif conservés de v2
 *  ✅ Émission SSE en temps réel (un RESULT par profil visité)
 */

'use strict';

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

// ─── Arguments CLI ────────────────────────────────────────────────────────────
// node scraper_linkedin.cjs <email> <password> <keywords> <max> <searchType> <city> <country>
const [,, argEmail, argPass, argKeywords, argMax, argSearchType, argCity, argCountry] = process.argv;

const CONFIG = {
  email:       argEmail     || '',
  password:    argPass      || '',
  keywords:    argKeywords  || 'hotel nosy be',
  searchType:  ['companies','company','people','person','all'].includes(argSearchType)
               ? argSearchType : 'all',
  city:        argCity      || '',
  country:     argCountry   || '',
  maxProfiles: parseInt(argMax, 10) || 10,
  headless:    true,

  // Délais (ms)
  delayMin:      2000,
  delayMax:      5000,
  delayProfile:  3000,   // attente après ouverture d'un profil
  delayOnWarn:   30000,  // pause si rate limit LinkedIn
  delayBetween:  4000,   // pause entre deux profils visités

  cookiesDir: path.resolve(__dirname, '../.linkedin_sessions'),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emitLog    = (msg, pct) => process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
const emitResult = (p)        => process.stdout.write(`RESULT:${JSON.stringify(p)}\n`);
const sleep      = (ms)       => new Promise(r => setTimeout(r, ms));
const randDelay  = (a = CONFIG.delayMin, b = CONFIG.delayMax) =>
  sleep(Math.floor(Math.random() * (b - a + 1)) + a);

function cookiesPath(email) {
  if (!fs.existsSync(CONFIG.cookiesDir)) fs.mkdirSync(CONFIG.cookiesDir, { recursive: true });
  return path.join(CONFIG.cookiesDir, `${email.replace(/[^a-z0-9]/gi, '_')}.json`);
}

// ─── Session persistante ──────────────────────────────────────────────────────

async function loadSession(context, email) {
  const p = cookiesPath(email);
  if (!fs.existsSync(p)) return false;
  try {
    await context.addCookies(JSON.parse(fs.readFileSync(p, 'utf8')));
    emitLog('🍪 Session existante chargée', 3);
    return true;
  } catch { return false; }
}

async function saveSession(context, email) {
  try {
    fs.writeFileSync(cookiesPath(email), JSON.stringify(await context.cookies(), null, 2));
    emitLog('💾 Session sauvegardée', undefined);
  } catch { /* ignore */ }
}

async function isSessionValid(page) {
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    const url = page.url();
    return !url.includes('/login') && !url.includes('/uas/') && !url.includes('checkpoint');
  } catch { return false; }
}

// ─── Détection alertes LinkedIn ───────────────────────────────────────────────

async function detectAlert(page) {
  const url = page.url();
  if (url.includes('checkpoint') || url.includes('challenge')) return 'checkpoint';
  try {
    if (await page.evaluate(() =>
      !!(document.querySelector('iframe[src*="recaptcha"]') || document.querySelector('[data-test-id="challenge"]'))
    )) return 'captcha';
    if (await page.evaluate(() => {
      const b = document.body?.innerText?.toLowerCase() || '';
      return b.includes('too many requests') || b.includes('unusual activity') || b.includes('activité inhabituelle');
    })) return 'rate_limit';
    if (await page.evaluate(() => (document.body?.innerText?.trim().length || 0) < 100)) return 'empty_page';
  } catch { /* ignore */ }
  return null;
}

async function handleAlert(signal) {
  if (signal === 'checkpoint' || signal === 'captcha') {
    emitLog(`ERROR: LinkedIn bloque le compte (${signal}). Arrêt pour protéger le compte.`, undefined);
    return false;
  }
  if (signal === 'rate_limit') {
    emitLog(`⚠️  Rate limit — pause ${CONFIG.delayOnWarn / 1000}s...`, undefined);
    await sleep(CONFIG.delayOnWarn);
  }
  if (signal === 'empty_page') await sleep(5000);
  return true;
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function login(page, context) {
  emitLog('🔐 Connexion à LinkedIn...', 5);
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await randDelay(800, 1500);
  await page.waitForSelector('#username', { timeout: 10000 });

  await page.click('#username');
  await page.type('#username', CONFIG.email, { delay: Math.random() * 80 + 40 });
  await randDelay(300, 700);
  await page.click('#password');
  await page.type('#password', CONFIG.password, { delay: Math.random() * 80 + 40 });
  await randDelay(400, 900);

  // Mouvement souris naturel
  const btn = await page.$('[type="submit"]');
  if (btn) {
    const box = await btn.boundingBox();
    if (box) {
      await page.mouse.move(
        box.x + box.width * (0.3 + Math.random() * 0.4),
        box.y + box.height * (0.3 + Math.random() * 0.4),
        { steps: 12 }
      );
      await randDelay(100, 300);
    }
    await btn.click();
  }

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const url = page.url();
    const err = await page.evaluate(() =>
      document.querySelector('#error-for-password,#error-for-username,.alert-error')?.innerText?.trim() || null
    ).catch(() => null);
    if (err) { emitLog(`ERROR: ${err}`, undefined); process.exit(1); }
    if (url.includes('checkpoint') || url.includes('challenge')) {
      emitLog('ERROR: Vérification de sécurité requise au login.', undefined); process.exit(1);
    }
    if (!url.includes('/login') && !url.includes('/uas/')) break;
  }

  await saveSession(context, CONFIG.email);
  emitLog('✅ Connecté avec succès', 10);
}

// ─── Scroll humain ────────────────────────────────────────────────────────────

async function humanScroll(page, steps = 5) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 400) + 300));
    await randDelay(500, 1200);
  }
  // Parfois remonter un peu pour simuler la lecture
  if (Math.random() > 0.6) {
    await page.evaluate(() => window.scrollBy(0, -(Math.floor(Math.random() * 200) + 100)));
    await randDelay(300, 700);
  }
}

// ─── Construction de l'URL de recherche LinkedIn ──────────────────────────────

/**
 * Construit l'URL de recherche LinkedIn avec les filtres disponibles.
 * LinkedIn accepte geoUrn pour la localisation — on utilise les keywords
 * pour inclure la ville/pays si pas de geoUrn connu.
 */
function buildSearchUrl(type, page = 1) {
  const endpoint = (type === 'companies' || type === 'company') ? 'companies' : 'people';

  // Construire la query enrichie avec ville et pays si fournis
  let query = CONFIG.keywords;
  if (CONFIG.city    && !query.toLowerCase().includes(CONFIG.city.toLowerCase()))    query += ` ${CONFIG.city}`;
  if (CONFIG.country && !query.toLowerCase().includes(CONFIG.country.toLowerCase())) query += ` ${CONFIG.country}`;

  const params = new URLSearchParams({ keywords: query, page: String(page) });

  return `https://www.linkedin.com/search/results/${endpoint}/?${params.toString()}`;
}

// ─── Extraction coordonnées (modale "Voir les coordonnées") ───────────────────

async function scrapeContactInfo(page) {
  let email = '', phone = '', website = '';
  try {
    const contactBtn = page.locator('a[href*="overlay/contact-info"]');
    if (!await contactBtn.isVisible({ timeout: 3000 }).catch(() => false)) return { email, phone, website };

    await contactBtn.click();
    await sleep(2000);

    const data = await page.evaluate(() => {
      const modal = document.querySelector('.artdeco-modal__content') || document.body;
      const result = { email: '', phone: '', website: '' };

      // Email — regex dans tout le HTML de la modale
      const emailMatch = modal.innerHTML.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) result.email = emailMatch[0];

      // Téléphone et site via les sections de la modale
      modal.querySelectorAll('section').forEach(sec => {
        const h = sec.querySelector('h3')?.textContent?.toLowerCase() || '';
        if (h.includes('phone') || h.includes('téléphone') || h.includes('mobile')) {
          result.phone = sec.querySelector('span.t-14, .t-black')?.textContent?.trim() || '';
        }
        if (h.includes('site') || h.includes('website') || h.includes('url')) {
          result.website = sec.querySelector('a')?.href || '';
        }
      });

      // Fallback téléphone — regex
      if (!result.phone) {
        const phoneMatch = modal.innerHTML.match(/(\+?\d[\d\s\-().]{7,15}\d)/);
        if (phoneMatch) result.phone = phoneMatch[1].trim();
      }

      return result;
    });

    email = data.email; phone = data.phone; website = data.website;

    // Fermer la modale
    const closeBtn = page.locator('button[aria-label="Ignorer"], button[aria-label="Dismiss"], .artdeco-modal__dismiss').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click(); await sleep(500);
    }
  } catch { /* ignore */ }
  return { email, phone, website };
}

// ─── Scraping profil PERSONNE ─────────────────────────────────────────────────

async function scrapePersonProfile(page, profileUrl) {
  emitLog(`   👤 Profil personne : ${profileUrl.substring(0, 60)}...`, undefined);

  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(CONFIG.delayProfile);
  await humanScroll(page, 8);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(600);

  // Ouvrir les sections "voir plus"
  try {
    await page.evaluate(() => {
      document.querySelectorAll('button.inline-show-more-text__button, button[aria-label*="voir plus"], button[aria-label*="show more"]')
        .forEach(b => b.click());
    });
    await sleep(500);
  } catch { /* ignore */ }

  // Coordonnées depuis la modale
  const contact = await scrapeContactInfo(page);

  // Données principales du profil
  const data = await page.evaluate(() => {
    // ── Photo ──
    let photo = '';
    const photoSelectors = [
      '.pv-top-card__photo-wrapper img',
      '.profile-photo-edit__preview',
      'img.pv-top-card-profile-picture__image--show',
      '.pv-top-card-profile-picture__image',
      '.ph5 img[src*="licdn"]',
      'section.artdeco-card img[src*="licdn"]',
    ];
    for (const sel of photoSelectors) {
      const img = document.querySelector(sel);
      if (img?.src?.includes('licdn')) { photo = img.src; break; }
    }
    if (!photo) {
      let best = null, bestSize = 0;
      document.querySelectorAll('img[src*="licdn"]').forEach(img => {
        if (img.src.includes('profile-display') || img.src.includes('shrink_200') || img.src.includes('shrink_400')) {
          const size = (img.naturalWidth || 0) * (img.naturalHeight || 0);
          if (size > bestSize) { best = img; bestSize = size; }
        }
      });
      if (best) photo = best.src;
    }

    // ── Nom, headline ──
    const name     = document.querySelector('h1.text-heading-xlarge, h1')?.textContent?.trim() || '';
    const headline = document.querySelector('.text-body-medium.break-words')?.textContent?.trim() || '';

    // ── Localisation ──
    let location = '';
    document.querySelectorAll('.pv-text-details__left-panel span, .mt2 span, .ph5 span').forEach(sp => {
      const t = sp.textContent?.trim() || '';
      if (!location && t.length > 5 && !t.match(/^[·•\d]/) && !t.includes('relation') && !t.includes('niveau')) location = t;
    });

    // ── Résumé ──
    let about = '';
    const aboutSection = document.querySelector('#about')?.closest('section');
    if (aboutSection) {
      const clone = aboutSection.cloneNode(true);
      clone.querySelectorAll('button').forEach(b => b.remove());
      about = clone.innerText?.trim().substring(0, 1500) || '';
    }

    // ── Expériences ──
    const experiences = [];
    const expSection = document.querySelector('#experience')?.closest('section');
    if (expSection) {
      expSection.querySelectorAll('ul > li.artdeco-list__item').forEach(item => {
        const boldSpans  = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]')).map(s => s.textContent.trim()).filter(Boolean);
        const normSpans  = Array.from(item.querySelectorAll('.t-14.t-normal:not(.t-black--light) span[aria-hidden="true"]')).map(s => s.textContent.trim()).filter(Boolean);
        const lightSpans = Array.from(item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]')).map(s => s.textContent.trim()).filter(Boolean);
        let role = '', company = '', duration = '', loc = '';
        if (boldSpans.length >= 2) {
          company = boldSpans[0]; role = boldSpans[1]; duration = lightSpans[0] || ''; loc = lightSpans[1] || '';
        } else {
          role = boldSpans[0] || ''; company = normSpans[0] || ''; duration = lightSpans[0] || ''; loc = lightSpans[1] || '';
        }
        if (role && role.length < 150) experiences.push({ role, company, duration, location: loc });
      });
    }

    // ── Poste actuel et entreprise actuels (depuis expérience sans date de fin) ──
    const currentExp = experiences.find(e => e.duration?.toLowerCase().includes('présent') || e.duration?.toLowerCase().includes('present'))
                    || experiences[0]
                    || {};

    return { name, headline, photo, location, about, experiences, currentPosition: currentExp.role || '', currentCompany: currentExp.company || '' };
  });

  return {
    ...data,
    email:   contact.email   || '',
    phone:   contact.phone   || '',
    website: contact.website || '',
    profileUrl,
    type: 'person',
  };
}

// ─── Scraping profil ENTREPRISE ───────────────────────────────────────────────

async function scrapeCompanyProfile(page, companyUrl) {
  emitLog(`   🏢 Profil entreprise : ${companyUrl.substring(0, 60)}...`, undefined);

  // ── Page principale ──
  await page.goto(companyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(CONFIG.delayProfile);
  await humanScroll(page, 6);

  const mainData = await page.evaluate(() => ({
    name:      document.querySelector('h1')?.textContent?.trim() || '',
    tagline:   document.querySelector('.org-top-card-summary__tagline, .org-top-card-primary-content__tagline')?.textContent?.trim() || '',
    industry:  document.querySelector('.org-top-card-summary__industry')?.textContent?.trim() || '',
    location:  document.querySelector('.org-top-card-summary__headquarter')?.textContent?.trim() || '',
    followers: document.querySelector('.org-top-card-summary__follower-count')?.textContent?.trim() || '',
    photo:     document.querySelector('.org-top-card-primary-content__logo img, .org-top-card__logo img')?.src || '',
    about:     document.querySelector('.org-about-us-organization-description__text, #about')?.textContent?.trim() || '',
  }));

  // ── Page About (données complètes) ──
  await randDelay(1500, 3000);
  const aboutUrl = companyUrl.endsWith('/') ? `${companyUrl}about/` : `${companyUrl}/about/`;
  await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);

  try {
    await page.evaluate(() =>
      document.querySelectorAll('button[aria-label*="voir plus"], .org-about-module__show-more-btn').forEach(b => b.click())
    );
    await sleep(500);
  } catch { /* ignore */ }

  const aboutData = await page.evaluate(() => {
    const result = { aboutFull: '', website: '', phone: '', email: '', companySize: '', foundedYear: '', headquarters: '', specialties: [] };

    const descEl = document.querySelector('.org-about-us-organization-description__text, .org-page-details-module__about-us-organization-description');
    if (descEl) result.aboutFull = descEl.textContent?.trim() || '';

    // Extraction via balises dl/dt/dd
    document.querySelectorAll('dl dt').forEach(dt => {
      const label = dt.textContent?.trim().toLowerCase() || '';
      const dd    = dt.nextElementSibling;
      if (!dd || dd.tagName !== 'DD') return;
      const val   = dd.textContent?.trim() || '';
      if (label.includes('site') || label.includes('website'))          { result.website     = dd.querySelector('a')?.href || val; }
      else if (label.includes('téléphone') || label.includes('phone'))  { result.phone       = val; }
      else if (label.includes('taille') || label.includes('size'))      { result.companySize = val; }
      else if (label.includes('siège') || label.includes('headquarter')){ result.headquarters = val; }
      else if (label.includes('fondée') || label.includes('founded'))   { result.foundedYear = val; }
      else if (label.includes('spécialité') || label.includes('specialt')) { result.specialties = val.split(',').map(s => s.trim()).filter(Boolean); }
    });

    // Fallback email dans le HTML de la page
    const emailMatch = document.body?.innerHTML?.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !emailMatch[0].includes('linkedin')) result.email = emailMatch[0];

    return result;
  });

  // ── Recherche du responsable principal via la page "Employés" ──
  let responsible = { name: '', title: '', profileUrl: '' };
  try {
    await randDelay(2000, 4000);
    const employeesUrl = companyUrl.endsWith('/') ? `${companyUrl}people/` : `${companyUrl}/people/`;
    await page.goto(employeesUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2500);
    await humanScroll(page, 4);

    responsible = await page.evaluate(() => {
      // Chercher CEO / Directeur / Fondateur en priorité
      const priorityTitles = ['ceo','directeur général','dg','pdg','founder','fondateur','président','managing director','gérant'];
      const cards = Array.from(document.querySelectorAll('[data-view-name="search-entity-result-universal-template"], .org-people-profile-card'));

      for (const card of cards) {
        const titleEl = card.querySelector('.t-14.t-normal, .org-people-profile-card__subtitle');
        const title   = titleEl?.textContent?.trim().toLowerCase() || '';
        if (priorityTitles.some(t => title.includes(t))) {
          const nameEl     = card.querySelector('.t-bold span[aria-hidden="true"], .org-people-profile-card__profile-title');
          const linkEl     = card.querySelector('a[href*="/in/"]');
          return {
            name:       nameEl?.textContent?.trim() || '',
            title:      titleEl?.textContent?.trim() || '',
            profileUrl: linkEl?.href?.split('?')[0] || '',
          };
        }
      }

      // Fallback : prendre le premier employé listé
      const first = cards[0];
      if (first) {
        const nameEl  = first.querySelector('.t-bold span[aria-hidden="true"], .org-people-profile-card__profile-title');
        const titleEl = first.querySelector('.t-14.t-normal, .org-people-profile-card__subtitle');
        const linkEl  = first.querySelector('a[href*="/in/"]');
        return {
          name:       nameEl?.textContent?.trim()  || '',
          title:      titleEl?.textContent?.trim() || '',
          profileUrl: linkEl?.href?.split('?')[0]  || '',
        };
      }
      return { name: '', title: '', profileUrl: '' };
    });

    if (responsible.name) emitLog(`   👤 Responsable trouvé : ${responsible.name} — ${responsible.title}`, undefined);
  } catch { /* ignore */ }

  return {
    name:        mainData.name,
    tagline:     mainData.tagline,
    photo:       mainData.photo,
    location:    aboutData.headquarters || mainData.location,
    followers:   mainData.followers,
    about:       aboutData.aboutFull    || mainData.about,
    website:     aboutData.website      || '',
    phone:       aboutData.phone        || '',
    email:       aboutData.email        || '',
    companySize: aboutData.companySize  || '',
    foundedYear: aboutData.foundedYear  || '',
    specialties: aboutData.specialties  || [],
    industry:    mainData.industry      || '',
    responsible,
    profileUrl:  companyUrl,
    type:        'company',
  };
}

// ─── Scraping de la liste de résultats ───────────────────────────────────────

async function scrapeSearchList(page, searchType) {
  const isCompany  = searchType === 'companies' || searchType === 'company';
  const allResults = [];
  let   currentPage = 1;
  const maxPages    = Math.ceil(CONFIG.maxProfiles / 10) + 2;
  let   retryCount  = 0;

  while (allResults.length < CONFIG.maxProfiles && currentPage <= maxPages) {
    const url = buildSearchUrl(searchType, currentPage);
    emitLog(`🔍 [${searchType}] Page ${currentPage} — ${allResults.length}/${CONFIG.maxProfiles}`, undefined);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randDelay(2000, 4000);

    const signal = await detectAlert(page);
    if (signal) {
      const ok = await handleAlert(signal);
      if (!ok) return allResults;
      if (retryCount++ < 3) continue;
      else break;
    }
    retryCount = 0;

    await humanScroll(page, 6);

    const results = await page.evaluate((isCompany) => {
      const linkSel = isCompany ? 'a[href*="/company/"]' : 'a[href*="/in/"]';
      let cards = document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]');
      if (!cards.length) cards = document.querySelectorAll('.reusable-search__result-container');
      if (!cards.length) cards = document.querySelectorAll('ul.reusable-search__entity-result-list > li');

      if (!cards.length) {
        return Array.from(document.querySelectorAll(linkSel)).map(a => ({
          name: a.querySelector('span[aria-hidden="true"]')?.textContent?.trim() || a.textContent?.trim()?.substring(0, 60) || '',
          title: '', location: '',
          profileUrl: a.href?.split('?')[0] || '',
          photo: '',
        })).filter(p => p.name && p.profileUrl && !p.profileUrl.includes('undefined'));
      }

      return Array.from(cards).map(card => {
        const linkEl = card.querySelector(linkSel);
        if (!linkEl) return null;
        const name   = linkEl.querySelector('span[aria-hidden="true"]')?.textContent?.trim() || linkEl.textContent?.trim()?.substring(0, 60) || '';
        const spans  = Array.from(card.querySelectorAll('span[aria-hidden="true"]'))
          .map(s => s.textContent?.trim()).filter(t => t && t.length > 2 && t !== name);
        return {
          name,
          title:      spans[0] || '',
          location:   spans[1] || '',
          profileUrl: linkEl.href?.split('?')[0] || '',
          photo:      card.querySelector('img')?.src || '',
        };
      }).filter(p => p && p.name && p.profileUrl && !p.profileUrl.includes('undefined'));
    }, isCompany);

    if (!results.length) { emitLog('⚠️  Aucun résultat — fin pagination', undefined); break; }

    for (const r of results) {
      if (!allResults.some(x => x.profileUrl === r.profileUrl)) {
        allResults.push(r);
        if (allResults.length >= CONFIG.maxProfiles) break;
      }
    }

    currentPage++;
    await randDelay(3000, 7000);
  }

  return allResults;
}

// ─── Formatage du payload final ───────────────────────────────────────────────

function buildPayload(index, raw, profile) {
  const isCompany = profile.type === 'company';

  return {
    id:       `li_${Date.now()}_${index}`,
    name:     profile.name || raw.name || '',
    initials: (profile.name || raw.name || 'L')[0].toUpperCase(),

    // Poste et entreprise
    position: isCompany
      ? (profile.tagline || '')
      : (profile.currentPosition || profile.headline || raw.title || ''),
    company: isCompany
      ? (profile.name || raw.name || '')
      : (profile.currentCompany || ''),

    // Coordonnées
    email:   profile.email   || '',
    phone:   profile.phone   || '',
    website: profile.website || '',
    photo:   profile.photo   || raw.photo || '',
    address: profile.location || raw.location || '',

    // Source
    source: isCompany ? 'linkedin_company' : 'linkedin',
    score:  0,
    tags:   isCompany ? (profile.specialties?.slice(0, 5) || []) : [],

    socialLinks: {
      linkedin: profile.profileUrl || raw.profileUrl || '',
    },

    // Données contractuelles complètes
    contractDetails: {
      about:       profile.about       || '',
      headline:    profile.headline    || profile.tagline || '',
      location:    profile.location    || raw.location || '',
      followers:   profile.followers   || '',
      experiences: profile.experiences || [],
      industry:    profile.industry    || '',
      companySize: profile.companySize || '',
      foundedYear: profile.foundedYear || '',
      specialties: profile.specialties || [],
      photo:       profile.photo       || raw.photo || '',

      // Responsable de l'entreprise (si type company)
      responsible: isCompany ? (profile.responsible || null) : null,
    },

    enrichmentStatus: 'done',
    profileUrl: profile.profileUrl || raw.profileUrl || '',
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  emitLog('🚀 LinkedIn Scraper v3 — filtres avancés + visite profil complète', 0);

  if (!CONFIG.email || !CONFIG.password) {
    emitLog('ERROR: Email et mot de passe requis.', undefined); process.exit(1);
  }

  // Déterminer les types de recherche à effectuer
  // 'all' = on lance d'abord une recherche people, puis une recherche companies
  const searchTypes = CONFIG.searchType === 'all'
    ? ['people', 'companies']
    : CONFIG.searchType === 'person' ? ['people'] : ['companies'];

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ['--lang=fr-FR', '--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport:   { width: 1366, height: 768 },
    userAgent:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    locale:     'fr-FR',
    timezoneId: 'Indian/Antananarivo',
  });

  const page = await context.newPage();

  try {
    // ── 1. Session ──────────────────────────────────────────────────────────
    const hasCookies = await loadSession(context, CONFIG.email);
    if (hasCookies) {
      const valid = await isSessionValid(page);
      if (!valid) { emitLog('⚠️  Session expirée — reconnexion...', 5); await login(page, context); }
      else emitLog('✅ Session valide — pas de login nécessaire', 10);
    } else {
      await login(page, context);
    }

    const postLoginAlert = await detectAlert(page);
    if (postLoginAlert === 'checkpoint' || postLoginAlert === 'captcha') {
      emitLog('ERROR: Compte challengé. Utilise un autre compte.', undefined); process.exit(1);
    }

    // ── 2. Boucle sur les types de recherche ────────────────────────────────
    let globalIndex = 0;
    const maxPerType = CONFIG.searchType === 'all'
      ? Math.ceil(CONFIG.maxProfiles / 2)
      : CONFIG.maxProfiles;

    for (const searchType of searchTypes) {
      emitLog(`\n🔎 Recherche ${searchType === 'people' ? 'Personnes' : 'Entreprises'} — "${CONFIG.keywords}"${CONFIG.city ? ' · ' + CONFIG.city : ''}${CONFIG.country ? ' · ' + CONFIG.country : ''}`, 15);

      // Récupérer la liste
      const listResults = await scrapeSearchList(page, searchType);
      const toVisit     = listResults.slice(0, maxPerType);

      emitLog(`📋 ${toVisit.length} profils à visiter`, 20);

      // Visiter chaque profil
      for (let i = 0; i < toVisit.length; i++) {
        const raw = toVisit[i];
        const pct = 20 + Math.round(((globalIndex) / CONFIG.maxProfiles) * 75);

        // Vérifier annulation
        const cancelFile = path.join(__dirname, 'cancel_scrape.lock');
        if (fs.existsSync(cancelFile)) {
          emitLog('🛑 Scraping annulé par l\'utilisateur.', pct); break;
        }

        emitLog(`📄 [${i + 1}/${toVisit.length}] ${raw.name}`, pct);

        try {
          let profile;

          if (searchType === 'companies') {
            profile = await scrapeCompanyProfile(page, raw.profileUrl);
          } else {
            profile = await scrapePersonProfile(page, raw.profileUrl);
          }

          // Vérifier alerte après visite profil
          const profileAlert = await detectAlert(page);
          if (profileAlert === 'checkpoint' || profileAlert === 'captcha') {
            emitLog('ERROR: LinkedIn bloque après visite de profil. Arrêt.', pct); break;
          }

          const payload = buildPayload(globalIndex, raw, profile);
          emitResult(payload);
          emitLog(`   ✅ email:${payload.email ? '✓' : '✗'} tél:${payload.phone ? '✓' : '✗'} site:${payload.website ? '✓' : '✗'}`, pct);

        } catch (err) {
          emitLog(`   ❌ Erreur sur ${raw.name} : ${err.message}`, pct);
          // Émettre le résultat minimal pour ne pas perdre le prospect
          emitResult(buildPayload(globalIndex, raw, { ...raw, type: searchType === 'companies' ? 'company' : 'person' }));
        }

        globalIndex++;

        // Pause entre profils (plus longue pour simuler la lecture)
        if (i < toVisit.length - 1) await randDelay(CONFIG.delayBetween, CONFIG.delayBetween + 3000);
      }

      // Pause entre les deux types de recherche si mode 'all'
      if (searchTypes.indexOf(searchType) < searchTypes.length - 1) {
        emitLog('⏸️  Pause entre les deux types de recherche...', 70);
        await randDelay(5000, 10000);
      }
    }

    emitLog(`\n🏁 Scraping terminé — ${globalIndex} profil(s) extraits`, 100);

  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(err => {
  emitLog(`ERROR: ${err.message}`, undefined);
  process.exit(1);
});
