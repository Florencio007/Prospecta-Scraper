// ─────────────────────────────────────────────────────────────────────────────
// Scraper Facebook — Version Playwright
// Installation : npm install playwright
//                npx playwright install chromium
// ─────────────────────────────────────────────────────────────────────────────
const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

function emitLog(msg, pct = undefined) {
  // Console log pour l'exécution locale
  console.log(msg);
  // Envoi vers le frontend (SSE) afin d'être capté par le terminal Prospecta
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
const [, , argEmail, argPass, argQuery, argMax, argMaxPosts, argSearchType, argActivityType] = process.argv;

const CONFIG = {
  email: argEmail || '0326077824',
  password: argPass || '0326077824',
  searchQuery: argQuery || 'florencio randrianjafitahina',
  // 'people' → recherche de personnes | 'pages' → recherche de pages (entreprises)
  searchType: (argSearchType === 'pages' || argSearchType === 'company') ? 'pages' : 'people',
  maxProfiles: parseInt(argMax, 10) || 1,
  maxPosts: parseInt(argMaxPosts, 10) || 10, // Nombre max de posts/commentaires à extraire
  // 'all' → posts + commentaires | 'posts' → posts seulement | 'comments' → commentaires seulement
  activityType: (argActivityType === 'posts' || argActivityType === 'comments') ? argActivityType : 'all',
  outputFile: 'facebook-results.json',
  headless: false,
  delay: 2500,
};

emitLog(`🚀 Facebook Scraper — mode complet\n`);
if (argEmail) {
  emitLog(`[Facebook Scraper] Config dynamisée : Query="${CONFIG.searchQuery}", Max=${CONFIG.maxProfiles}, Type=${CONFIG.searchType}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Prompt interactif (utilisé en exécution locale) ───────────────────────────
async function askQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

/**
 * Choix interactif du type de recherche (Personnes vs Pages)
 */
async function promptSearchType() {
  emitLog('\n┌─────────────────────────────────────┐');
  emitLog('│  Type de recherche Facebook          │');
  emitLog('│  1 → Personnes (profils individuels) │');
  emitLog('│  2 → Pages (entreprises, marques...) │');
  emitLog('└─────────────────────────────────────┘');
  const ans = await askQuestion('Votre choix [1/2] : ');
  CONFIG.searchType = ans === '2' ? 'pages' : 'people';
  emitLog(`\n✅ Mode sélectionné : ${CONFIG.searchType === 'pages' ? 'Pages' : 'Personnes'}\n`);
}

// ── Login ─────────────────────────────────────────────────────────────────────
// ── Connexion (Login) ────────────────────────────────────────────────────────
/**
 * Gère l'authentification sur Facebook, incluant le rejet des cookies
 */
async function login(page) {
  emitLog('🔐 Connexion à Facebook...');
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle', timeout: 45000 });
  await sleep(3000);

  // Tentative de fermeture automatique du bandeau de cookies (multilingue)
  try {
    const consentTexts = ['Accepter tout', 'Accept all', 'Allow all cookies', 'Tout accepter', 'OK', 'Accepter'];
    const buttons = page.locator('button, [role="button"]');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const txt = (await btn.textContent().catch(() => '') || '').trim();
      if (consentTexts.some(t => txt.toLowerCase().includes(t.toLowerCase()))) {
        await btn.click();
        emitLog(`   🍪 Bandeau Cookies fermé ("${txt}")`);
        await sleep(1500);
        break;
      }
    }
  } catch (_) { }

  // Vérification si déjà connecté via la session actuelle
  if (page.url().includes('/feed') || page.url().includes('facebook.com/?')) {
    const hasNav = page.locator('[aria-label="Facebook"], [aria-label="Accueil"]');
    if (await hasNav.isVisible({ timeout: 2000 }).catch(() => false)) {
      emitLog('✅ Déjà connecté !\n');
      return;
    }
  }

  // Navigation vers la page de login si nécessaire
  await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle', timeout: 45000 });
  await sleep(2500);

  // Recherche des champs E-mail/Login
  let emailSel = null;
  for (const sel of ['#email', 'input[name="email"]', 'input[type="email"]']) {
    if (await page.locator(sel).isVisible({ timeout: 2000 }).catch(() => false)) { emailSel = sel; break; }
  }
  if (!emailSel) {
    if (CONFIG.headless) {
      emitLog('ERROR: Formulaire de connexion Facebook introuvable (bloqué ou checkpoint). Connexion automatique impossible.');
      process.exit(1);
    } else {
      emitLog('PROGRESS: ⚠️ Formulaire de connexion caché — Veuillez vous connecter manuellement dans le navigateur ouvert...');
      // wait until we navigate away from this state
      for (let i = 0; i < 300; i++) {
        await sleep(1000);
        if (page.url().includes('/feed') || page.url().includes('facebook.com/?')) break;
      }
      return;
    }
  }

  await page.fill(emailSel, CONFIG.email);
  await sleep(400);

  // Recherche du champ Mot de passe
  let passSel = null;
  for (const sel of ['#pass', 'input[name="pass"]', 'input[type="password"]']) {
    if (await page.locator(sel).isVisible({ timeout: 2000 }).catch(() => false)) { passSel = sel; break; }
  }
  if (!passSel) throw new Error('Champ mot de passe introuvable');
  await page.fill(passSel, CONFIG.password);
  await sleep(400);

  // Clic sur le bouton de connexion
  let clicked = false;
  for (const sel of ['[name="login"]', 'button[type="submit"]', '#loginbutton', '[data-testid="royal_login_button"]']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) { await btn.click(); clicked = true; break; }
  }
  if (!clicked) await page.keyboard.press('Enter');

  // Attente du chargement après validation ou d'une erreur
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const url = page.url();

    // Détection d'erreurs d'identifiants
    const hasError = await page.evaluate(() => {
      // Les messages d'erreur Facebook peuvent avoir plusieurs sélecteurs selon l'A/B testing
      const errEl = document.querySelector('#error_box, .login_error_box, [role="alert"], #login_error, [data-testid="royal_login_button"] ~ div');
      // On s'assure que le texte contient des mots typiques d'erreur
      const text = errEl ? errEl.innerText.trim().toLowerCase() : '';
      if (text && (text.includes('incorrect') || text.includes('mot de passe') || text.includes('password') || text.includes('email') || text.includes('invalid') || text.includes('invalide'))) {
        return errEl.innerText.trim();
      }
      return null;
    });

    if (hasError) {
      emitLog(`ERROR: Identifiants Facebook invalides : ${hasError}`);
      process.exit(1);
    }

    if (!url.includes('/login') && !url.includes('login.php')) break;
  }

  // Détection des défis de sécurité (Code 2FA, etc.)
  const finalUrl = page.url();
  if (finalUrl.includes('checkpoint') || finalUrl.includes('two_step') || finalUrl.includes('recover') || finalUrl.includes('challenge')) {
    if (CONFIG.headless) {
      emitLog('ERROR: Vérification de sécurité Facebook requise (2FA/Checkpoint). Connexion automatique impossible.');
      process.exit(1);
    } else {
      emitLog('PROGRESS: ⚠️ Vérification de sécurité requise — Veuillez entrer le code 2FA/compléter le défi dans le navigateur...');
      // Attente automatique que l'utilisateur passe le challenge
      for (let i = 0; i < 300; i++) {
        await sleep(1000);
        const u = page.url();
        if (!u.includes('checkpoint') && !u.includes('two_step') && !u.includes('recover') && !u.includes('challenge')) break;
      }
    }
  }

  try {
    // Fermeture des popups envahissants après login
    await page.evaluate(() => {
      document.querySelectorAll('[aria-label="Close"], [aria-label="Fermer"], [aria-label="Not Now"], [aria-label="Pas maintenant"]').forEach(b => b.click());
    });
    await sleep(800);
  } catch (_) { }

  emitLog(`✅ Connecté avec succès ! (${page.url().substring(0, 60)})\n`);
}

// ── Liste des profils / pages ─────────────────────────────────────────────────
async function scrapePersonList(page) {
  const endpoint = CONFIG.searchType === 'pages' ? 'pages' : 'people';
  const url = `https://www.facebook.com/search/${endpoint}/?q=${encodeURIComponent(CONFIG.searchQuery)}`;
  emitLog(`\n🔍 Recherche ${CONFIG.searchType === 'pages' ? 'Pages' : 'Personnes'} : ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  for (let i = 0; i < 5; i++) { await page.evaluate(() => window.scrollBy(0, 800)); await sleep(1000); }

  const people = await page.evaluate((searchType) => {
    const results = [];
    const seen = new Set();
    const SKIP = ['https://www.facebook.com/', '/search/', '/groups/', '/watch', '/marketplace',
      '/gaming', '/help', '/privacy', '/terms', '/events', '/friends', '/photos', '/videos', '/reel', '/reels', '/stories'];

    const cards = document.querySelectorAll('[role="article"], [data-testid="browse-result-content"] > div, [data-testid="search-result"]');
    cards.forEach(card => {
      let linkEl = null;
      card.querySelectorAll('a[href]').forEach(a => {
        if (linkEl) return;
        const h = (a.href || '').split('?')[0];
        if (!h || SKIP.some(s => h.includes(s))) return;
        linkEl = a;
      });
      if (!linkEl) return;
      const href = (linkEl.href || '').split('?')[0];
      if (!href || seen.has(href)) return;
      seen.add(href);
      const spans = Array.from(card.querySelectorAll('[dir="auto"], span')).map(s => s.textContent?.trim()).filter(t => t && t.length > 1);
      const name = spans[0] || linkEl.textContent?.trim() || '';
      const subtitle = spans.find(t => t !== name && t.length > 2) || '';
      const photo = card.querySelector('img[src*="scontent"]')?.src || card.querySelector('img')?.src || '';
      if (name && name.length < 120) results.push({ name, title: subtitle, profileUrl: href, photo });
    });

    if (!results.length) {
      document.querySelectorAll('a[href*="facebook.com/"]').forEach(a => {
        const href = (a.href || '').split('?')[0];
        if (!href || seen.has(href) || SKIP.some(s => href.includes(s))) return;
        const name = a.querySelector('[dir="auto"]')?.textContent?.trim() || a.textContent?.trim()?.substring(0, 60) || '';
        if (name && name.length > 1 && name.length < 120) { seen.add(href); results.push({ name, title: '', profileUrl: href, photo: '' }); }
      });
    }
    return results.slice(0, 20);
  }, CONFIG.searchType);

  emitLog(`\n👥 ${people.length} résultats extraits`);
  people.forEach(p => emitLog(`   • ${p.name} — ${p.title} (${p.profileUrl})`));
  return people;
}

// ── Photo de profil (méthode dédiée, séparée de la couverture) ───────────────
async function scrapeProfilePhoto(page, profileUrl) {
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);
  await page.evaluate(() => window.scrollTo(0, 200));
  await sleep(800);

  const photo = await page.evaluate(() => {
    // ── IMPORTANT : exclure la navbar du haut (qui contient VOTRE propre avatar)
    // La navbar est dans [role="banner"] ou [data-pagelet="NavigationBar"]
    // Le profil cible est dans [role="main"]
    const mainZone = document.querySelector('[role="main"]')
      || document.querySelector('[data-pagelet="ProfileActions"]')
      || document.querySelector('[data-pagelet="ProfileTimeline"]')
      || document.body;

    // ── Stratégie 1 : <image> SVG "Actions pour la photo de profil" DANS la zone main
    // Structure exacte (DevTools) :
    //   <svg aria-label="Actions pour la photo de profil">
    //     <g><image xlink:href="https://scontent.ftnr2-2.fna.fbcdn.net/..."/></g>
    //   </svg>
    const svgSelectors = [
      'svg[aria-label="Actions pour la photo de profil"] image',
      'svg[aria-label*="Actions pour la photo"] image',
      'svg[aria-label*="profile photo actions"] image',
      'svg[aria-label*="Edit profile photo"] image',
      'svg[aria-label*="photo de profil"] image',
    ];
    for (const sel of svgSelectors) {
      try {
        const el = mainZone.querySelector(sel);
        if (el) {
          const src = el.getAttribute('xlink:href') || el.getAttribute('href') || '';
          if (src && src.startsWith('http') && src.includes('fbcdn')) return src;
        }
      } catch (_) { }
    }

    // ── Stratégie 2 : tous les <svg> DANS main — premier <image> fbcdn
    // On reste dans mainZone pour éviter de prendre l'avatar de la navbar
    for (const svg of Array.from(mainZone.querySelectorAll('svg'))) {
      // Ignorer les SVG icônes (petits, pas d'image enfant)
      for (const img of Array.from(svg.querySelectorAll('image'))) {
        const src = img.getAttribute('xlink:href') || img.getAttribute('href') || '';
        if (src && src.includes('fbcdn') && src.startsWith('http')) return src;
      }
    }

    // ── Stratégie 3 : <img> dont l'alt = nom H1 du profil cible, cherché dans main
    const h1Name = mainZone.querySelector('h1')?.textContent?.trim()
      || document.querySelector('h1')?.textContent?.trim() || '';
    if (h1Name) {
      const byAlt = Array.from(mainZone.querySelectorAll('img[alt]')).find(img =>
        img.alt.trim() === h1Name && img.src?.includes('scontent')
      );
      if (byAlt) return byAlt.src;
    }

    // ── Stratégie 4 : lien "photo de profil" dans main
    for (const sel of [
      'a[aria-label*="photo de profil"] img',
      'a[aria-label*="profile picture"] img',
      'a[aria-label*="Profile picture"] img',
    ]) {
      const el = mainZone.querySelector(sel);
      if (el?.src?.includes('scontent')) return el.src;
    }

    // ── Stratégie 5 (fallback) : premier img scontent carré dans main
    // La couverture est rectangulaire (ratio > 2), l'avatar est carré (ratio ~1)
    for (const img of Array.from(mainZone.querySelectorAll('img[src*="scontent"]'))) {
      if (img.src.includes('emoji') || img.src.includes('safe_image')) continue;
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 0 && h > 0 && w / h > 0.7 && w / h < 1.4 && w >= 80) return img.src;
    }

    return '';
  });

  if (photo) emitLog(`   🖼️  Photo profil: ${photo.substring(0, 80)}...`);
  else emitLog('   🖼️  Photo profil: non trouvée');
  return photo;
}

// ── Coordonnées ───────────────────────────────────────────────────────────────
async function scrapeContactInfo(page, profileUrl) {
  let email = '', phone = '', website = '';
  try {
    const aboutUrl = profileUrl.includes('profile.php')
      ? profileUrl + '&sk=about_contact_and_basic_info'
      : `${profileUrl.replace(/\/$/, '')}/about_contact_and_basic_info`;
    await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(2000);
    const data = await page.evaluate(() => {
      const result = { email: '', phone: '', website: '' };
      const body = document.body.innerHTML;
      const emailMatch = body.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) result.email = emailMatch[0];
      document.querySelectorAll('[role="main"] div, [role="article"] div').forEach(div => {
        const text = div.textContent?.trim() || '';
        if (!result.phone && text.match(/^(\+?\d[\d\s\-()]{6,20})$/) && div.children.length === 0) result.phone = text;
        if (!result.website && text.match(/^(https?:\/\/|www\.)\S+/) && div.children.length === 0) result.website = text;
      });
      document.querySelectorAll('a[href^="mailto:"]').forEach(a => { if (!result.email) result.email = a.href.replace('mailto:', ''); });
      document.querySelectorAll('a[href^="http"]:not([href*="facebook"]):not([href*="fb.com"])').forEach(a => { if (!result.website) result.website = a.href; });
      return result;
    });
    email = data.email; phone = data.phone; website = data.website;
  } catch (_) { }
  return { email, phone, website };
}

// ── Page principale du profil ─────────────────────────────────────────────────
async function scrapeMainProfile(page, profileUrl) {
  emitLog('   📄 Page principale...');

  // Photo d'abord (méthode dédiée)
  const photo = await scrapeProfilePhoto(page, profileUrl);

  // Re-naviguer pour les autres données
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  for (let i = 0; i < 8; i++) { await page.evaluate(() => window.scrollBy(0, 500)); await sleep(400); }

  try {
    await page.evaluate(() => {
      document.querySelectorAll('[role="button"]').forEach(b => {
        const t = b.textContent?.trim()?.toLowerCase();
        if (t === 'see more' || t === 'voir plus') b.click();
      });
    });
    await sleep(500);
  } catch (_) { }

  const contact = await scrapeContactInfo(page, profileUrl);

  const data = await page.evaluate(() => {
    function getText(el) {
      if (!el) return '';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = []; let n;
      while ((n = w.nextNode())) { const t = n.textContent?.trim(); if (t && t !== 'See more' && t !== 'Voir plus') parts.push(t); }
      return parts.join(' ').trim();
    }

    const name = document.querySelector('h1')?.textContent?.trim() || '';

    let headline = '';
    const introSection = document.querySelector('[data-pagelet="ProfileTilesFeed_0"], [data-pagelet="ProfileTimeline"]');
    if (introSection) {
      const spans = Array.from(introSection.querySelectorAll('span[dir="auto"]')).map(s => s.textContent?.trim()).filter(t => t && t.length > 5 && t !== name);
      headline = spans[0] || '';
    }
    if (!headline) {
      const allSpans = Array.from(document.querySelectorAll('span[dir="auto"]')).map(s => s.textContent?.trim()).filter(t => t && t.length > 5 && t !== name);
      headline = allSpans.find(t => t.includes(' at ') || t.includes(' chez ') || t.includes('CEO') || t.includes('Founder') || t.includes('Director')) || allSpans[1] || '';
    }

    let location = '';
    document.querySelectorAll('[role="main"] span[dir="auto"]').forEach(sp => {
      const t = sp.textContent?.trim() || '';
      if (!location && t.length > 3 && (t.includes(',') || t.includes('Lives') || t.includes('From') || t.includes('Habite') || t.includes('Vit'))) location = t;
    });

    let followers = '';
    const follMatch = document.body.innerText.match(/([\d\s,]+)\s*(followers?|abonnés?)/i);
    if (follMatch) followers = follMatch[0].trim();

    let about = '';
    const introEl = document.querySelector('[data-pagelet="ProfileIntro"]') || document.querySelector('[aria-label*="Intro"], [aria-label*="intro"]');
    if (introEl) about = getText(introEl).substring(0, 3000);

    const experiences = [];
    document.querySelectorAll('[role="main"] [role="listitem"], [role="main"] li').forEach(item => {
      const t = item.textContent?.trim() || '';
      if (t.includes(' at ') || t.includes(' chez ')) {
        const parts = t.split(/ at | chez /i);
        if (parts.length >= 2) experiences.push({ role: parts[0].trim(), company: parts[1].trim(), duration: '', location: '', description: '' });
      }
    });

    const education = [];
    const eduMatch = document.body.innerText.match(/(?:Studied|Studies|Étudié|Université|University|College|School)[^\n]{0,100}/gi);
    if (eduMatch) eduMatch.slice(0, 5).forEach(e => education.push({ school: e.trim(), degree: '', years: '' }));

    return { name, headline, location, followers, about, experiences, education, certifications: [], recommendations: [] };
  });

  return { ...data, photo, ...contact };
}

// ── Compétences / Work & Education ───────────────────────────────────────────
async function scrapeSkills(page, profileUrl) {
  emitLog('   �� Compétences / Travail...');
  const workUrl = profileUrl.includes('profile.php')
    ? profileUrl + '&sk=about_work_and_education'
    : `${profileUrl.replace(/\/$/, '')}/about_work_and_education`;
  try {
    await page.goto(workUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    for (let i = 0; i < 5; i++) { await page.evaluate(() => window.scrollBy(0, 600)); await sleep(500); }
    return await page.evaluate(() => {
      const skills = [];
      const seen = new Set();
      document.querySelectorAll('[role="listitem"], li').forEach(item => {
        const t = item.textContent?.trim() || '';
        if (t.length > 2 && t.length < 120 && !seen.has(t)) {
          const bad = t.includes('See more') || t.includes('Voir plus') || t.includes('Add') || t.includes('Edit') || t.includes('ago') || t.match(/^\d/);
          if (!bad) { seen.add(t); skills.push({ name: t, endorsements: '' }); }
        }
      });
      return skills.slice(0, 30);
    });
  } catch (_) { return []; }
}

// ── Activité (posts /posts/) ──────────────────────────────────────────────────
async function scrapeActivity(page, profileUrl) {
  emitLog('   📝 Activité...');

  // Utiliser /posts/ (onglet dédié, plus fiable que la timeline)
  const postsUrl = profileUrl.includes('profile.php')
    ? profileUrl + '&sk=timeline'
    : `${profileUrl.replace(/\/$/, '')}/posts`;

  await page.goto(postsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3500);

  // Scroll agressif pour charger le contenu
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.scrollBy(0, 900)); await sleep(1300); }

  try {
    await page.evaluate(() => {
      document.querySelectorAll('[role="button"], [role="link"]').forEach(b => {
        const t = b.textContent?.trim()?.toLowerCase();
        if (t === 'see more' || t === 'voir plus') b.click();
      });
    });
    await sleep(600);
  } catch (_) { }

  // Diagnostic
  const dump = await page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('[role="article"]'));
    return {
      total: articles.length,
      url: location.href,
      sample: articles.slice(0, 3).map(el => ({
        label: el.getAttribute('aria-label')?.substring(0, 60) || '',
        hasPostLink: !!el.querySelector('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid"]'),
        firstSpan: el.querySelector('[dir="auto"]')?.textContent?.trim()?.substring(0, 60) || '',
      })),
    };
  });
  emitLog(`   🔬 URL: ${dump.url.substring(0, 70)} | Articles: ${dump.total}`);
  dump.sample.forEach((s, i) => emitLog(`      [${i}] "${s.label}" postLink:${s.hasPostLink} span:"${s.firstSpan}"`));

  return await page.evaluate((max) => {
    function getText(el) {
      if (!el) return '';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = []; let n;
      while ((n = w.nextNode())) {
        const t = n.textContent?.trim();
        if (t && t !== 'See more' && t !== 'Voir plus' && t.length > 0) parts.push(t);
      }
      return parts.join(' ').trim();
    }

    const results = [];
    const seen = new Set();

    document.querySelectorAll('[role="article"]').forEach(el => {
      if (results.length >= max) return;

      const label = el.getAttribute('aria-label') || '';
      const dataFt = el.getAttribute('data-ft') || '';
      const uid = label || dataFt || el.innerHTML.substring(0, 100);
      if (seen.has(uid)) return;
      seen.add(uid);

      // Ignorer si pas de contenu post
      const hasContent = el.querySelector(
        '[data-ad-comet-preview="message"], [data-testid="post_message"], a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid"]'
      );
      if (!hasContent) return;

      const authorEl = el.querySelector('h2 a, h3 a, [data-testid="story-subtitle"] a, strong a');
      const author = authorEl?.textContent?.trim() || '';

      const dateEl = el.querySelector('abbr[data-utime], a[href*="/posts/"] span, a[href*="/permalink/"] span, abbr');
      const date = dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || '';

      const textEl = el.querySelector('[data-ad-comet-preview="message"], [data-testid="post_message"]')
        || el.querySelector('div[dir="auto"][style*="text-align: start"]')
        || el.querySelector('[dir="auto"] > div > span')
        || el.querySelector('[dir="auto"]');
      const text = getText(textEl).substring(0, 1500);

      const likes = el.querySelector('[aria-label*="reaction"], [aria-label*="réaction"], [aria-label*="J\'aime"]')?.textContent?.trim() || '0';
      const comments = el.querySelector('[aria-label*="comment"], [aria-label*="commentaire"]')?.textContent?.trim() || '0';
      const shares = el.querySelector('[aria-label*="share"], [aria-label*="partage"]')?.textContent?.trim() || '0';

      let postUrl = '';
      el.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid"]').forEach(a => {
        if (!postUrl) postUrl = (a.href || '').split('?')[0];
      });

      const image = el.querySelector('img[src*="scontent"]')?.src || '';

      let originalPost = null;
      const sharedEl = el.querySelector('[aria-label*="Shared"], [data-testid="repost"], [aria-label*="Partagé"]');
      if (sharedEl) {
        originalPost = {
          author: sharedEl.querySelector('a[role="link"]')?.textContent?.trim() || '',
          text: getText(sharedEl).substring(0, 600),
          url: (sharedEl.querySelector('a[href*="/posts/"]')?.href || '').split('?')[0],
        };
      }

      if (text.length > 5 || (originalPost?.text?.length > 5) || postUrl)
        results.push({ actionType: 'Post', author, date, text, image, likes, comments, shares, postUrl, originalPost });
    });
    return results;
  }, CONFIG.maxPosts);
}

// ── Commentaires ─────────────────────────────────────────────────────────────
async function scrapeComments(page, profileUrl) {
  emitLog('   💬 Commentaires...');
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  for (let i = 0; i < 10; i++) { await page.evaluate(() => window.scrollBy(0, 900)); await sleep(1200); }

  const domDump = await page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('[role="article"]'));
    return articles.slice(0, 4).map((el, i) => ({
      i,
      label: (el.getAttribute('aria-label') || '').substring(0, 70),
      spans: Array.from(el.querySelectorAll('[dir="auto"]')).map(s => s.textContent?.trim()).filter(Boolean).slice(0, 6),
      links: Array.from(el.querySelectorAll('a[href]')).map(a => (a.href || '').substring(0, 120)).filter(h => h.includes('/posts/') || h.includes('/permalink/')).slice(0, 3),
    }));
  });

  emitLog('\n🔬 DOM timeline articles :');
  domDump.forEach(d => {
    emitLog(`\n  [${d.i}] ${d.label}`);
    emitLog(`       spans: ${JSON.stringify(d.spans)}`);
    emitLog(`       links: ${JSON.stringify(d.links)}`);
  });

  const rawComments = await page.evaluate((max) => {
    function getText(el) {
      if (!el) return '';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = []; let n;
      while ((n = w.nextNode())) { const t = n.textContent?.trim(); if (t && t !== 'See more' && t !== 'Voir plus') parts.push(t); }
      return parts.join(' ').trim();
    }
    const results = [];
    const seen = new Set();
    document.querySelectorAll('[role="article"]').forEach(el => {
      if (results.length >= max) return;
      const label = el.getAttribute('aria-label') || '';
      const headerText = el.querySelector('h2, h3')?.textContent?.trim() || '';
      const isCommentActivity = label.toLowerCase().includes('comment') || headerText.toLowerCase().includes('commenté') || headerText.toLowerCase().includes('commented');
      const id = label || headerText;
      if (seen.has(id) && id) return;
      if (id) seen.add(id);

      const date = el.querySelector('abbr[data-utime], a[aria-label] span, abbr')?.textContent?.trim() || '';
      const allTexts = Array.from(el.querySelectorAll('[dir="auto"] span')).map(s => s.textContent?.trim()).filter(t => t && t.length > 5);
      const originalPostText = allTexts.slice(0, 3).join(' ').substring(0, 1200);
      const originalPostAuthor = el.querySelector('a[href*="facebook.com/"] span')?.textContent?.trim() || '';
      let originalPostUrl = '';
      el.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"]').forEach(a => { if (!originalPostUrl) originalPostUrl = (a.href || '').split('?')[0]; });
      const likes = el.querySelector('[aria-label*="reaction"], [aria-label*="réaction"]')?.textContent?.trim() || '';
      const commentsCount = el.querySelector('[aria-label*="comment"], [aria-label*="commentaire"]')?.textContent?.trim() || '';

      if (isCommentActivity || originalPostUrl)
        results.push({ date, myComment: '', originalPostUrl, originalPostAuthor, originalPostAuthorTitle: '', originalPostText, originalPostLikes: likes, originalPostComments: commentsCount });
    });
    return results;
  }, 25);

  emitLog(`\n   📊 ${rawComments.length} activités-commentaires extraites`);

  const enrichedComments = [];
  for (const comment of rawComments) {
    let originalPost = {
      author: comment.originalPostAuthor, authorTitle: '',
      text: comment.originalPostText, likes: comment.originalPostLikes,
      comments: comment.originalPostComments, url: comment.originalPostUrl,
    };
    let myComment = comment.myComment;

    if (comment.originalPostUrl) {
      try {
        emitLog(`      🔗 ${comment.originalPostUrl}`);
        await page.goto(comment.originalPostUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await sleep(2500);
        for (let i = 0; i < 5; i++) { await page.evaluate(() => window.scrollBy(0, 500)); await sleep(500); }

        try {
          await page.evaluate(() => {
            document.querySelectorAll('[role="button"]').forEach(b => {
              const t = b.textContent?.trim()?.toLowerCase();
              if (t === 'see more' || t === 'voir plus' || t === 'view more comments' || t === 'voir plus de commentaires') b.click();
            });
          });
          await sleep(500);
        } catch (_) { }

        const postData = await page.evaluate(() => {
          function getText(el) {
            if (!el) return '';
            const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const parts = []; let n;
            while ((n = w.nextNode())) { const t = n.textContent?.trim(); if (t && t !== 'See more' && t !== 'Voir plus') parts.push(t); }
            return parts.join(' ').trim();
          }
          const postEl = document.querySelector('[role="article"]');
          const author = postEl?.querySelector('h2 a, h3 a, [data-testid="story-subtitle"] a')?.textContent?.trim() || '';
          const textEl = postEl?.querySelector('[data-ad-comet-preview="message"], [data-testid="post_message"], [dir="auto"] > div > span');
          const text = getText(textEl || postEl?.querySelector('[dir="auto"]')).substring(0, 1500);
          const likes = postEl?.querySelector('[aria-label*="reaction"], [aria-label*="réaction"]')?.textContent?.trim() || '';
          const commentsCount = postEl?.querySelector('[aria-label*="comment"], [aria-label*="commentaire"]')?.textContent?.trim() || '';
          let myCommentText = '';
          document.querySelectorAll('[role="article"] [role="article"]').forEach(item => {
            if (myCommentText) return;
            const t = getText(item.querySelector('[dir="auto"]') || item);
            if (t.length > 10) myCommentText = t.substring(0, 1000);
          });
          return { author, text, likes, comments: commentsCount, myCommentText };
        });

        originalPost = {
          author: postData.author || comment.originalPostAuthor, authorTitle: '',
          text: postData.text.length > comment.originalPostText.length ? postData.text : comment.originalPostText,
          likes: postData.likes || comment.originalPostLikes,
          comments: postData.comments || comment.originalPostComments,
          url: comment.originalPostUrl,
        };
        if (postData.myCommentText && postData.myCommentText.length > myComment.length) myComment = postData.myCommentText;
        emitLog(`      ✅ author:"${originalPost.author}" | post:${originalPost.text.length}c | comment:${myComment.length}c`);
      } catch (err) {
        emitLog(`      ⚠️  ${err.message}`);
      }
      await sleep(1800);
    }
    enrichedComments.push({ date: comment.date, myComment, originalPost });
  }
  return enrichedComments;
}

// ── Page About de la page Facebook (détails complets) ────────────────────────────────
/**
 * Navigue vers la page About d'une Page Facebook et extrait toutes les informations :
 * followers, suivis, description, téléphone, email, adresse, site web, horaires, liens.
 */
async function scrapePageAbout(page, profileUrl) {
  emitLog('   📋 Page About Facebook...');

  const aboutUrl = profileUrl.includes('profile.php')
    ? profileUrl + '&sk=about'
    : `${profileUrl.replace(/\/$/, '')}/about`;

  await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  // Cliquer sur "voir plus" pour déployer les descriptions
  try {
    await page.evaluate(() => {
      document.querySelectorAll('[role="button"]').forEach(b => {
        const t = (b.textContent || '').trim().toLowerCase();
        if (t === 'voir plus' || t === 'see more') b.click();
      });
    });
    await sleep(600);
  } catch (_) { }

  // Scroll pour tout charger
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.scrollBy(0, 600)); await sleep(500); }

  const aboutData = await page.evaluate(() => {
    function getText(el) {
      if (!el) return '';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = []; let n;
      while ((n = w.nextNode())) {
        const t = n.textContent?.trim();
        if (t && t !== 'Voir plus' && t !== 'See more') parts.push(t);
      }
      return parts.join(' ').trim();
    }

    const result = {
      followers: '',
      following: '',
      description: '',
      category: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      mapsUrl: '', // NOUVEAU
      businessHours: '',
      links: [],
      industry: '',      // NOUVEAU
      companySize: '',   // NOUVEAU
      companyType: '',   // NOUVEAU
      foundedYear: '',   // NOUVEAU
      specialties: [],   // NOUVEAU
      priceRange: '',
    };

    const bodyText = document.body.innerText || '';

    // ── Followers / Suivis depuis le header ou la page About ──
    // Chercher le pattern "X K followers" ou "X abonnés"
    const followerPatterns = [
      /([\d][\d\s,.]*[KkMm]?)\s*(?:followers?|abonnés?)/i,
      /([\d][\d\s,.]+)\s*(?:followers?|abonnés?)/i,
    ];
    for (const pat of followerPatterns) {
      const m = bodyText.match(pat);
      if (m) { result.followers = m[0].trim(); break; }
    }

    // Suivis
    const followingMatch = bodyText.match(/([\d][\d\s,.]*[KkMm]?)\s*(?:suivi(?:e)?s?|following)/i);
    if (followingMatch) result.following = followingMatch[0].trim();

    // ── Description / À propos ──
    // Chercher la section "À propos" ou le premier grand bloc de texte
    const aboutSelectors = [
      '[data-pagelet*="About"] [dir="auto"]',
      'div[role="main"] div[data-ad-comet-preview="message"]',
      '[aria-label*="propos"] [dir="auto"]',
      '[aria-label*="About"] [dir="auto"]',
    ];
    for (const sel of aboutSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const t = getText(el);
        if (t.length > 20) { result.description = t.substring(0, 3000); break; }
      }
    }
    // Fallback : chercher la description dans le body via regex
    if (!result.description) {
      const descMatch = bodyText.match(/Description[\s\S]{0,10}?([A-Z][\s\S]{30,500}?)(?:\n[A-Z]|$)/);
      if (descMatch) result.description = descMatch[1].trim().substring(0, 1000);
    }

    // ── Catégorie / Industrie (type de page) ──
    const catEl = document.querySelector('[role="main"] h2 ~ div span, [role="main"] [data-testid="page-subtitle"]');
    if (catEl) {
      const catText = catEl.textContent?.trim() || '';
      result.category = catText;
      result.industry = catText; // Alias pour la cohérence
      if (catText.includes('Entreprise') || catText.includes('Company') || catText.includes('Agence')) {
         result.companyType = catText;
      }
    }

    // ── Téléphone ──
    const phoneMatch = bodyText.match(/(?:\+?\d[\d\s\-().]{6,20}\d)(?=\s|$|\n)/);
    if (phoneMatch) result.phone = phoneMatch[0].trim();
    // Chercher aussi les éléments avec icône téléphone
    document.querySelectorAll('[aria-label*="Téléphone"], [aria-label*="Phone"], [aria-label*="phone"]').forEach(el => {
      if (!result.phone) {
        const t = el.closest('div')?.querySelector('[dir="auto"]')?.textContent?.trim() || '';
        if (t.match(/[\d+\-().]{6,}/)) result.phone = t;
      }
    });
    // Regex plus permissive sur le texte complet
    if (!result.phone) {
      const m2 = bodyText.match(/0\d{2}\s?\d{2}\s?\d{3}\s?\d{2}/);
      if (m2) result.phone = m2[0].trim();
    }

    // ── Email ──
    const emailMatch = document.body.innerHTML.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) result.email = emailMatch[0];
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      if (!result.email) result.email = a.href.replace('mailto:', '');
    });

    // ── Site web (liens externes) ──
    const externalLinks = [];
    document.querySelectorAll('a[href^="http"]:not([href*="facebook.com"]):not([href*="fb.com"]):not([href*="instagram.com/"])').forEach(a => {
      const h = a.href || '';
      if (h && !externalLinks.includes(h)) externalLinks.push(h);
    });
    result.website = externalLinks[0] || '';
    result.links = externalLinks.slice(0, 5);

    // ── Adresse ──
    document.querySelectorAll('[aria-label*="Adresse"], [aria-label*="Address"], [aria-label*="adresse"]').forEach(el => {
      if (!result.address) {
        const t = el.closest('div')?.querySelector('[dir="auto"]')?.textContent?.trim() || '';
        if (t.length > 5) result.address = t;
      }
    });
    // Extraire un lien direct Google Maps si dispo (souvent en lien externe masqué)
    document.querySelectorAll('a[href*="google.com/maps/"], a[href*="maps.google.com"], a[href*="goo.gl/maps"]').forEach(a => {
      if (!result.mapsUrl) result.mapsUrl = a.href;
    });
    // Fallback : regex adresse Madagascar / commune
    if (!result.address) {
      const addrMatch = bodyText.match(/(?:Trade Tower|Antananarivo|Madagascar|Mahajanga|Toamasina|Fianarantsoa|Antsiranana)[^\n]{0,100}/);
      if (addrMatch) result.address = addrMatch[0].trim();
    }

    // ── Horaires / Business Hours ──
    const hoursMatch = bodyText.match(/(?:Actuellement|Currently|Open|Fermé|Closed|Ouvert)[^\n]{0,80}/);
    if (hoursMatch) result.businessHours = hoursMatch[0].trim();

    // ── Date de création / fondation ──
    const foundedMatch = bodyText.match(/(?:Créée?\s+le|Founded?|Création)[\s:]*([\w\s0-9,]+)(?:\n|$)/);
    if (foundedMatch) {
       result.foundedYear = foundedMatch[1]?.trim() || '';
    }

    // ── Taille de l'entreprise (heuristique texte) ──
    const sizeMatch = bodyText.match(/(?:Employés?|Employees?|Taille de l'entreprise?)[\s:]*([\d\-\+]+)(?:\s+employés?)?/i);
    if (sizeMatch) {
        result.companySize = sizeMatch[1]?.trim() || '';
    }

    // ── Spécialisations (si on trouve des listes) ──
    const specHeader = document.evaluate('//span[contains(text(),"Specialties") or contains(text(),"Spécialisations")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (specHeader && specHeader.parentElement) {
       const textBelow = specHeader.parentElement.nextElementSibling?.textContent?.trim();
       if (textBelow) {
          result.specialties = textBelow.split(',').map(s => s.trim()).filter(Boolean);
       }
    }

    // ── Gamme de prix ──
    const priceMatch = bodyText.match(/[€$£]{1,3}/);
    if (priceMatch) result.priceRange = priceMatch[0];

    return result;
  });

  emitLog(`   ✅ About: followers=${aboutData.followers || 'n/d'} | following=${aboutData.following || 'n/d'} | tél=${aboutData.phone || 'n/d'} | liens=${aboutData.links.length}`);
  return aboutData;
}

// ── Profil complet ────────────────────────────────────────────────────────────
async function scrapeFullProfile(page, person) {
  emitLog(`\n📋 Scraping : ${person.name} (${person.profileUrl})`);
  const main = await scrapeMainProfile(page, person.profileUrl); await sleep(CONFIG.delay);
  const skills = await scrapeSkills(page, person.profileUrl); await sleep(CONFIG.delay);

  // Extraction About complète (surtout utile pour les Pages d'entreprise)
  const aboutDetails = await scrapePageAbout(page, person.profileUrl); await sleep(CONFIG.delay);

  let activity = [];
  let comments = [];

  if (CONFIG.activityType === 'all' || CONFIG.activityType === 'posts') {
    activity = await scrapeActivity(page, person.profileUrl);
    await sleep(CONFIG.delay);
  }
  if (CONFIG.activityType === 'all' || CONFIG.activityType === 'comments') {
    comments = await scrapeComments(page, person.profileUrl);
    await sleep(CONFIG.delay);
  }

  emitLog(`   → ${skills.length} compétences | ${activity.length} activités | ${comments.length} commentaires`);
  return { ...person, ...main, skills, activity: { posts: activity, comments }, aboutDetails };
}

// ── Posts de recherche ────────────────────────────────────────────────────────
async function scrapeSearchPosts(page) {
  emitLog('\n── POSTS DE RECHERCHE ─────────────────────────────────');
  await page.goto(
    `https://www.facebook.com/search/posts/?q=${encodeURIComponent(CONFIG.searchQuery)}`,
    { waitUntil: 'domcontentloaded', timeout: 30000 }
  );
  await sleep(3000);
  for (let i = 0; i < 8; i++) { await page.evaluate(() => window.scrollBy(0, 900)); await sleep(1200); }

  const posts = await page.evaluate((max) => {
    function getText(el) {
      if (!el) return '';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = []; let n;
      while ((n = w.nextNode())) { const t = n.textContent?.trim(); if (t) parts.push(t); }
      return parts.join(' ').trim();
    }
    const results = [];
    const seen = new Set();
    document.querySelectorAll('[role="article"]').forEach(el => {
      if (results.length >= max) return;
      const label = el.getAttribute('aria-label') || '';
      if (seen.has(label) && label) return;
      if (label) seen.add(label);
      const author = el.querySelector('h2 a, h3 a, [role="link"] span')?.textContent?.trim() || '';
      const authorTitle = el.querySelector('h2 + div span, h3 + div span')?.textContent?.trim() || '';
      const date = el.querySelector('abbr[data-utime], a[aria-label] span')?.textContent?.trim() || '';
      const textEl = el.querySelector('[data-ad-comet-preview="message"], [data-testid="post_message"]')
        || el.querySelector('div[dir="auto"][style*="text-align: start"]')
        || el.querySelector('[dir="auto"] > div > span')
        || el.querySelector('[dir="auto"]');
      const text = getText(textEl).substring(0, 1000);
      const likes = el.querySelector('[aria-label*="reaction"], [aria-label*="réaction"]')?.textContent?.trim() || '0';
      const comments = el.querySelector('[aria-label*="comment"], [aria-label*="commentaire"]')?.textContent?.trim() || '0';
      let postUrl = '';
      el.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"]').forEach(a => { if (!postUrl) postUrl = (a.href || '').split('?')[0]; });
      if (text.length > 3 || postUrl) results.push({ actionType: 'Post', author: author || authorTitle, authorTitle, date, text, likes, comments, postUrl });
    });
    return results;
  }, CONFIG.maxPosts);

  emitLog(`📝 ${posts.length} posts trouvés`);
  return posts;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
// ── POINT D'ENTRÉE PRINCIPAL (Main) ──────────────────────────────────────────
async function main() {
  emitLog('🚀 Démarrage du Scraper Facebook — Playwright\n');

  // Configuration interactive si nécessaire
  if (!argEmail) {
    await promptSearchType();
  } else {
    emitLog(`📡 Mode Intégration API détecté (${CONFIG.searchType})`);
  }

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ['--lang=fr-FR', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    javaScriptEnabled: true,
  });

  // Injection d'un script anti-détection (masque le statut Playwright)
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  try {
    // 1. Connexion
    await login(page);

    emitLog(`── PHASE : SCRAPING ${CONFIG.searchType === 'pages' ? 'PAGES' : 'PERSONNES'} ─────────────────────────────────────────`);

    // 2. Recherche et récupération de la liste
    const people = await scrapePersonList(page);

    const profiles = [];
    const total = Math.min(people.length, CONFIG.maxProfiles);

    // 3. Boucle de scraping détaillé
    for (let i = 0; i < total; i++) {
      const pct = Math.round(((i) / total) * 80);
      process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: `Extraction ${i + 1}/${total}: ${people[i].name}` })}\n`);

      try {
        const full = await scrapeFullProfile(page, people[i]);
        profiles.push(full);

        // Transformation en objet Prospect compatible avec le frontend
        const prospectPayload = {
          id: `fb_${Date.now()}_${i}`,
          name: full.name || people[i].name,
          initials: (full.name || people[i].name)?.[0]?.toUpperCase() || 'F',
          position: full.headline || people[i].title || '',
          company: full.headline || people[i].title || '',
          source_platform: CONFIG.searchType === 'pages' ? 'facebook_page' : 'facebook',
          score: 60,
          email: full.email || '',
          phone: full.phone || '',
          website: full.website || '',
          photo: full.photo || '',
          address: full.location || '',
          tags: full.skills?.slice(0, 5).map(s => s.name) || [],
          socialLinks: {
            facebook: full.profileUrl || people[i].profileUrl || '',
          },
          // Détails additionnels
          contractDetails: {
            about: full.aboutDetails?.description || full.about || '',
            headline: full.headline || '',
            location: full.aboutDetails?.address || full.location || '',
            followers: full.aboutDetails?.followers || full.followers || '',
            following: full.aboutDetails?.following || '',
            experiences: full.experiences || [],
            education: full.education || [],
            certifications: full.certifications || [],
            recommendations: full.recommendations || [],
            skills: full.skills || [],
            photo: full.photo || '',
            // Champs About complèts
            category: full.aboutDetails?.category || '',
            phone: full.aboutDetails?.phone || full.phone || '',
            email: full.aboutDetails?.email || full.email || '',
            website: full.aboutDetails?.website || full.website || '',
            address: full.aboutDetails?.address || '',
            businessHours: full.aboutDetails?.businessHours || '',
            links: full.aboutDetails?.links || [],
            founded: full.aboutDetails?.founded || '',
            priceRange: full.aboutDetails?.priceRange || '',
          },
          // Intelligence IA (pour l'onglet activité)
          aiIntelligence: {
            activities: {
              posts: full.activity?.posts || [],
              comments: full.activity?.comments || [],
            },
            contactInfo: {
              phones: full.phone ? [full.phone] : [],
              emails: full.email ? [full.email] : [],
              addresses: []
            },
          },
        };

        // Envoi au frontend via stdout
        process.stdout.write(`RESULT:${JSON.stringify(prospectPayload)}\n`);

        emitLog(`\n✅ ${full.name} extrait avec succès`);
      } catch (err) {
        emitLog(`   ❌ Erreur sur ${people[i].name} : ${err.message}`);
        // Fallback minimal en cas d'erreur
        const fallback = people[i];
        if (fallback?.name) {
          const fallbackPayload = {
            id: `fb_${Date.now()}_${i}_err`,
            name: fallback.name,
            source: CONFIG.searchType === 'pages' ? 'facebook_page' : 'facebook',
            socialLinks: { facebook: fallback.profileUrl || '' },
          };
          process.stdout.write(`RESULT:${JSON.stringify(fallbackPayload)}\n`);
        }
        profiles.push(people[i]);
      }
      await sleep(CONFIG.delay);
    }

    // 4. Extraction des posts globaux liés à la recherche
    const searchPosts = await scrapeSearchPosts(page);

    // 5. Exportation finale vers un fichier JSON
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify({
      scrapedAt: new Date().toISOString(),
      query: CONFIG.searchQuery,
      searchType: CONFIG.searchType,
      summary: {
        profiles: profiles.length,
        searchPosts: searchPosts.length,
      },
      profiles,
      searchPosts,
    }, null, 2), 'utf8');

    emitLog(`\n💾 Rapport final sauvegardé → ${CONFIG.outputFile}`);

  } finally {
    // Fermeture propre du navigateur
    await context.close();
    await browser.close();
    emitLog('\n🏁 Session terminée.');
  }
}

main().catch(console.error);