/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║   PROSPECTA — Scraper Facebook (Playwright)                             ║
 * ║   Utilisable depuis la plateforme (SSE PROGRESS/RESULT) ou en standalone║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { scrapeOfficialSite, isOfficialSite } = require('./site_scraper_module.cjs');

const CANCEL_LOCK = path.join(__dirname, 'cancel_scrape.lock');

function emitLog(msg, pct = undefined) {
  console.log(msg);
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}

function printResult(data) {
  const line = '─'.repeat(60);
  const icon = data.source_platform === 'facebook_page' ? '📄' : '👤';
  console.log(`\n${line}`);
  console.log(`${icon}  ${data.name || 'N/A'}  ${ data.position ? `— ${data.position}` : '' }`);
  if (data.email)   console.log(`   Email    : ${data.email}`);
  if (data.phone)   console.log(`   Tél      : ${data.phone}`);
  if (data.website) console.log(`   Site web : ${data.website}`);
  if (data.address) console.log(`   Lieu     : ${data.address}`);
  const cd = data.contractDetails || {};
  if (cd.followers) console.log(`   Abonnés  : ${cd.followers}`);
  if (cd.about)     console.log(`   Bio      : ${cd.about.substring(0, 150)}${cd.about.length > 150 ? '...' : ''}`);
  const posts = data.activity?.posts || cd.activity?.posts || data.aiIntelligence?.activities?.posts || [];
  const comments = data.activity?.comments || cd.activity?.comments || data.aiIntelligence?.activities?.comments || [];
  if (posts.length)    console.log(`   Posts    : ${posts.length} publication(s) scrappée(s)`);
  if (comments.length) console.log(`   Comms    : ${comments.length} commentaire(s) scrappé(s)`);
  const fb = (data.socialLinks || {}).facebook;
  if (fb) console.log(`   Facebook : ${fb}`);
  console.log(line);
}

function emitResult(data) {
  printResult(data);
  
  // Filtrage des champs si argFields est fourni
  let finalData = { ...data };
  if (requestedFields.length > 0) {
    const allowedKeys = new Set(['source', 'source_platform', 'id', 'photo']);
    if (requestedFields.includes('name')) allowedKeys.add('name');
    if (requestedFields.includes('email')) { allowedKeys.add('email'); allowedKeys.add('phone'); allowedKeys.add('website'); }
    if (requestedFields.includes('position')) { allowedKeys.add('position'); }
    if (requestedFields.includes('company')) { allowedKeys.add('company'); }
    if (requestedFields.includes('location')) { allowedKeys.add('address'); allowedKeys.add('location'); }
    if (requestedFields.includes('connections')) { allowedKeys.add('followers'); }
    if (requestedFields.includes('about')) { allowedKeys.add('about'); allowedKeys.add('headline'); }
    
    // activity/posts are kept by default if they were scraped based on activityType
    allowedKeys.add('activity'); 
    allowedKeys.add('socialLinks');

    for (const key of Object.keys(finalData)) {
       if (!allowedKeys.has(key)) delete finalData[key];
    }
  }

  process.stdout.write(`RESULT:${JSON.stringify(finalData)}\n`);
}

function checkCancel() {
  if (fs.existsSync(CANCEL_LOCK)) {
    emitLog('🛑 Arrêt demandé (Facebook).', 100);
    process.exit(0);
  }
}

const [, , argEmail, argPass, argQuery, argMax, argMaxPosts, argSearchType, argActivityType, argFields, argUserId] = process.argv;
const requestedFields = argFields ? argFields.split(',').map(s => s.trim()).filter(Boolean) : [];
const isPlatform = Boolean(argEmail);
const searchTypeFromInput = (t) => (t === 'pages' || t === 'company' || (t && t.toLowerCase() === 'entreprise')) ? 'pages' : 'people';

const CONFIG = {
  email: argEmail || '0326077824',
  password: argPass || '0326077824',
  searchQuery: argQuery || 'florencio randrianjafitahina',
  searchType: argSearchType ? searchTypeFromInput(argSearchType) : 'people',
  maxProfiles: parseInt(argMax, 10) || 1,
  maxPosts: parseInt(argMaxPosts, 10) || 10,
  activityType: (argActivityType === 'posts' || argActivityType === 'comments') ? argActivityType : 'all',
  outputFile: 'facebook-results.json',
  headless: false,
  delay: 2500,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function askQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function promptSearchType() {
  if (isPlatform) return;
  emitLog('\n┌─────────────────────────────────────┐');
  emitLog('│  Type de recherche Facebook          │');
  emitLog('│  1 → Personnes (profils individuels) │');
  emitLog('│  2 → Pages (entreprises, marques...) │');
  emitLog('└─────────────────────────────────────┘');
  const ans = await askQuestion('Votre choix [1/2] : ');
  CONFIG.searchType = ans === '2' ? 'pages' : 'people';
  emitLog(`\n✅ Mode : ${CONFIG.searchType === 'pages' ? 'Pages' : 'Personnes'}\n`);
}

async function login(page) {
  emitLog('🔐 Vérification de la session Facebook...');
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle', timeout: 45000 });
  await sleep(3000);

  // 1. Détection rapide de la session active
  if (page.url().includes('/feed') || page.url().includes('facebook.com/?')) {
    const hasNav = page.locator('[aria-label="Facebook"], [aria-label="Accueil"]');
    if (await hasNav.isVisible({ timeout: 5000 }).catch(() => false)) {
      emitLog('✅ Session déjà active — Utilisation du compte existant.\n');
      return;
    }
  }

  // 2. Gestion des bannières de consentement
  try {
    const consentTexts = ['Accepter tout', 'Accept all', 'Allow all cookies', 'Tout accepter', 'OK', 'Accepter'];
    const buttons = page.locator('button, [role="button"]');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const txt = (await btn.textContent().catch(() => '') || '').trim();
      if (txt && consentTexts.some(t => txt.toLowerCase().includes(t.toLowerCase()))) {
        await btn.click();
        emitLog(`   🍪 Banner GDPR fermé ("${txt}")`);
        await sleep(1500);
        break;
      }
    }
  } catch (_) { }

  emitLog('🔐 Navigation vers la page de connexion...');
  await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle', timeout: 45000 });
  await sleep(2500);

  // Check again after redirect
  if (page.url().includes('/feed')) {
    emitLog('✅ Connecté automatiquement !');
    return;
  }

  let emailSel = null;
  for (const sel of ['#email', 'input[name="email"]', 'input[type="email"]']) {
    if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) { emailSel = sel; break; }
  }

  if (!emailSel) {
    emitLog('   💡 Résolvez la connexion manuellement dans Chromium puis appuyez sur ENTRÉE ici...');
    await new Promise(r => process.stdin.once('data', r));
    if (page.url().includes('/feed')) return;
  } else {
    await page.locator(emailSel).first().fill(CONFIG.email);
    await sleep(400);

    let passSel = null;
    for (const sel of ['#pass', 'input[name="pass"]', 'input[type="password"]']) {
      if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) { passSel = sel; break; }
    }
    if (passSel) {
      await page.locator(passSel).first().fill(CONFIG.password);
      await sleep(400);
      
      let clicked = false;
      for (const sel of ['[name="login"]', 'button[type="submit"]', '#loginbutton', '[data-testid="royal_login_button"]']) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) { await btn.click(); clicked = true; break; }
      }
      if (!clicked) await page.keyboard.press('Enter');
    }
  }

  // 3. Boucle de détection de succès ou challenge
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const url = page.url();
    
    if (url.includes('checkpoint') || url.includes('two_step') || url.includes('recover') || url.includes('challenge')) {
      emitLog('PROGRESS: ⚠️ Vérification de sécurité Facebook (2FA/Captcha) — RÉSOLVEZ LE BLOCAGE MANUELLEMENT DANS CHROMIUM...');
      let solved = false;
      for (let j = 0; j < 300; j++) { // 5 minutes
        await sleep(1000);
        if (!page.url().includes('checkpoint') && !page.url().includes('two_step') && !page.url().includes('challenge')) {
          solved = true; break;
        }
      }
      if (!solved) { emitLog('ERROR: Délai dépassé pour la vérification Facebook.'); process.exit(1); }
      break;
    }

    if (url.includes('/feed') || url.includes('facebook.com/?') || url.includes('/search/')) break;
  }

  try {
    await page.evaluate(() => {
      document.querySelectorAll('[aria-label="Close"], [aria-label="Fermer"], [aria-label="Not Now"], [aria-label="Pas maintenant"]').forEach(b => b.click());
    });
    await sleep(800);
  } catch (_) { }

  emitLog(`✅ Connecté ! (${page.url().substring(0, 60)})\n`);
}

// ── Liste des profils / pages
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

// ── Photo de profil
async function scrapeProfilePhoto(page, profileUrl) {
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);
  await page.evaluate(() => window.scrollTo(0, 200));
  await sleep(800);

  const photo = await page.evaluate(() => {
    const mainZone = document.querySelector('[role="main"]')
      || document.querySelector('[data-pagelet="ProfileActions"]')
      || document.querySelector('[data-pagelet="ProfileTimeline"]')
      || document.body;

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

    for (const svg of Array.from(mainZone.querySelectorAll('svg'))) {
      for (const img of Array.from(svg.querySelectorAll('image'))) {
        const src = img.getAttribute('xlink:href') || img.getAttribute('href') || '';
        if (src && src.includes('fbcdn') && src.startsWith('http')) return src;
      }
    }

    const h1Name = mainZone.querySelector('h1')?.textContent?.trim()
      || document.querySelector('h1')?.textContent?.trim() || '';
    if (h1Name) {
      const byAlt = Array.from(mainZone.querySelectorAll('img[alt]')).find(img =>
        img.alt.trim() === h1Name && img.src?.includes('scontent')
      );
      if (byAlt) return byAlt.src;
    }

    for (const sel of [
      'a[aria-label*="photo de profil"] img',
      'a[aria-label*="profile picture"] img',
      'a[aria-label*="Profile picture"] img',
    ]) {
      const el = mainZone.querySelector(sel);
      if (el?.src?.includes('scontent')) return el.src;
    }

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

// ── Coordonnées
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

// ── Page principale du profil
async function scrapeMainProfile(page, profileUrl) {
  emitLog('   📄 Page principale...');

  const photo = await scrapeProfilePhoto(page, profileUrl);

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

  let contact = { email: '', phone: '', website: '' };
  const needsContact = requestedFields.length === 0 || requestedFields.includes('email') || requestedFields.includes('phone') || requestedFields.includes('website');
  if (needsContact) {
    contact = await scrapeContactInfo(page, profileUrl);
  } else {
    emitLog('   ⏩ Infos de contact (ignorées car non demandées)');
  }

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

// ── Compétences
async function scrapeSkills(page, profileUrl) {
  emitLog('   🎯 Compétences / Travail...');
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

// ── Activité (posts)
async function scrapeActivity(page, profileUrl) {
  emitLog('   📝 Activité...');
  const postsUrl = profileUrl.includes('profile.php')
    ? profileUrl + '&sk=timeline'
    : `${profileUrl.replace(/\/$/, '')}/posts`;

  await page.goto(postsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3500);

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

      const hasContent = el.querySelector(
        '[data-ad-comet-preview="message"], [data-testid="post_message"], a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid"]'
      );
      if (!hasContent) return;

      const authorEl = el.querySelector('h2 a, h3 a, [data-testid="story-subtitle"] a, strong a');
      const author = authorEl?.textContent?.trim() || '';

      const dateEl = el.querySelector('abbr[data-utime], a[href*="/posts/"] span, a[href*="/permalink/"] span, abbr');
      const date = dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || '';

      const textEl = el.querySelector('[data-ad-comet-preview="message"]')
        || el.querySelector('[data-testid="post_message"]')
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

// ── Commentaires
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
    emitLog(`  [${d.i}] ${d.label}`);
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
  const maxToEnrich = isPlatform ? 5 : 25;
  for (let idx = 0; idx < Math.min(rawComments.length, maxToEnrich); idx++) {
    const comment = rawComments[idx];
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
  for (let idx = maxToEnrich; idx < rawComments.length; idx++) {
    const c = rawComments[idx];
    enrichedComments.push({ date: c.date, myComment: c.myComment, originalPost: { author: c.originalPostAuthor, authorTitle: '', text: c.originalPostText, likes: c.originalPostLikes, comments: c.originalPostComments, url: c.originalPostUrl } });
  }
  return enrichedComments;
}

async function scrapeFullProfile(page, person) {
  emitLog(`\n📋 Scraping : ${person.name} (${person.profileUrl})`);
  const main = await scrapeMainProfile(page, person.profileUrl); await sleep(CONFIG.delay);
  
  const needsSkills = requestedFields.length === 0 || requestedFields.includes('skills') || requestedFields.includes('about');
  let skills = [];
  if (needsSkills) {
    skills = await scrapeSkills(page, person.profileUrl); await sleep(CONFIG.delay);
  } else {
    emitLog('   ⏩ Compétences (ignorées)');
  }
  let activity = [];
  let comments = [];

  if (CONFIG.activityType === 'posts' || CONFIG.activityType === 'all') {
    activity = await scrapeActivity(page, person.profileUrl); await sleep(CONFIG.delay);
  }
  if (CONFIG.activityType === 'comments' || CONFIG.activityType === 'all') {
    comments = await scrapeComments(page, person.profileUrl); await sleep(CONFIG.delay);
  }

  emitLog(`   → ${skills.length} compétences | ${activity.length} activités | ${comments.length} commentaires`);
  return { ...person, ...main, skills, activity: { posts: activity, comments } };
}

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
      const textEl = el.querySelector('[data-ad-comet-preview="message"], [data-testid="post_message"], [dir="auto"] > div > span');
      const text = getText(textEl || el.querySelector('[dir="auto"]')).substring(0, 1000);
      const likes = el.querySelector('[aria-label*="reaction"], [aria-label*="réaction"]')?.textContent?.trim() || '0';
      const comments = el.querySelector('[aria-label*="comment"], [aria-label*="commentaire"]')?.textContent?.trim() || '0';
      let postUrl = '';
      el.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"]').forEach(a => { if (!postUrl) postUrl = (a.href || '').split('?')[0]; });
      if (text.length > 3) results.push({ author, authorTitle, date, text, likes, comments, postUrl });
    });
    return results;
  }, CONFIG.maxPosts);

  emitLog(`📝 ${posts.length} posts trouvés`);
  return posts;
}

function buildProspectPayload(full, person, index) {
  return {
    id: `fb_${Date.now()}_${index}`,
    name: full.name || person.name,
    initials: (full.name || person.name)?.[0]?.toUpperCase() || 'F',
    position: full.headline || person.title || '',
    company: full.headline || person.title || '',
    source_platform: CONFIG.searchType === 'pages' ? 'facebook_page' : 'facebook',
    source: CONFIG.searchType === 'pages' ? 'facebook_page' : 'facebook',
    score: 60,
    email: full.email || '',
    phone: full.phone || '',
    website: full.website || '',
    photo: full.photo || person.photo || '',
    address: full.location || '',
    about: full.about || '',
    headline: full.headline || '',
    followers: full.followers || '',
    // ── Activité au niveau racine ──
    activity: {
      posts: full.activity?.posts || [],
      comments: full.activity?.comments || [],
    },
    tags: full.skills?.slice(0, 5).map(s => s.name) || [],
    socialLinks: { facebook: full.profileUrl || person.profileUrl || '' },
    contractDetails: {
      about: full.about || '',
      headline: full.headline || '',
      location: full.location || '',
      followers: full.followers || '',
      experiences: full.experiences || [],
      education: full.education || [],
      certifications: full.certifications || [],
      skills: full.skills || [],
      photo: full.photo || '',
      activity: {
        posts: full.activity?.posts || [],
        comments: full.activity?.comments || [],
      },
    },
    aiIntelligence: {
      activities: {
        posts: full.activity?.posts || [],
        comments: full.activity?.comments || [],
      },
      contactInfo: {
        phones: full.phone ? [full.phone] : [],
        emails: full.email ? [full.email] : [],
        addresses: full.location ? [full.location] : []
      },
    },
  };
}

async function main() {
  emitLog('🚀 Facebook Scraper — Playwright\n');
  if (isPlatform) {
    emitLog(`[Plateforme] Query="${CONFIG.searchQuery}" | Max=${CONFIG.maxProfiles} | Type=${CONFIG.searchType} | Activity=${CONFIG.activityType}`);
  } else {
    await promptSearchType();
  }

  const userDataDir = path.join(process.cwd(), '.prospecta-sessions', 'facebook');
  
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: CONFIG.headless,
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    args: ['--lang=fr-FR', '--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });


  try {
    await login(page);
    checkCancel();

    emitLog(`── PHASE : SCRAPING ${CONFIG.searchType === 'pages' ? 'PAGES' : 'PERSONNES'} ─────────────────────────────────────────`);

    const people = await scrapePersonList(page);
    const profiles = [];
    const total = Math.min(people.length, CONFIG.maxProfiles);

    for (let i = 0; i < total; i++) {
      checkCancel();
      const pct = 5 + Math.round(((i + 1) / total) * 75);
      emitLog(`Extraction ${i + 1}/${total}: ${people[i].name}`, pct);

      try {
        const full = await scrapeFullProfile(page, people[i]);
        profiles.push(full);

        const prospectPayload = buildProspectPayload(full, people[i], i);
        emitResult(prospectPayload);

        // ── Enrichissement site officiel ──────────────────────────────────────
        if (prospectPayload.website && isOfficialSite(prospectPayload.website)) {
          try {
            emitLog(`      🌐 Enrichissement site : ${prospectPayload.website}`);
            const ep = await context.newPage();
            try {
              const siteData = await scrapeOfficialSite(ep, { url: prospectPayload.website, name: prospectPayload.name, userId: argUserId || null }, { visitContactPage: false, emitLog });
              if (!siteData.loadError) {
                prospectPayload.siteEnrichment = siteData;
                const contacts = siteData.contacts || {};
                if (contacts.emails?.length) prospectPayload.email = [...new Set([prospectPayload.email, ...contacts.emails])].filter(Boolean).join(', ') || prospectPayload.email;
                if (contacts.phones?.length) prospectPayload.phone = [...new Set([prospectPayload.phone, ...contacts.phones])].filter(Boolean).join(', ') || prospectPayload.phone;
                if (contacts.whatsapp?.length) prospectPayload.whatsapp = contacts.whatsapp.join(', ');
                
                if (siteData.socials) {
                  prospectPayload.socialLinks = { 
                    ...prospectPayload.socialLinks, 
                    ...Object.fromEntries(Object.entries(siteData.socials).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) 
                  };
                }
                if (siteData.technologies) prospectPayload.technologies = siteData.technologies;
                if (siteData.team?.length) prospectPayload.team = siteData.team;
                if (siteData.services) prospectPayload.services_detail = siteData.services;
                if (siteData.reputation) prospectPayload.website_reputation = siteData.reputation;
                if (siteData.forms) prospectPayload.contact_forms = siteData.forms;
                
                // Re-emit updated result
                emitResult(prospectPayload);
              }
            } finally { await ep.close(); }
          } catch (se) { emitLog(`   ⚠️  Site enrichment: ${se.message}`); }
        }

        emitLog(`\n✅ ${full.name} | 📌 ${full.headline || ''}`);
        if (full.photo) emitLog(`   🖼️  ${full.photo.substring(0, 80)}...`);
        if (full.email) emitLog(`   📧 ${full.email}`);
        if (full.about) emitLog(`   ℹ️  ${full.about.substring(0, 120)}...`);
        if (full.experiences?.length) full.experiences.forEach(e => emitLog(`   💼 ${e.role} @ ${e.company}`));
        if (full.skills?.length) emitLog(`   🎯 ${full.skills.map(s => s.name).join(', ')}`);
      } catch (err) {
        emitLog(`   ❌ ${err.message}`);
        const fallbackPayload = {
          id: `fb_${Date.now()}_${i}_err`,
          name: people[i].name,
          source_platform: CONFIG.searchType === 'pages' ? 'facebook_page' : 'facebook',
          socialLinks: { facebook: people[i].profileUrl || '' },
        };
        emitResult(fallbackPayload);
        profiles.push(people[i]);
      }
      await sleep(CONFIG.delay);
    }

    const searchPosts = await scrapeSearchPosts(page);

    fs.writeFileSync(CONFIG.outputFile, JSON.stringify({
      scrapedAt: new Date().toISOString(),
      query: CONFIG.searchQuery,
      searchType: CONFIG.searchType,
      summary: {
        profiles: profiles.length,
        totalSkills: profiles.reduce((s, p) => s + (p.skills?.length || 0), 0),
        totalPosts: profiles.reduce((s, p) => s + (p.activity?.posts?.length || 0), 0),
        totalComments: profiles.reduce((s, p) => s + (p.activity?.comments?.length || 0), 0),
        searchPosts: searchPosts.length,
      },
      profiles,
      searchPosts,
    }, null, 2), 'utf8');

    emitLog(`\n💾 Sauvegardé → ${CONFIG.outputFile}`);

  } finally {
    await context.close();
    emitLog('\n🏁 Session terminée.');
  }
}

main().catch(console.error);
