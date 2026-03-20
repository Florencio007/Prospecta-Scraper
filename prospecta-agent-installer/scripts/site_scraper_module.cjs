/**
 * site_scraper_module.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 *  Module partagé : Scraping des sites officiels pour tous les canaux Prospecta
 *  Usage : const { scrapeOfficialSite } = require('./site_scraper_module.cjs');
 *  ──────────────────────────────────────────────────────────────────────────
 *  Données extraites :
 *  ┌─ CONTACTS : Téléphones, Emails, WhatsApp, Adresse, Code postal
 *  ├─ IDENTITÉ : Nom, Slogan, Meta description, og:image, lang, logo
 *  ├─ GPS       : lat/lng (iFrame Maps ou JSON-LD ou meta)
 *  ├─ RÉSEAUX  : Facebook, Instagram, LinkedIn, Twitter/X, YouTube, TikTok…
 *  ├─ HORAIRES : Raw, Structured (JSON-LD), Notes textuelles
 *  ├─ ÉQUIPE   : Noms, Postes (JSON-LD + HTML sections)
 *  ├─ SERVICES : Liste, Catégories nav, Tarifs
 *  ├─ RÉPUTATION: Note globale, Nombre d'avis, Avis JSON-LD
 *  ├─ TECHNO   : CMS, Frameworks, Analytics, Chat, Marketing
 *  └─ FORMULAIRES, STRUCTURE DATA, CONTENU PRINCIPAL
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Scrape a single official website page using an existing Playwright page object.
 * @param {import('playwright').Page} page  — Playwright page instance (already initialized)
 * @param {object} siteInfo                 — { url, name?, position? }
 * @param {object} options
 * @param {boolean} [options.visitContactPage=true]  - Whether to follow contact links
 * @param {function} [options.emitLog]               - Optional logger: (msg, pct?) => void
 * @returns {Promise<object>}               — Enriched record
 */
async function scrapeOfficialSite(page, siteInfo, options = {}) {
  const { url, name: givenName, position } = siteInfo;
  const visitContactPage = options.visitContactPage !== false;
  const emitLog = options.emitLog || (() => {});

  const getRootDomain = (u) => {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
  };

  const result = {
    url,
    domain: getRootDomain(url),
    googlePosition: position,
  };

  // ── Load main page ─────────────────────────────────────────────────────────
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(1500);
  } catch (err) {
    result.loadError = err.message;
    emitLog(`   ⚠️  Impossible de charger le site : ${err.message}`);
    return result;
  }

  // ── Main extraction ────────────────────────────────────────────────────────
  const data = await page.evaluate(() => {
    const body   = document.body?.innerText || '';
    const html   = document.documentElement.innerHTML;

    // ── 1. IDENTITÉ & SEO ──────────────────────────────────────────────────
    const identity = {
      name:            '',
      slogan:          '',
      pageTitle:       document.title?.trim() || '',
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '',
      ogTitle:         document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || '',
      ogDescription:   document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '',
      ogImage:         document.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim() || '',
      canonical:       document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || '',
      lang:            document.documentElement.lang || '',
      favicon:         document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')?.getAttribute('href') || '',
    };
    const h1 = document.querySelector('h1');
    if (h1) identity.name = h1.textContent?.trim() || '';
    const taglineEl = document.querySelector('.tagline, .slogan, .subtitle, [class*="tagline"], [class*="slogan"]');
    if (taglineEl) identity.slogan = taglineEl.textContent?.trim() || '';

    // ── 2. CONTACTS ────────────────────────────────────────────────────────
    const contacts = { phones: [], emails: [], whatsapp: [], addresses: [], postalCode: '', city: '', country: '' };

    const phoneSet = new Set();
    document.querySelectorAll('a[href^="tel:"]').forEach(a => {
      const n = a.href.replace('tel:', '').replace(/\s/g, '');
      if (n.length >= 7) phoneSet.add(n);
    });
    const phoneRgx = /(?:\+261|00261|0)[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2}|(?:\+\d{1,3}[\s.\-]?)?\(?\d{2,4}\)?[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}/g;
    (body.match(phoneRgx) || []).forEach(p => { if (p.replace(/\D/g, '').length >= 7) phoneSet.add(p.trim()); });
    contacts.phones = [...phoneSet];

    const emailSet = new Set();
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      const e = decodeURIComponent(a.href.replace('mailto:', '').split('?')[0]).trim();
      if (e.includes('@') && e.length < 100) emailSet.add(e.toLowerCase());
    });
    (body.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []).forEach(e => emailSet.add(e.toLowerCase()));
    contacts.emails = [...emailSet].filter(e =>
      !['example','domain','youremail','test','placeholder','sentry','noreply'].some(x => e.includes(x))
    );

    document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]').forEach(a => {
      const num = a.href.match(/(?:wa\.me|phone=)\/?([\d]+)/)?.[1];
      if (num) contacts.whatsapp.push(`+${num}`);
    });
    contacts.whatsapp = [...new Set(contacts.whatsapp)];

    const addrSet = new Set();
    [
      /\d{1,4}[\s,]+(?:rue|avenue|boulevard|allée|impasse|route|chemin|place|villa|lot|bp|b\.p\.)[^\n\r,]{5,100}/gi,
      /(?:BP|B\.P\.|Boîte Postale)\s*\d+[^\n\r]{0,80}/gi,
      /(?:Antananarivo|Tana|Fianarantsoa|Mahajanga|Toamasina|Toliara|Antsirabe)[^\n\r,]{0,80}/gi,
    ].forEach(pat => (body.match(pat) || []).forEach(a => addrSet.add(a.replace(/\s+/g, ' ').trim())));
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
      } catch (_) {}
    });

    // ── 3. GPS ─────────────────────────────────────────────────────────────
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
            if (!o || typeof o !== 'object' || gps) return;
            if (o.geo?.latitude) { gps = { lat: parseFloat(o.geo.latitude), lng: parseFloat(o.geo.longitude) }; return; }
            if (Array.isArray(o['@graph'])) o['@graph'].forEach(findGeo);
            if (o.address) findGeo(o.address);
          };
          findGeo(d);
        } catch (_) {}
      });
    }
    if (!gps) {
      const geoMeta = document.querySelector('meta[name="geo.position"]')?.getAttribute('content');
      if (geoMeta) { const [lat, lng] = geoMeta.split(';').map(parseFloat); if (!isNaN(lat)) gps = { lat, lng }; }
    }

    // ── 4. RÉSEAUX SOCIAUX ────────────────────────────────────────────────
    const socialPatterns = {
      facebook:  /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?!sharer|dialog|share|plugins|tr\?|login)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
      instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
      twitter:   /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/(?!intent|share|hashtag|home)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
      linkedin:  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in|school)\/[^\s"'<>\?#]*/gi,
      youtube:   /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel\/|user\/|@|c\/)[^\s"'<>\?#]*/gi,
      tiktok:    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^\s"'<>\?#]*/gi,
      pinterest: /(?:https?:\/\/)?(?:www\.)?pinterest\.(?:com|fr)\/(?!pin\/)[^\s"'<>\?#\/][^\s"'<>\?#]*/gi,
    };
    const socials = {};
    for (const [platform, rgx] of Object.entries(socialPatterns)) {
      const matches = html.match(rgx);
      if (matches) {
        const cleaned = [...new Set(
          matches.map(u => u.replace(/['"\\]/g, '').split('?')[0].replace(/\/$/, '').trim())
            .filter(u => u.length > 15)
            .map(u => u.startsWith('http') ? u : 'https://' + u)
        )];
        if (cleaned.length) socials[platform] = cleaned;
      }
    }

    // ── 5. HORAIRES ────────────────────────────────────────────────────────
    const hours = { raw: [], structured: {}, notes: [] };
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const d = JSON.parse(s.textContent);
        const extractH = (o) => {
          if (!o || typeof o !== 'object') return;
          if (o.openingHours) { const h = Array.isArray(o.openingHours) ? o.openingHours : [o.openingHours]; hours.raw.push(...h); }
          if (o.openingHoursSpecification) {
            (Array.isArray(o.openingHoursSpecification) ? o.openingHoursSpecification : [o.openingHoursSpecification]).forEach(spec => {
              const days = Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek : [spec.dayOfWeek];
              days.forEach(day => { hours.structured[day] = `${spec.opens || ''}–${spec.closes || ''}`; });
            });
          }
          if (Array.isArray(o['@graph'])) o['@graph'].forEach(extractH);
        };
        extractH(d);
      } catch (_) {}
    });
    const hoursSection = document.querySelector('.hours, .horaires, .opening-hours, [itemprop="openingHours"]');
    if (hoursSection) { const t = hoursSection.textContent?.replace(/\s+/g, ' ').trim(); if (t) hours.notes.push(t); }
    (body.match(/(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^.\n\r]{5,60}/gi) || [])
      .forEach(h => { const c = h.replace(/\s+/g, ' ').trim(); if (!hours.notes.includes(c)) hours.notes.push(c); });

    // ── 6. ÉQUIPE ──────────────────────────────────────────────────────────
    const team = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const d = JSON.parse(s.textContent);
        const extractP = (o) => {
          if (!o || typeof o !== 'object') return;
          if (o['@type'] === 'Person' && o.name) team.push({ name: o.name, title: o.jobTitle || '', source: 'json-ld' });
          if (o.founder?.name) team.push({ name: o.founder.name, title: 'Fondateur/trice', source: 'json-ld' });
          if (Array.isArray(o.employee)) o.employee.forEach(extractP);
          if (Array.isArray(o['@graph'])) o['@graph'].forEach(extractP);
        };
        extractP(d);
      } catch (_) {}
    });
    ['.team-member','.staff-member','.person','.employee','[class*="equipe"]'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const n = el.querySelector('[class*="name"], h2, h3, h4, strong')?.textContent?.trim() || '';
        const r = el.querySelector('[class*="title"], [class*="role"], p, small')?.textContent?.trim() || '';
        if (n && n.length > 2 && !team.find(t => t.name === n)) team.push({ name: n, title: r, source: 'html' });
      });
    });

    // ── 7. SERVICES ────────────────────────────────────────────────────────
    const services = { list: [], categories: [], prices: [] };
    ['.service h3','.service h4','.product h3','[class*="service"] h3','section h3','section h4','.card-title'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const t = el.textContent?.trim();
        if (t && t.length > 3 && !services.list.includes(t)) services.list.push(t);
      });
    });
    document.querySelectorAll('nav a, header nav a').forEach(a => {
      const t = a.textContent?.trim();
      if (t && t.length > 2) services.categories.push(t);
    });
    (body.match(/(?:\d[\d\s.,]*\s*(?:Ar|MGA|€|\$|USD|EUR)|\$\s*\d+|€\s*\d+)\b/gi) || []).forEach(p => {
      const c = p.replace(/\s+/g, ' ').trim();
      if (!services.prices.includes(c)) services.prices.push(c);
    });

    // ── 8. RÉPUTATION ──────────────────────────────────────────────────────
    const reputation = { overallRating: '', reviewCount: '', reviews: [] };
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const d = JSON.parse(s.textContent);
        const findR = (o) => {
          if (!o || typeof o !== 'object') return;
          if (o.aggregateRating) { reputation.overallRating = o.aggregateRating.ratingValue?.toString() || ''; reputation.reviewCount = o.aggregateRating.reviewCount?.toString() || ''; }
          if (Array.isArray(o.review)) o.review.forEach(r => reputation.reviews.push({ author: r.author?.name || 'Anonyme', rating: r.reviewRating?.ratingValue?.toString() || '', text: r.reviewBody?.trim() || '' }));
          if (Array.isArray(o['@graph'])) o['@graph'].forEach(findR);
        };
        findR(d);
      } catch (_) {}
    });

    // ── 9. TECHNOLOGIES ────────────────────────────────────────────────────
    const technologies = { cms: [], analytics: [], marketing: [], chat: [] };
    if (html.includes('wp-content') || html.includes('wordpress')) technologies.cms.push('WordPress');
    if (html.includes('wixstatic.com')) technologies.cms.push('Wix');
    if (html.includes('squarespace.com')) technologies.cms.push('Squarespace');
    if (html.includes('webflow.io') || html.includes('webflow.com/assets')) technologies.cms.push('Webflow');
    if (html.includes('shopify')) technologies.cms.push('Shopify');
    if (html.includes('__NEXT_DATA__')) technologies.cms.push('Next.js');
    if (html.includes('gtag') || html.includes('google-analytics') || html.includes('G-')) technologies.analytics.push('Google Analytics');
    if (html.includes('hotjar')) technologies.analytics.push('Hotjar');
    if (html.includes('clarity.ms')) technologies.analytics.push('Microsoft Clarity');
    if (html.includes('fbq(') || html.includes('facebook.net/signals')) technologies.marketing.push('Facebook Pixel');
    if (html.includes('hubspot')) technologies.marketing.push('HubSpot');
    if (html.includes('mailchimp')) technologies.marketing.push('Mailchimp');
    if (html.includes('crisp.chat') || html.includes('crisp-cdn')) technologies.chat.push('Crisp');
    if (html.includes('tawk.to')) technologies.chat.push('Tawk.to');
    if (html.includes('intercom')) technologies.chat.push('Intercom');
    if (html.includes('zendesk')) technologies.chat.push('Zendesk');

    // ── 10. NAVIGATION ─────────────────────────────────────────────────────
    const navLinks = [];
    document.querySelectorAll('nav a, header a, .menu a').forEach(a => {
      const t = a.textContent?.trim();
      const h = a.href;
      if (t && h && t.length > 1 && !h.startsWith('#') && !navLinks.find(x => x.text === t))
        navLinks.push({ text: t, href: h });
    });

    // ── 11. LOGO & IMAGES ──────────────────────────────────────────────────
    const images = {
      logo: document.querySelector('.logo img, header img, [class*="logo"] img')?.src || '',
      hero: document.querySelector('.hero img, .banner img, section:first-of-type img')?.src || '',
    };

    // ── 12. STRUCTURED DATA ────────────────────────────────────────────────
    const structuredData = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try { structuredData.push(JSON.parse(s.textContent)); } catch (_) {}
    });

    return { identity, contacts, gps, socials, hours, team, services, reputation, technologies, navLinks, images, structuredData };
  });

  // ── Enrichissement : visiter page Contact ──────────────────────────────────
  let contactPageData = null;
  if (visitContactPage) {
    const contactLink = data.navLinks.find(l =>
      /contact|nous joindre|nous trouver|about us|à propos/i.test(l.text)
    );
    if (contactLink?.href?.startsWith('http') && contactLink.href !== url) {
      try {
        emitLog(`   📞 Page Contact : ${contactLink.href}`);
        await page.goto(contactLink.href, { waitUntil: 'domcontentloaded', timeout: 18000 });
        await sleep(1000);
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
      } catch (_) {}
    }
  }

  // ── Assemble final record ──────────────────────────────────────────────────
  return {
    // Identity
    name:            data.identity.name || givenName || '',
    slogan:          data.identity.slogan,
    pageTitle:       data.identity.pageTitle,
    metaDescription: data.identity.metaDescription || data.identity.ogDescription,
    ogImage:         data.identity.ogImage,
    lang:            data.identity.lang,
    canonical:       data.identity.canonical,
    logo:            data.images.logo,
    heroImage:       data.images.hero,

    // Source
    url,
    domain: getRootDomain(url),
    googlePosition: position,

    // Contacts (merged with contact page)
    contacts: {
      phones:     [...new Set([...data.contacts.phones,     ...(contactPageData?.extraPhones    || [])])],
      emails:     [...new Set([...data.contacts.emails,     ...(contactPageData?.extraEmails    || [])])],
      whatsapp:   data.contacts.whatsapp,
      addresses:  [...new Set([...data.contacts.addresses,  ...(contactPageData?.extraAddresses || [])])],
      postalCode: data.contacts.postalCode,
      city:       data.contacts.city,
      country:    data.contacts.country,
    },

    // Location
    gps: data.gps,

    // Social media
    socials:   data.socials,

    // Hours
    hours: data.hours,

    // Team
    team: data.team,

    // Services
    services: data.services,

    // Reputation
    reputation: data.reputation,

    // Technologies
    technologies: data.technologies,

    // Navigation
    navLinks: data.navLinks,

    // Structured data
    structuredData: data.structuredData,

    // Meta
    scrapedAt: new Date().toISOString(),
    scrapedVia: 'site_scraper_module',
  };
}

module.exports = { scrapeOfficialSite };
