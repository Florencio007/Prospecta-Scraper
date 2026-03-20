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

/**
 * Scrape a single official website page using an existing Playwright page object.
 * Logic based on "SCRAPER COMPLET D'ENTREPRISES — Google Search → Sites Officiels Uniquement"
 */
async function scrapeOfficialSite(page, siteInfo, options = {}) {
  const { url, name: givenName, position } = siteInfo;
  const visitContactPage = options.visitContactPage !== false;
  const emitLog = options.emitLog || (() => {});

  const result = {
    url,
    domain: getRootDomain(url),
    googlePosition: position,
  };

  // ── Chargement de la page principale ──────────────────────────────────────
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(1800);
  } catch (err) {
    result.loadError = err.message;
    return result;
  }

  // ── Extraction principale ──────────────────────────────────────────────────
  const data = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    const html = document.documentElement.innerHTML;
    const allText = body;

    // ── 1. IDENTITÉ & SEO ────────────────────────────────────────────────────
    const identity = {
      name: '',
      slogan: '',
      pageTitle: document.title?.trim() || '',
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '',
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || '',
      ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '',
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim() || '',
      lang: document.documentElement.lang || '',
      favicon: document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')?.getAttribute('href') || '',
    };

    const h1 = document.querySelector('h1');
    if (h1) identity.name = h1.textContent?.trim() || '';
    const taglineEl = document.querySelector('.tagline, .slogan, .subtitle, [class*="tagline"], [class*="slogan"]');
    if (taglineEl) identity.slogan = taglineEl.textContent?.trim() || '';

    // ── 2. CONTACTS ──────────────────────────────────────────────────────────
    const contacts = { phones: [], emails: [], whatsapp: [], addresses: [], postalCode: '', city: '', country: '' };

    const phoneSet = new Set();
    document.querySelectorAll('a[href^="tel:"]').forEach(a => {
      const n = a.href.replace('tel:', '').replace(/\s/g, '');
      if (n.length >= 7) phoneSet.add(n);
    });
    const phoneRgx = /(?:\+261|00261|0)[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2}|(?:\+\d{1,3}[\s.\-]?)?\(?\d{2,4}\)?[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}/g;
    (allText.match(phoneRgx) || []).forEach(p => { if (p.replace(/\D/g, '').length >= 7) phoneSet.add(p.trim()); });
    contacts.phones = [...phoneSet];

    const emailSet = new Set();
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      const e = decodeURIComponent(a.href.replace('mailto:', '').split('?')[0]).trim();
      if (e.includes('@') && e.length < 100) emailSet.add(e.toLowerCase());
    });
    (allText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []).forEach(e => emailSet.add(e.toLowerCase()));
    contacts.emails = [...emailSet].filter(e => !['example', 'domain', 'youremail', 'test', 'placeholder', 'sentry', 'noreply'].some(x => e.includes(x)));

    document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp.com/send"]').forEach(a => {
      const num = a.href.match(/(?:wa\.me|phone=)\/?([\d]+)/)?.[1];
      if (num) contacts.whatsapp.push(`+${num}`);
    });
    contacts.whatsapp = [...new Set(contacts.whatsapp)];

    const addrSet = new Set();
    [
      /\d{1,4}[\s,]+(?:rue|avenue|boulevard|allée|impasse|route|chemin|place|villa|lot|bp|b\.p\.|lotissement)[^\n\r,]{5,100}/gi,
      /(?:BP|B\.P\.|Boîte Postale)\s*\d+[^\n\r]{0,80}/gi,
      /(?:Antananarivo|Tana|Fianarantsoa|Mahajanga|Toamasina|Toliara|Antsirabe|Manakara)[^\n\r,]{0,80}/gi,
      /\d{3}\s?\d{2,3}[^\d\n\r]{2,30}(?:Madagascar|Mada|MG)\b/gi,
    ].forEach(pat => (allText.match(pat) || []).forEach(a => addrSet.add(a.replace(/\s+/g, ' ').trim())));
    contacts.addresses = [...addrSet];

    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const d = JSON.parse(s.textContent);
        const processLD = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          if (obj.postalCode) contacts.postalCode = obj.postalCode;
          if (obj.addressLocality) contacts.city = obj.addressLocality;
          if (obj.addressCountry) contacts.country = typeof obj.addressCountry === 'string' ? obj.addressCountry : obj.addressCountry?.name || '';
          if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(processLD);
          if (obj.address) processLD(obj.address);
        };
        processLD(d);
      } catch (_) { }
    });

    // ── 3. GPS ────────────────────────────────────────────────────────────────
    let gps = null;
    const iframeSrc = document.querySelector('iframe[src*="maps.google"], iframe[src*="google.com/maps"]')?.src || '';
    const gpsIframe = iframeSrc.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) || iframeSrc.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (gpsIframe) gps = { lat: parseFloat(gpsIframe[1]), lng: parseFloat(gpsIframe[2]) };

    if (!gps) {
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        if (gps) return;
        try {
          const d = JSON.parse(s.textContent);
          const findGeo = (o) => {
            if (!o || typeof o !== 'object') return;
            if (o.geo?.latitude) { gps = { lat: parseFloat(o.geo.latitude), lng: parseFloat(o.geo.longitude) }; return; }
            if (o.latitude) { gps = { lat: parseFloat(o.latitude), lng: parseFloat(o.longitude) }; return; }
            if (Array.isArray(o['@graph'])) o['@graph'].forEach(findGeo);
            if (o.address) findGeo(o.address);
          };
          findGeo(d);
        } catch (_) { }
      });
    }

    // ── 4. RÉSEAUX SOCIAUX (TOUS les liens trouvés) ──────────────────────────
    const socialPatterns = {
      facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?!sharer|dialog|share|plugins|tr\?|login)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
      instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
      twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/(?!intent|share|hashtag|home)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
      linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in|school)\/[^\s"'<>\?#]*/gi,
      youtube: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel\/|user\/|@|c\/)[^\s"'<>\?#]*/gi,
      tiktok: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^\s"'<>\?#]*/gi,
      pinterest: /(?:https?:\/\/)?(?:www\.)?pinterest\.(?:com|fr)\/(?!pin\/)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
      snapchat: /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/add\/[^\s"'<>\?#]*/gi,
    };
    const socials = {};
    for (const [platform, rgx] of Object.entries(socialPatterns)) {
      const matches = html.match(rgx);
      if (matches) {
        const cleaned = [...new Set(
          matches.map(u => u.replace(/['"\\]/g, '').split('?')[0].replace(/\/$/, '').trim())
            .filter(u => u.length > 15 && !u.endsWith('/sharer') && !u.endsWith('/share'))
            .map(u => u.startsWith('http') ? u : 'https://' + u)
        )];
        if (cleaned.length) socials[platform] = cleaned;
      }
    }

    // ── 4b. LIENS EXTERNES (app stores, plateformes…) ────────────────────────
    const externalLinks = { appStores: [], downloads: [], platforms: [], partners: [] };
    const ownDomain = window.location.hostname.replace(/^www\./, '');
    document.querySelectorAll('a[href^="http"]').forEach(a => {
      const href = a.href;
      const text = a.textContent?.trim() || a.title || '';
      const linkDomain = href.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
      if (linkDomain === ownDomain) return;
      if (['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com'].includes(linkDomain)) return;
      if (href.includes('play.google.com/store') || href.includes('apps.apple.com')) {
        externalLinks.appStores.push({ url: href, label: text || linkDomain }); return;
      }
      if (/\.(pdf|docx?|xlsx?|pptx?|zip)(\?|$)/i.test(href)) {
        externalLinks.downloads.push({ url: href, label: text || href.split('/').pop() }); return;
      }
      const knownPlatforms = ['booking.com', 'tripadvisor', 'hotels.com', 'airbnb', 'yelp', 'thefork', 'trustpilot'];
      if (knownPlatforms.some(p => href.includes(p))) {
        externalLinks.platforms.push({ url: href, label: text || linkDomain, platform: linkDomain }); return;
      }
      if (text.length > 2) externalLinks.partners.push({ url: href, label: text, domain: linkDomain });
    });

    // ── 5. HORAIRES ────────────────────────────────────────────────────────
    const hours = { raw: [], structured: {}, notes: [] };
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const d = JSON.parse(s.textContent);
        const extractHours = (o) => {
          if (!o || typeof o !== 'object') return;
          if (o.openingHours) hours.raw.push(...(Array.isArray(o.openingHours) ? o.openingHours : [o.openingHours]));
          if (o.openingHoursSpecification) {
            (Array.isArray(o.openingHoursSpecification) ? o.openingHoursSpecification : [o.openingHoursSpecification]).forEach(spec => {
              const days = Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek : [spec.dayOfWeek];
              days.forEach(day => { hours.structured[day] = `${spec.opens || ''}–${spec.closes || ''}`; });
            });
          }
          if (Array.isArray(o['@graph'])) o['@graph'].forEach(extractHours);
        };
        extractHours(d);
      } catch (_) { }
    });
    const hoursSection = document.querySelector('.hours, .horaires, .opening-hours, [class*="hours"], [class*="horaire"]');
    if (hoursSection) { const t = hoursSection.textContent?.replace(/\s+/g, ' ').trim(); if (t) hours.notes.push(t); }
    (allText.match(/(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^.\n\r]{5,60}/gi) || [])
      .forEach(h => { const c = h.replace(/\s+/g, ' ').trim(); if (!hours.notes.includes(c)) hours.notes.push(c); });

    // ── 6. ÉQUIPE ──────────────────────────────────────────────────────────
    const team = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const d = JSON.parse(s.textContent);
        const extractPerson = (o) => {
          if (!o || typeof o !== 'object') return;
          if (o['@type'] === 'Person' && o.name) team.push({ name: o.name, title: o.jobTitle || '', source: 'json-ld' });
          if (o.founder?.name) team.push({ name: o.founder.name, title: 'Fondateur/trice', source: 'json-ld' });
          if (Array.isArray(o.employee)) o.employee.forEach(extractPerson);
          if (Array.isArray(o['@graph'])) o['@graph'].forEach(extractPerson);
        };
        extractPerson(d);
      } catch (_) { }
    });
    ['.team-member', '.staff-member', '.person', '.employee', '[class*="equipe"]'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const n = el.querySelector('[class*="name"], h2, h3, h4, strong')?.textContent?.trim() || '';
        const r = el.querySelector('[class*="title"], [class*="role"], p, small')?.textContent?.trim() || '';
        if (n && n.length > 2 && !team.find(t => t.name === n)) team.push({ name: n, title: r, source: 'html' });
      });
    });

    // ── 7. PRODUITS & SERVICES ───────────────────────────────────────────────
    const services = { list: [], categories: [], prices: [] };
    ['.service h3', '.service h4', '.product h3', '[class*="service"] h3', 'section h3', 'section h4', '.card-title'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const t = el.textContent?.trim();
        if (t && t.length > 3 && !services.list.includes(t)) services.list.push(t);
      });
    });
    document.querySelectorAll('nav a, header nav a').forEach(a => {
      const t = a.textContent?.trim(); if (t && t.length > 2) services.categories.push(t);
    });
    (allText.match(/(?:\d[\d\s.,]*\s*(?:Ar|MGA|€|\$|USD|EUR)|\$\s*\d+|€\s*\d+)\b/gi) || []).forEach(p => {
      const c = p.replace(/\s+/g, ' ').trim(); if (!services.prices.includes(c)) services.prices.push(c);
    });

    // ── 8. AVIS & RÉPUTATION ─────────────────────────────────────────────────
    const reputation = { overallRating: '', reviewCount: '', reviews: [] };
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const d = JSON.parse(s.textContent);
        const findRating = (o) => {
          if (!o || typeof o !== 'object') return;
          if (o.aggregateRating) {
            reputation.overallRating = o.aggregateRating.ratingValue?.toString() || '';
            reputation.reviewCount = o.aggregateRating.reviewCount?.toString() || '';
          }
          if (Array.isArray(o.review)) o.review.forEach(r => reputation.reviews.push({ author: r.author?.name || 'Anonyme', rating: r.reviewRating?.ratingValue?.toString() || '', text: r.reviewBody?.trim() || '' }));
          if (Array.isArray(o['@graph'])) o['@graph'].forEach(findRating);
        };
        findRating(d);
      } catch (_) { }
    });

    // ── 9. TECHNOLOGIES ──────────────────────────────────────────────────────
    const technologies = { cms: [], frameworks: [], analytics: [], marketing: [], chat: [] };
    if (html.includes('wp-content') || html.includes('wordpress')) technologies.cms.push('WordPress');
    if (html.includes('wixstatic.com')) technologies.cms.push('Wix');
    if (html.includes('squarespace.com')) technologies.cms.push('Squarespace');
    if (html.includes('webflow.io')) technologies.cms.push('Webflow');
    if (html.includes('shopify')) technologies.cms.push('Shopify');
    if (html.includes('__NEXT_DATA__')) technologies.frameworks.push('Next.js');
    if (html.includes('gtag') || html.includes('G-')) technologies.analytics.push('Google Analytics');
    if (html.includes('fbq(')) technologies.marketing.push('Facebook Pixel');
    if (html.includes('crisp.chat')) technologies.chat.push('Crisp');
    if (html.includes('tawk.to')) technologies.chat.push('Tawk.to');

    // ── 10. FORMULAIRES ──────────────────────────────────────────────────────
    const forms = [];
    document.querySelectorAll('form').forEach(f => {
      const fields = Array.from(f.querySelectorAll('input, textarea, select'))
        .map(el => ({ type: el.type || 'textarea', name: el.name || el.id || el.placeholder || '' }))
        .filter(f => f.name && !['submit', 'button', 'reset', 'hidden'].includes(f.type));
      if (fields.length > 1) forms.push({ fields });
    });

    // ── 11. NAVIGATION & PAGES CLÉS ──────────────────────────────────────────
    const navLinks = [];
    document.querySelectorAll('nav a, header a, .menu a').forEach(a => {
      const t = a.textContent?.trim();
      const h = a.href;
      if (t && h && t.length > 1 && !h.startsWith('#') && !navLinks.find(x => x.text === t))
        navLinks.push({ text: t, href: h });
    });

    // ── 12. CONTENU TEXTUEL ──────────────────────────────────────────────────
    const mainContent = Array.from(document.querySelectorAll('main p, article p, section p'))
      .map(el => el.textContent?.trim()).filter(t => t && t.length > 60).join('\n\n').slice(0, 2000);

    const images = {
      logo: document.querySelector('.logo img, header img, [class*="logo"] img')?.src || '',
      hero: document.querySelector('.hero img, .banner img, section:first-of-type img')?.src || '',
    };

    return {
      identity, contacts, gps, socials, externalLinks, hours, team,
      services, reputation, technologies, forms, navLinks,
      mainContent, images,
    };
  });

  // ── Enrichissement : visiter la page Contact ──────────────────────────────
  let contactPageData = null;
  if (visitContactPage) {
    const contactLink = data.navLinks.find(l => /contact|nous joindre|nous trouver|about us|à propos/i.test(l.text));
    if (contactLink?.href?.startsWith('http') && contactLink.href !== url) {
      try {
        emitLog(`   📞 Visite page Contact : ${contactLink.href}`);
        await page.goto(contactLink.href, { waitUntil: 'domcontentloaded', timeout: 18000 });
        await sleep(1200);
        contactPageData = await page.evaluate(() => {
          const body = document.body?.innerText || '';
          const phoneSet = new Set();
          document.querySelectorAll('a[href^="tel:"]').forEach(a => phoneSet.add(a.href.replace('tel:', '')));
          const emailSet = new Set();
          document.querySelectorAll('a[href^="mailto:"]').forEach(a => emailSet.add(a.href.replace('mailto:', '').split('?')[0]));
          const addrSet = new Set();
          (body.match(/(?:Antananarivo|Tana|Madagascar|rue|avenue|boulevard|lot)[^\n\r,]{5,100}/gi) || []).forEach(a => addrSet.add(a.replace(/\s+/g, ' ').trim()));
          return { extraPhones: [...phoneSet], extraEmails: [...emailSet], extraAddresses: [...addrSet] };
        });
      } catch (_) { }
    }
  }

  // ── Assemblage final ───────────────────────────────────────────────────────
  return {
    name: data.identity.name || givenName || '',
    slogan: data.identity.slogan,
    pageTitle: data.identity.pageTitle,
    metaDescription: data.identity.metaDescription || data.identity.ogDescription,
    ogImage: data.identity.ogImage,
    lang: data.identity.lang,
    logo: data.images.logo,
    heroImage: data.images.hero,
    url,
    domain: result.domain,
    googlePosition: position,
    contacts: {
      phones: [...new Set([...data.contacts.phones, ...(contactPageData?.extraPhones || [])])],
      emails: [...new Set([...data.contacts.emails, ...(contactPageData?.extraEmails || [])])],
      whatsapp: data.contacts.whatsapp,
      addresses: [...new Set([...data.contacts.addresses, ...(contactPageData?.extraAddresses || [])])],
      postalCode: data.contacts.postalCode,
      city: data.contacts.city,
      country: data.contacts.country,
    },
    gps: data.gps,
    socials: data.socials,
    externalLinks: data.externalLinks,
    hours: data.hours,
    team: data.team,
    services: data.services,
    reputation: data.reputation,
    technologies: data.technologies,
    forms: data.forms,
    navLinks: data.navLinks,
    mainContent: data.mainContent,
    scrapedAt: new Date().toISOString(),
    platform: 'Site Officiel',
  };
}

module.exports = { scrapeOfficialSite, isOfficialSite };
