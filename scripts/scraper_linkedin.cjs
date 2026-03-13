const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

function emitLog(msg, pct = undefined) {
  console.log(msg);
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}

const [,, argEmail, argPass, argQuery, argMax, argMaxPosts, argSearchType, argActivityType] = process.argv;

const CONFIG = {
  email: argEmail || 'yurihandria@gmail.com',
  password: argPass || 'Flo0320790153Cio',
  searchQuery: argQuery || 'florencio randrianjafitahina',
  searchType: (argSearchType === 'companies' || argSearchType === 'company') ? 'companies' : 'people',
  maxProfiles: parseInt(argMax, 10) || 10,
  maxPosts: parseInt(argMaxPosts, 10) || 30,
  activityType: (argActivityType === 'posts' || argActivityType === 'comments') ? argActivityType : 'all',
  outputFile: 'linkedin-results.json',
  headless: false,
  delay: 2500,
};

emitLog(`🚀 LinkedIn Scraper — mode complet\n`);
if (argEmail) {
  emitLog(`[LinkedIn Scraper] Configuration active : Query="${CONFIG.searchQuery}", Max=${CONFIG.maxProfiles}, Type=${CONFIG.searchType}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function askQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function promptSearchType() {
  emitLog('\n┌──────────────────────────────────────────┐');
  emitLog('│  Type de recherche LinkedIn               │');
  emitLog('│  1 → Personnes (profils individuels)     │');
  emitLog('│  2 → Entreprises (pages d\'entreprise)    │');
  emitLog('└──────────────────────────────────────────┘');
  const ans = await askQuestion('Votre choix [1/2] : ');
  CONFIG.searchType = ans === '2' ? 'companies' : 'people';
  emitLog(`\n✅ Mode : ${CONFIG.searchType === 'companies' ? 'Entreprises' : 'Personnes'}\n`);
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function login(page) {
  emitLog('🔐 Connexion à LinkedIn...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.fill('#username', CONFIG.email);
  await sleep(400);
  await page.fill('#password', CONFIG.password);
  await sleep(400);

  try {
    const keepLoggedCheckbox = await page.$('#rememberMeOptIn-checkbox');
    if (keepLoggedCheckbox) {
      const isChecked = await keepLoggedCheckbox.isChecked();
      if (isChecked) {
        const labelText = await page.$('[for="rememberMeOptIn-checkbox"]');
        if (labelText) await labelText.click();
        await sleep(400);
      }
    }
  } catch (e) {}

  await page.click('[type="submit"]');

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const url = page.url();
    const hasError = await page.evaluate(() => {
      const errEl = document.querySelector('#error-for-password, #error-for-username, .alert-error, [data-test-id="password-login-error"]');
      return errEl ? errEl.innerText.trim() : null;
    });
    if (hasError) { emitLog(`ERROR: Identifiants LinkedIn invalides : ${hasError}`); process.exit(1); }
    if (!url.includes('/login') && !url.includes('/uas/')) break;
  }

  const afterSubmitUrl = page.url();
  if (afterSubmitUrl.includes('checkpoint') || afterSubmitUrl.includes('challenge')) {
    if (CONFIG.headless) {
      emitLog('ERROR: Vérification de sécurité LinkedIn requise. Connexion automatique impossible.');
      process.exit(1);
    } else {
      emitLog('PROGRESS: ⚠️ Vérification de sécurité requise — Résolvez le Captcha/2FA dans Chromium...');
      let isChallenged = true;
      for (let i = 0; i < 300; i++) {
        await sleep(1000);
        const currentUrl = page.url();
        if (!currentUrl.includes('checkpoint') && !currentUrl.includes('challenge') && !currentUrl.includes('/uas/')) {
          isChallenged = false; break;
        }
      }
      if (isChallenged) { emitLog('ERROR: Délai dépassé pour la vérification de sécurité.'); process.exit(1); }
    }
  }
  emitLog('✅ Connecté avec succès !\n');
}

// ── Recherche initiale avec PAGINATION ────────────────────────────────────────
async function scrapePersonList(page) {
  const endpoint = CONFIG.searchType === 'companies' ? 'companies' : 'people';
  const allPeople = [];
  let currentPage = 1;
  const maxPages = Math.ceil(CONFIG.maxProfiles / 10) + 2; 

  while (allPeople.length < CONFIG.maxProfiles && currentPage <= maxPages) {
    const url = `https://www.linkedin.com/search/results/${endpoint}/?keywords=${encodeURIComponent(CONFIG.searchQuery)}&page=${currentPage}`;
    emitLog(`\n🔍 Recherche ${CONFIG.searchType === 'companies' ? 'Entreprises' : 'Personnes'} (Page ${currentPage}) : ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(4000);
    for (let i = 0; i < 6; i++) { await page.evaluate(() => window.scrollBy(0, 800)); await sleep(1000); }

    const people = await page.evaluate((searchType) => {
      const linkSel = searchType === 'companies' ? 'a[href*="/company/"]' : 'a[href*="/in/"]';
      let cards = document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]');
      if (!cards.length) cards = document.querySelectorAll('.reusable-search__result-container, li.reusable-search__result-container');
      if (!cards.length) cards = document.querySelectorAll('ul.reusable-search__entity-result-list > li, .search-results-container ul > li');
      if (!cards.length) {
        return Array.from(document.querySelectorAll(linkSel)).map(a => ({
          name: a.querySelector('span[aria-hidden="true"]')?.textContent?.trim() || a.textContent?.trim()?.substring(0, 60) || '',
          title: '', profileUrl: a.href?.split('?')[0] || '', photo: '',
        })).filter(p => p.name && p.profileUrl && !p.profileUrl.includes('undefined'));
      }
      return Array.from(cards).map(card => {
        const linkEl = card.querySelector(linkSel);
        if (!linkEl) return null;
        const name = linkEl.querySelector('span[aria-hidden="true"]')?.textContent?.trim() || linkEl.textContent?.trim()?.substring(0, 60) || '';
        const allText = Array.from(card.querySelectorAll('span[aria-hidden="true"]')).map(s => s.textContent?.trim()).filter(t => t && t.length > 2 && t !== name);
        return { name, title: allText[0] || '', location: allText[1] || '', profileUrl: linkEl.href?.split('?')[0] || '', photo: card.querySelector('img')?.src || '' };
      }).filter(p => p && p.name && p.profileUrl && !p.profileUrl.includes('undefined'));
    }, CONFIG.searchType);

    if (people.length === 0) break;

    for (const p of people) {
      if (!allPeople.some(x => x.profileUrl === p.profileUrl)) {
        allPeople.push(p);
        if (allPeople.length >= CONFIG.maxProfiles) break;
      }
    }
    currentPage++;
    await sleep(2000);
  }

  const label = CONFIG.searchType === 'companies' ? 'entreprises' : 'profils';
  emitLog(`\n👥 ${allPeople.length} ${label} extraits de la recherche`);
  allPeople.forEach(p => emitLog(`   • ${p.name} — ${p.title} (${p.profileUrl})`));
  return allPeople;
}

// ── Contact Info ──────────────────────────────────────────────────────────────
async function scrapeContactInfo(page) {
  let email = '', phone = '', website = '';
  try {
    const contactBtn = page.locator('a[href*="overlay/contact-info"]');
    if (!await contactBtn.isVisible({ timeout: 3000 }).catch(() => false)) return { email, phone, website };
    await contactBtn.click();
    await sleep(2000);
    const data = await page.evaluate(() => {
      const result = { email: '', phone: '', website: '' };
      const modal = document.querySelector('.artdeco-modal__content') || document.body;
      const emailMatch = modal.innerHTML.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) result.email = emailMatch[0];
      modal.querySelectorAll('section').forEach(sec => {
        const h = sec.querySelector('h3')?.textContent?.toLowerCase() || '';
        if (h.includes('phone') || h.includes('téléphone')) result.phone = sec.querySelector('span.t-14')?.textContent?.trim() || '';
        if (h.includes('site') || h.includes('website')) result.website = sec.querySelector('a')?.href || '';
      });
      return result;
    });
    email = data.email; phone = data.phone; website = data.website;
    const closeBtn = page.locator('button[aria-label="Ignorer"], button[aria-label="Dismiss"], .artdeco-modal__dismiss').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) { await closeBtn.click(); await sleep(500); }
  } catch (_) {}
  return { email, phone, website };
}

// ── Page principale du profil ─────────────────────────────────────────────────
async function scrapeMainProfile(page, profileUrl) {
  emitLog('   📄 Page principale...');
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  for (let i = 0; i < 10; i++) { await page.evaluate(() => window.scrollBy(0, 500)); await sleep(400); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);
  try {
    await page.evaluate(() => {
      document.querySelectorAll('button.inline-show-more-text__button, button[aria-label*="voir plus"], button[aria-label*="show more"]').forEach(b => b.click());
    });
    await sleep(500);
  } catch (_) {}

  const contact = await scrapeContactInfo(page);

  const data = await page.evaluate(() => {
    function getText(el) {
      if (!el) return '';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = []; let n;
      while ((n = w.nextNode())) { const t = n.textContent?.trim(); if (t && t !== '…voir plus' && t !== 'voir plus') parts.push(t); }
      return parts.join(' ').trim();
    }
    const name = document.querySelector('h1.text-heading-xlarge, h1')?.textContent?.trim() || '';
    const headline = document.querySelector('.text-body-medium.break-words')?.textContent?.trim() || '';
    let photo = '';
    const photoSelectors = ['.pv-top-card__photo-wrapper img', '.profile-photo-edit__preview', 'img.pv-top-card-profile-picture__image--show', '.pv-top-card-profile-picture__image', '.ph5 img[src*="licdn"]', '.pv-top-card img[src*="licdn"]', 'section.artdeco-card img[src*="licdn"]', 'img[data-delayed-url*="profile-display"]', '.profile-picture img', 'button[aria-label*="photo"] img'];
    for (const sel of photoSelectors) {
      const img = document.querySelector(sel);
      if (img?.src && img.src.includes('licdn')) { photo = img.src; break; }
      if (img?.getAttribute('data-delayed-url')) { photo = img.getAttribute('data-delayed-url'); break; }
    }
    if (!photo) { let best = null, bestSize = 0; document.querySelectorAll('img[src*="licdn"]').forEach(img => { const src = img.src || ''; if (src.includes('profile-display') || src.includes('shrink_200') || src.includes('shrink_400')) { const size = (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0); if (size > bestSize) { best = img; bestSize = size; } } }); if (best) photo = best.src; }
    let location = '';
    document.querySelectorAll('.pv-text-details__left-panel span, .mt2 span, .ph5 span').forEach(sp => { const t = sp.textContent?.trim() || ''; if (!location && t.length > 5 && !t.match(/^[·•\d]/) && !t.includes('relation') && !t.includes('niveau') && !t.includes('Founder') && !t.includes('CEO')) location = t; });
    let followers = ''; const follMatch = document.body.innerText.match(/([\d\s,]+)\s*abonnés?/i); if (follMatch) followers = follMatch[0].trim();
    let about = ''; const aboutSection = document.querySelector('#about')?.closest('section'); if (aboutSection) { const clone = aboutSection.cloneNode(true); clone.querySelectorAll('button').forEach(b => b.remove()); about = getText(clone).substring(0, 3000); }
    const experiences = []; const expSection = document.querySelector('#experience')?.closest('section');
    if (expSection) { expSection.querySelectorAll('ul > li.artdeco-list__item').forEach(item => { const boldSpans = Array.from(item.querySelectorAll('.t-bold span[aria-hidden="true"]')).map(s => s.textContent.trim()).filter(Boolean); const normSpans = Array.from(item.querySelectorAll('.t-14.t-normal:not(.t-black--light) span[aria-hidden="true"]')).map(s => s.textContent.trim()).filter(Boolean); const lightSpans = Array.from(item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]')).map(s => s.textContent.trim()).filter(Boolean); let role = '', company = '', duration = '', loc = ''; if (boldSpans.length >= 2) { company = boldSpans[0]; role = boldSpans[1]; duration = lightSpans[0] || ''; loc = lightSpans[1] || ''; } else { role = boldSpans[0] || ''; company = normSpans[0] || ''; duration = lightSpans[0] || ''; loc = lightSpans[1] || ''; } if (role && role.length < 150 && !role.match(/^\d/) && !role.includes('Découvrir')) experiences.push({ role, company, duration, location: loc, description: '' }); }); }
    const education = []; const eduSection = document.querySelector('#education')?.closest('section'); if (eduSection) { eduSection.querySelectorAll('ul > li.artdeco-list__item').forEach(item => { const school = item.querySelector('.t-bold span[aria-hidden="true"]')?.textContent?.trim() || ''; const degree = item.querySelector('.t-14.t-normal:not(.t-black--light) span[aria-hidden="true"]')?.textContent?.trim() || ''; const years = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]')?.textContent?.trim() || ''; if (school) education.push({ school, degree, years }); }); }
    const certifications = []; const certSection = document.querySelector('#licenses_and_certifications, #certifications')?.closest('section'); if (certSection) { certSection.querySelectorAll('ul > li.artdeco-list__item').forEach(item => { const name = item.querySelector('.t-bold span[aria-hidden="true"]')?.textContent?.trim() || ''; const issuer = item.querySelector('.t-14.t-normal:not(.t-black--light) span[aria-hidden="true"]')?.textContent?.trim() || ''; const date = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]')?.textContent?.trim() || ''; if (name) certifications.push({ name, issuer, date }); }); }
    const recommendations = []; const recSection = document.querySelector('#recommendations')?.closest('section'); if (recSection) { recSection.querySelectorAll('ul > li').forEach(item => { const from = item.querySelector('.t-bold span[aria-hidden="true"]')?.textContent?.trim() || ''; const role = item.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.textContent?.trim() || ''; if (from && !from.match(/^\d+e/)) recommendations.push({ from, role, text: '' }); }); }
    return { name, headline, photo, location, followers, about, experiences, education, certifications, recommendations };
  });

  if (data.photo) emitLog(`   🖼️  Photo: ${data.photo.substring(0, 80)}...`);
  else emitLog('   🖼️  Photo: non trouvée');
  return { ...data, ...contact };
}

// ── Compétences ───────────────────────────────────────────────────────────────
async function scrapeSkills(page, profileUrl) {
  emitLog('   🎯 Compétences...');
  await page.goto(`${profileUrl}/details/skills/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.scrollBy(0, 600)); await sleep(500); }

  return await page.evaluate(() => {
    const skills = [];
    document.querySelectorAll('.artdeco-list__item, li.pvs-list__item--line-separated').forEach(item => {
      const name = item.querySelector('.t-bold span[aria-hidden="true"]')?.textContent?.trim() || '';
      let endorsements = '';
      item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]').forEach(el => {
        if (el.textContent.includes('recommandation')) endorsements = el.textContent.trim();
      });
      const bad = !name || name.length > 80 || name.length < 2
        || name.includes('recommandation') || name.includes('personne')
        || name.includes('mois') || name.includes('interpersonnelles')
        || name.includes('secteur') || name === 'Tout'
        || name.match(/·\s*\de/) || item.querySelector('a[href*="/in/"]');
      if (!bad) skills.push({ name, endorsements });
    });
    return [...new Map(skills.map(s => [s.name, s])).values()];
  });
}

// ── Activité (posts) ──────────────────────────────────────────────────────────
async function scrapeActivity(page, profileUrl) {
  emitLog('   📝 Activité...');
  await page.goto(`${profileUrl}/recent-activity/all/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  for (let i = 0; i < 8; i++) { await page.evaluate(() => window.scrollBy(0, 900)); await sleep(1200); }

  return await page.evaluate((max) => {
    function getText(el) {
      if (!el) return '';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = []; let n;
      while ((n = w.nextNode())) { const t = n.textContent?.trim(); if (t) parts.push(t); }
      return parts.join(' ').trim();
    }
    const results = [];
    const seen = new Set();
    document.querySelectorAll('[data-urn], .feed-shared-update-v2').forEach(el => {
      if (results.length >= max) return;
      const urn = el.getAttribute('data-urn') || el.getAttribute('data-id') || '';
      if (seen.has(urn) && urn) return;
      if (urn) seen.add(urn);
      const actionType = el.querySelector('.update-components-header__text-wrapper span[aria-hidden="true"]')?.textContent?.trim() || 'Post';
      const author = el.querySelector('.update-components-actor__name span[aria-hidden="true"]')?.textContent?.trim() || '';
      const date = el.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]')?.textContent?.trim() || '';
      const text = getText(el.querySelector('.update-components-text, .feed-shared-text'));
      const likes = el.querySelector('.social-details-social-counts__reactions-count')?.textContent?.trim() || '0';
      const comments = el.querySelector('.social-details-social-counts__comments a, .social-details-social-counts__comments span')?.textContent?.trim() || '0';
      const shares = el.querySelector('[aria-label*="reposts"], [aria-label*="partage"]')?.textContent?.trim() || '0';
      const postUrl = el.querySelector('a[href*="/posts/"], a[href*="/feed/update/"]')?.href?.split('?')[0] || '';
      const image = el.querySelector('.update-components-image__image, .feed-shared-image img')?.src || '';
      const mini = el.querySelector('.update-components-mini-update-v2, .feed-shared-mini-update-v2');
      let originalPost = null;
      if (mini) {
        originalPost = {
          author: mini.querySelector('.update-components-actor__name span[aria-hidden="true"]')?.textContent?.trim() || '',
          text: getText(mini.querySelector('.update-components-text, .feed-shared-text') || mini).substring(0, 600),
          url: mini.querySelector('a[href*="/posts/"], a[href*="/feed/"]')?.href?.split('?')[0] || '',
        };
      }
      if (text.length > 2 || (originalPost?.text?.length > 2))
        results.push({ actionType, author, date, text: text.substring(0, 1500), image, likes, comments, shares, postUrl, originalPost });
    });
    return results;
  }, CONFIG.maxPosts);
}

// ── Commentaires ─────────────────────────────────────────────────────────────
async function scrapeComments(page, profileUrl) {
  emitLog('   💬 Commentaires...');
  await page.goto(`${profileUrl}/recent-activity/comments/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.scrollBy(0, 900)); await sleep(1200); }

  // ── ÉTAPE 1 : Dump DOM diagnostic ────────────────────────────────────────
  const domDump = await page.evaluate(() => {
    function safeClass(el) {
      if (!el || !el.className) return '';
      if (typeof el.className === 'string') return el.className.substring(0, 80);
      if (el.className.baseVal !== undefined) return String(el.className.baseVal).substring(0, 80);
      return '';
    }
    function getText(el) {
      if (!el) return '';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = []; let n;
      while ((n = w.nextNode())) { const t = n.textContent?.trim(); if (t) parts.push(t); }
      return parts.join(' ').trim().substring(0, 150);
    }
    const roots = Array.from(document.querySelectorAll('[data-urn]')).filter(el => !el.parentElement?.closest('[data-urn]'));
    return roots.slice(0, 4).map((el, i) => ({
      i,
      urn: (el.getAttribute('data-urn') || '').substring(0, 70),
      spans: Array.from(el.querySelectorAll('span[aria-hidden="true"]')).map(s => s.textContent?.trim()).filter(Boolean).slice(0, 8),
      links: Array.from(el.querySelectorAll('a[href]')).map(a => (a.href || '').substring(0, 120)).filter(h => h.includes('/feed/') || h.includes('/posts/')).slice(0, 4),
      commentClasses: [...new Set(Array.from(el.querySelectorAll('*')).map(c => safeClass(c)).filter(c => c.includes('comment')))].slice(0, 6),
    }));
  });

  emitLog('\n🔬 DOM /recent-activity/comments/ :');
  domDump.forEach(d => {
    emitLog(`\n  [${d.i}] ${d.urn}`);
    emitLog(`       spans: ${JSON.stringify(d.spans)}`);
    emitLog(`       links: ${JSON.stringify(d.links)}`);
    emitLog(`       commentClasses: ${JSON.stringify(d.commentClasses)}`);
  });

  // ── ÉTAPE 2 : Extraction depuis la page /comments/ ────────────────────────
  const rawComments = await page.evaluate((max) => {
    function getText(el) {
      if (!el) return '';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = []; let n;
      while ((n = w.nextNode())) {
        const t = n.textContent?.trim();
        if (t && t !== '…voir plus' && t !== 'voir plus' && t !== 'see more' && t !== '···') parts.push(t);
      }
      return parts.join(' ').trim();
    }
    const results = [];
    const seen = new Set();
    const roots = Array.from(document.querySelectorAll('[data-urn]')).filter(el => !el.parentElement?.closest('[data-urn]'));

    roots.forEach(el => {
      if (results.length >= max) return;
      const urn = el.getAttribute('data-urn') || '';
      if (seen.has(urn) && urn) return;
      if (urn) seen.add(urn);

      // Auteur du post original
      const originalPostAuthor =
        el.querySelector('.update-components-actor__single-line-truncate span[aria-hidden="true"]')?.textContent?.trim()
        || el.querySelector('.update-components-actor__name span[aria-hidden="true"]')?.textContent?.trim()
        || '';
      const originalPostAuthorTitle =
        el.querySelector('.update-components-actor__description span[aria-hidden="true"]')?.textContent?.trim() || '';
      const date =
        el.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]')?.textContent?.trim() || '';

      // Texte du post original
      const postTextEl =
        el.querySelector('.update-components-text.update-components-update-v2__commentary')
        || el.querySelector('.update-components-update-v2__commentary')
        || el.querySelector('.update-components-text')
        || el.querySelector('.feed-shared-update-v2__description')
        || el.querySelector('.feed-shared-text');
      const originalPostText = postTextEl ? getText(postTextEl).substring(0, 1200) : '';

      // Stats
      const originalPostLikes = el.querySelector('.social-details-social-counts__reactions-count')?.textContent?.trim() || '';
      const originalPostComments = el.querySelector(
        '.social-details-social-counts__comments a, .social-details-social-counts__comments span'
      )?.textContent?.trim() || '';

      // URL du post — lien direct ou reconstruit depuis l'URN
      let originalPostUrl = '';
      for (const a of el.querySelectorAll('a[href]')) {
        const h = a.href || '';
        if (h.includes('/feed/update/') || h.includes('/posts/')) { originalPostUrl = h.split('?')[0]; break; }
      }
      if (!originalPostUrl && urn) {
        const m1 = urn.match(/urn:li:ugcPost:(\d+)/);
        const m2 = urn.match(/urn:li:activity:(\d+)/);
        const m3 = urn.match(/urn:li:share:(\d+)/);
        if (m1) originalPostUrl = `https://www.linkedin.com/feed/update/urn:li:ugcPost:${m1[1]}/`;
        else if (m2) originalPostUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${m2[1]}/`;
        else if (m3) originalPostUrl = `https://www.linkedin.com/feed/update/urn:li:share:${m3[1]}/`;
      }

      // Commentaire de l'utilisateur (dans le bloc si visible)
      let myCommentText = '';
      el.querySelectorAll('.comments-comment-item, [class*="comment-item"]').forEach(item => {
        if (!myCommentText) {
          const t = getText(item.querySelector('.comments-comment-item__main-content') || item.querySelector('.t-14') || item);
          if (t.length > 5) myCommentText = t.substring(0, 800);
        }
      });

      results.push({ date, myComment: myCommentText, originalPostUrl, originalPostAuthor, originalPostAuthorTitle, originalPostText, originalPostLikes, originalPostComments, urn });
    });
    return results;
  }, 25);

  emitLog(`\n   📊 ${rawComments.length} posts-commentés extraits`);
  rawComments.forEach((c, i) => console.log(
    `   [${i}] author:"${c.originalPostAuthor}" | url:"${c.originalPostUrl.substring(0, 55)}" | text:${c.originalPostText.length}c`
  ));

  // ── ÉTAPE 3 : Navigation vers chaque post ────────────────────────────────
  const enrichedComments = [];

  for (const comment of rawComments) {
    let originalPost = {
      author: comment.originalPostAuthor,
      authorTitle: comment.originalPostAuthorTitle,
      text: comment.originalPostText,
      likes: comment.originalPostLikes,
      comments: comment.originalPostComments,
      url: comment.originalPostUrl,
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
            document.querySelectorAll(
              'button.inline-show-more-text__button, button[aria-label*="voir plus"], button[aria-label*="show more"], button[aria-label*="see more"], .feed-shared-inline-show-more-text__see-more-less-toggle'
            ).forEach(b => b.click());
          });
          await sleep(500);
        } catch (_) { }

        const postData = await page.evaluate(() => {
          function getText(el) {
            if (!el) return '';
            const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const parts = []; let n;
            while ((n = w.nextNode())) {
              const t = n.textContent?.trim();
              if (t && t !== '…voir plus' && t !== 'voir plus' && t !== 'see more' && t !== '···') parts.push(t);
            }
            return parts.join(' ').trim();
          }

          // Trouver le bloc post principal
          let postEl = null;
          for (const el of Array.from(document.querySelectorAll('[data-urn]')).filter(e => !e.parentElement?.closest('[data-urn]'))) {
            for (const sel of ['.update-components-text.update-components-update-v2__commentary', '.update-components-update-v2__commentary', '.update-components-text', '.feed-shared-text']) {
              if (getText(el.querySelector(sel)).length > 30) { postEl = el; break; }
            }
            if (postEl) break;
          }

          const author =
            postEl?.querySelector('.update-components-actor__single-line-truncate span[aria-hidden="true"]')?.textContent?.trim()
            || postEl?.querySelector('.update-components-actor__name span[aria-hidden="true"]')?.textContent?.trim()
            || document.querySelector('.update-components-actor__name span[aria-hidden="true"]')?.textContent?.trim()
            || '';
          const authorTitle =
            postEl?.querySelector('.update-components-actor__description span[aria-hidden="true"]')?.textContent?.trim()
            || document.querySelector('.update-components-actor__description span[aria-hidden="true"]')?.textContent?.trim()
            || '';

          let text = '';
          for (const sel of ['.update-components-text.update-components-update-v2__commentary', '.update-components-update-v2__commentary', '.update-components-text', '.feed-shared-text', '.feed-shared-update-v2__description']) {
            const el = (postEl || document).querySelector(sel);
            if (el) { text = getText(el); if (text.length > 20) break; }
          }

          const likes = (postEl || document).querySelector('.social-details-social-counts__reactions-count')?.textContent?.trim() || '';
          const commentsCount = (postEl || document).querySelector(
            '.social-details-social-counts__comments a, .social-details-social-counts__comments span'
          )?.textContent?.trim() || '';

          // Commentaire de l'utilisateur
          let myCommentText = '';
          document.querySelectorAll('.comments-comment-item, .comments-comment-thread__comment').forEach(item => {
            if (myCommentText) return;
            const commentTextEl =
              item.querySelector('.comments-comment-item__main-content')
              || item.querySelector('.feed-shared-inline-show-more-text')
              || item.querySelector('.t-14.t-normal.t-black');
            const t = getText(commentTextEl || item);
            if (t.length > 10) myCommentText = t.substring(0, 1000);
          });

          return { author, authorTitle, text, likes, comments: commentsCount, myCommentText };
        });

        originalPost = {
          author: postData.author || comment.originalPostAuthor,
          authorTitle: postData.authorTitle || comment.originalPostAuthorTitle,
          text: postData.text.length > comment.originalPostText.length ? postData.text : comment.originalPostText,
          likes: postData.likes || comment.originalPostLikes,
          comments: postData.comments || comment.originalPostComments,
          url: comment.originalPostUrl,
        };
        if (postData.myCommentText && postData.myCommentText.length > myComment.length) myComment = postData.myCommentText;

        emitLog(`      ✅ author:"${originalPost.author}" | post:${originalPost.text.length}c | comment:${myComment.length}c | 👍${originalPost.likes}`);
      } catch (err) {
        emitLog(`      ⚠️  ${err.message}`);
      }
      await sleep(1800);
    }

    enrichedComments.push({ date: comment.date, myComment, originalPost });
  }

  return enrichedComments;
}

// ── Page entreprise ───────────────────────────────────────────────────────────
async function scrapeCompanyProfile(page, companyUrl) {
  emitLog('   🏢 Page entreprise (page principale)...');
  await page.goto(companyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  for (let i = 0; i < 8; i++) { await page.evaluate(() => window.scrollBy(0, 500)); await sleep(400); }

  const data = await page.evaluate(() => {
    return {
      name: document.querySelector('h1')?.textContent?.trim() || '',
      tagline: document.querySelector('.org-top-card-summary__tagline, .org-top-card-primary-content__tagline')?.textContent?.trim() || '',
      industry: document.querySelector('.org-top-card-summary__industry, .org-top-card-summary-info-list__info-item')?.textContent?.trim() || '',
      location: document.querySelector('.org-top-card-summary__headquarter, .org-top-card-summary-info-list__info-item:last-child')?.textContent?.trim() || '',
      followers: document.querySelector('.org-top-card-summary__follower-count')?.textContent?.trim() || '',
      photo: document.querySelector('.org-top-card-primary-content__logo img, .org-top-card__logo img')?.src || '',
      about: document.querySelector('.org-about-us-organization-description__text, #about')?.textContent?.trim() || '',
    };
  });
  return data;
}

// ── Skills (Personnes) ────────────────────────────────────────────────────────
async function scrapeSkills(page, profileUrl) {
  emitLog('   🎯 Compétences...');
  await page.goto(`${profileUrl}/details/skills/`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
  await sleep(2000);
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.pvs-list__item-container')).map(el => ({
      name: el.querySelector('span[aria-hidden="true"]')?.textContent?.trim() || '',
      count: el.querySelector('.pvs-list__item-subtitle')?.textContent?.trim() || '0'
    })).filter(s => s.name);
  });
}

// ── Activité (Personnes) ──────────────────────────────────────────────────────
async function scrapeActivity(page, profileUrl) {
  emitLog('   📝 Activités (Posts)...');
  await page.goto(`${profileUrl}/recent-activity/shares/`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
  await sleep(2000);
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.feed-shared-update-v2')).map(el => ({
      text: el.querySelector('.feed-shared-update-v2__description')?.textContent?.trim() || '',
      date: el.querySelector('.update-components-actor__sub-description')?.textContent?.trim() || '',
      postUrl: el.querySelector('a.app-aware-link')?.href || ''
    })).filter(a => a.text).slice(0, 10);
  });
}

async function scrapeComments(page, profileUrl) {
  emitLog('   💬 Commentaires...');
  await page.goto(`${profileUrl}/recent-activity/comments/`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
  await sleep(2000);
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.feed-shared-update-v2')).map(el => ({
      text: el.querySelector('.feed-shared-update-v2__commentary')?.textContent?.trim() || '',
      date: el.querySelector('.update-components-actor__sub-description')?.textContent?.trim() || '',
      postUrl: el.querySelector('a.app-aware-link')?.href || ''
    })).filter(a => a.text).slice(0, 10);
  });
}

// ── Page About entreprise (détails complets) ──────────────────────────────────
async function scrapeCompanyAbout(page, companyUrl) {
  emitLog('   📋 Page About entreprise...');
  const aboutUrl = companyUrl.endsWith('/') ? `${companyUrl}about/` : `${companyUrl}/about/`;
  await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  try {
    await page.evaluate(() => {
      document.querySelectorAll('button[aria-label*="voir plus"], .org-about-module__show-more-btn').forEach(b => b.click());
    });
    await sleep(600);
  } catch (_) { }

  const aboutData = await page.evaluate(() => {
    function getText(el) {
      if (!el) return '';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts = []; let n;
      while ((n = w.nextNode())) {
        const t = n.textContent?.trim();
        if (t && t !== 'voir plus' && t !== 'see more' && t !== '···') parts.push(t);
      }
      return parts.join(' ').trim();
    }

    const result = {
      aboutFull: '',
      websiteUrl: '',
      phone: '',
      industry: '',
      companyType: '',
      companySize: '',
      headquarters: '',
      foundedYear: '',
      specialties: [],
    };

    const descEl = document.querySelector('.org-about-us-organization-description__text, .org-page-details-module__about-us-organization-description');
    if (descEl) result.aboutFull = getText(descEl);

    document.querySelectorAll('dl dt').forEach(dt => {
      const label = dt.textContent?.trim().toLowerCase() || '';
      const dd = dt.nextElementSibling;
      if (!dd || dd.tagName !== 'DD') return;
      const val = dd.textContent?.trim() || '';

      if (label.includes('site') || label.includes('website')) {
        const a = dd.querySelector('a');
        result.websiteUrl = a ? a.href : val;
      } else if (label.includes('téléphone') || label.includes('phone')) {
        result.phone = val;
      } else if (label.includes('secteur') || label.includes('industry')) {
        result.industry = val;
      } else if (label.includes('taille') || label.includes('size')) {
        result.companySize = val;
      } else if (label.includes('siège') || label.includes('headquarters')) {
        result.headquarters = val;
      } else if (label.includes('fondée') || label.includes('founded')) {
        result.foundedYear = val;
      } else if (label.includes('spécialité') || label.includes('specialties')) {
        result.specialties = val.split(',').map(s => s.trim()).filter(Boolean);
      }
    });
    return result;
  });

  emitLog(`   ✅ About: fondée=${aboutData.foundedYear || 'n/d'} | siège=${aboutData.headquarters || 'n/d'}`);
  return aboutData;
}

// ── Profil complet ────────────────────────────────────────────────────────────
async function scrapeFullProfile(page, person) {
  emitLog(`\n📋 Scraping : ${person.name} (${person.profileUrl})`);

  if (CONFIG.searchType === 'companies') {
    const company = await scrapeCompanyProfile(page, person.profileUrl);
    await sleep(CONFIG.delay);
    const aboutDetails = await scrapeCompanyAbout(page, person.profileUrl);
    return {
      ...person,
      ...company,
      about: aboutDetails.aboutFull || company.about,
      website: aboutDetails.websiteUrl || company.website,
      industry: aboutDetails.industry || company.industry,
      companySize: aboutDetails.companySize,
      headquarters: aboutDetails.headquarters || company.location,
      foundedYear: aboutDetails.foundedYear,
      specialties: aboutDetails.specialties,
      phone: aboutDetails.phone || '',
    };
  }

  const main = await scrapeMainProfile(page, person.profileUrl);
  await sleep(CONFIG.delay);
  const skills = await scrapeSkills(page, person.profileUrl).catch(() => []);
  
  let posts = [];
  let comments = [];
  if (CONFIG.activityType === 'all' || CONFIG.activityType === 'posts') {
    posts = await scrapeActivity(page, person.profileUrl).catch(() => []);
  }
  if (CONFIG.activityType === 'all' || CONFIG.activityType === 'comments') {
    comments = await scrapeComments(page, person.profileUrl).catch(() => []);
  }

  return { ...person, ...main, skills, activity: { posts, comments } };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  emitLog('🚀 Démarrage du Scraper LinkedIn — Playwright\n');

  const browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ['--lang=fr-FR', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'fr-FR',
  });

  const page = await context.newPage();

  try {
    await login(page);

    emitLog(`── PHASE : SCRAPING ${CONFIG.searchType.toUpperCase()} ─────────────────────────────────────────`);
    
    const people = await scrapePersonList(page);

    const profiles = [];
    const total = Math.min(people.length, CONFIG.maxProfiles);
    
    for (let i = 0; i < total; i++) {
      const pct = Math.round(((i) / total) * 80); 
      process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: `Scraping ${i + 1}/${total}: ${people[i].name}` })}\n`);

      try {
        const full = await scrapeFullProfile(page, people[i]);
        profiles.push(full);

        const prospectPayload = {
          id: `li_${Date.now()}_${i}`,
          name: full.name || people[i].name,
          initials: (full.name || people[i].name)?.[0]?.toUpperCase() || 'L',
          position: full.headline || people[i].title || '',
          company: CONFIG.searchType === 'companies' ? (full.name || people[i].name) : (full.headline || people[i].title || ''),
          source: CONFIG.searchType === 'companies' ? 'linkedin_company' : 'linkedin',
          score: 65,
          email: full.email || '',
          phone: full.phone || '',
          website: full.website || '',
          photo: full.photo || '',
          address: full.headquarters || full.location || '',
          tags: CONFIG.searchType === 'companies'
            ? (full.specialties?.slice(0, 5) || [])
            : (full.skills?.slice(0, 5).map(s => s.name) || []),
          socialLinks: {
            linkedin: full.profileUrl || people[i].profileUrl || '',
          },
          contractDetails: {
            about: full.about || '',
            headline: full.headline || '',
            location: full.location || '',
            followers: full.followers || '',
            experiences: full.experiences || [],
            education: full.education || [],
            certifications: full.certifications || [],
            recommendations: full.recommendations || [],
            skills: full.skills || [],
            photo: full.photo || '',
            foundedYear: full.foundedYear || '',
            companySize: full.companySize || '',
            specialties: full.specialties || [],
            industry: full.industry || '',
          },
          // Intelligence IA (activités récentes)
          aiIntelligence: {
            activities: {
              posts: full.activity?.posts || [],
              comments: full.activity?.comments || [],
            },
            contactInfo: { 
              phones: full.phone ? [full.phone] : [], 
              emails: full.email ? [full.email] : [], 
              addresses: full.headquarters ? [full.headquarters] : [] 
            },
          },
        };

        // Envoi du résultat JSON au processus parent
        process.stdout.write(`RESULT:${JSON.stringify(prospectPayload)}\n`);

        emitLog(`\n✅ ${full.name} extrait avec succès`);
      } catch (err) {
        emitLog(`   ❌ Erreur sur ${people[i].name} : ${err.message}`);
        // Gestion du fallback en cas d'erreur partielle
        const fallback = people[i];
        if (fallback?.name) {
          const fallbackPayload = {
            id: `li_${Date.now()}_${i}_err`,
            name: fallback.name,
            source: CONFIG.searchType === 'companies' ? 'linkedin_company' : 'linkedin',
            socialLinks: { linkedin: fallback.profileUrl || '' },
          };
          process.stdout.write(`RESULT:${JSON.stringify(fallbackPayload)}\n`);
        }
        profiles.push(people[i]);
      }
      await sleep(CONFIG.delay);
    }

    // 4. Recherche de posts additionnels (global)
    const searchPosts = await scrapeSearchPosts(page);

    // 5. Sauvegarde locale du rapport complet
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

    emitLog(`\n💾 Rapport sauvegardé → ${CONFIG.outputFile}`);

  } finally {
    await context.close();
    await browser.close();
    emitLog('\n🏁 Session terminée.');
  }
}

main().catch(console.error);
