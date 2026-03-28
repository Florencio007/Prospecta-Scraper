/**
 * scraper_googlemaps.cjs — Prospecta AI (v5 — À propos complet + contacts prioritaires)
 *
 * Changements v5 vs v4 :
 *  - ❌ Suppression complète du scraping des avis (plus rapide, plus fiable)
 *  - ✅ Extraction "À propos" renforcée — AUCUNE section ratée
 *  - ✅ Email + téléphone : extraction multi-sources agressive
 *       → Google Maps fiche, onglet À propos, site web (page d'accueil + contact + à-propos)
 *       → Tous les liens mailto:, tel:, regex sur tout le texte visible
 *  - ✅ Scraping site web renforcé : crawl jusqu'à 4 pages (accueil, contact, about, reservations)
 *  - ✅ Champs email_all et phones_all toujours remplis au maximum
 *
 * Arguments CLI :
 *   argv[2] = q      (mots-clés)
 *   argv[3] = l      (localisation)
 *   argv[4] = limit  (nombre max d'établissements, défaut 20)
 *   argv[5] = userId (optionnel)
 *   argv[6] = type   (optionnel)
 *
 * Sortie stdout :
 *   PROGRESS:{...}
 *   RESULT:{...}
 *   ERROR:{...}
 *   DONE:{...}
 */

"use strict";

const { chromium } = require("playwright");
const fs   = require("fs");
const path = require("path");

// ─── Arguments CLI ────────────────────────────────────────────────────────────
const [,, QUERY, LOCATION, LIMIT_ARG, USER_ID, TYPE] = process.argv;
const SEARCH_QUERY = [QUERY, LOCATION].filter(Boolean).join(" ");
const MAX_RESULTS  = Math.min(parseInt(LIMIT_ARG) || 20, 60);

// ─── Config ───────────────────────────────────────────────────────────────────
const CANCEL_LOCK            = path.join(__dirname, "cancel_scrape.lock");
const OUTPUT_FILE            = path.join(__dirname, "last_gmaps_results.json");
const DELAY_BETWEEN_FICHES   = [1200, 2500];
const SCROLL_DELAY           = [1500, 2500];
const WEBSITE_SCRAPE_TIMEOUT = 20000;
const MAX_TEXT_CHARS         = 20000;

// Pages à crawler sur chaque site web (chemins relatifs prioritaires)
const CONTACT_PATH_KEYWORDS = [
  "contact", "contacts", "nous-contacter", "contactez-nous",
  "about", "a-propos", "qui-sommes-nous", "equipe",
  "reservation", "reservations", "book", "booking",
  "info", "informations",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

// ─── Plateformes/réseaux sociaux connus ──────────────────────────────────────
const SOCIAL_DOMAIN_MAP = {
  "facebook.com":    "facebook",
  "fb.com":          "facebook",
  "instagram.com":   "instagram",
  "twitter.com":     "twitter",
  "x.com":           "twitter",
  "linkedin.com":    "linkedin",
  "youtube.com":     "youtube",
  "youtu.be":        "youtube",
  "tiktok.com":      "tiktok",
  "wa.me":           "whatsapp",
  "whatsapp.com":    "whatsapp",
  "tripadvisor.com": "tripadvisor",
  "tripadvisor.fr":  "tripadvisor",
  "booking.com":     "booking",
  "airbnb.com":      "airbnb",
  "google.com":      null,
  "google.mg":       null,
  "google.fr":       null,
  "google.co.uk":    null,
  "goo.gl":          null,
  "gstatic.com":     null,
  "googleapis.com":  null,
  "maps.google.com": null,
};

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function sleep(range) {
  const ms = Array.isArray(range) ? rand(range[0], range[1]) : range;
  return new Promise(r => setTimeout(r, ms));
}
function isCancelled() { return fs.existsSync(CANCEL_LOCK); }
function emit(type, payload) { process.stdout.write(`${type}:${JSON.stringify(payload)}\n`); }
function randomUA() { return USER_AGENTS[rand(0, USER_AGENTS.length - 1)]; }

// ─── Nettoyage ────────────────────────────────────────────────────────────────
function cleanPhone(raw) {
  if (!raw) return "";
  // Normaliser les espaces et garder seulement les caractères téléphoniques
  return raw.replace(/[^\d+\s\-().]/g, "").trim();
}
function cleanText(raw) {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim();
}
function cleanUrl(raw) {
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.origin + url.pathname.replace(/\/$/, "");
  } catch { return raw; }
}
function extractRealUrl(googleRedirectUrl) {
  try {
    const url = new URL(googleRedirectUrl);
    const q = url.searchParams.get("q");
    if (q) return q;
    const u = url.searchParams.get("url");
    if (u) return u;
  } catch {}
  return googleRedirectUrl;
}
function isValidEmail(email) {
  if (!email) return false;
  // Filtrer les emails techniques/non-pertinents
  const IGNORED = [
    "google", "sentry", "example", "test", "noreply", "no-reply",
    "donotreply", "postmaster", "webmaster", "support@sentry",
    "privacy@", "legal@", "abuse@",
  ];
  return !IGNORED.some(ig => email.toLowerCase().includes(ig));
}
function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

// ─── Classification URL ───────────────────────────────────────────────────────
function classifyUrl(rawUrl) {
  if (!rawUrl) return { type: "ignore" };
  try {
    let resolved = extractRealUrl(rawUrl);
    if (!resolved.startsWith("http")) resolved = "https://" + resolved;
    const parsed   = new URL(resolved);
    const hostname = parsed.hostname.replace(/^www\./, "");
    for (const [domain, platform] of Object.entries(SOCIAL_DOMAIN_MAP)) {
      if (hostname === domain || hostname.endsWith("." + domain)) {
        if (platform === null) return { type: "ignore" };
        return { type: "social", platform, url: cleanUrl(resolved) };
      }
    }
    return { type: "website", url: cleanUrl(resolved) };
  } catch {
    return { type: "ignore" };
  }
}

// ─── Nettoyage description ────────────────────────────────────────────────────
function cleanPlatformDescription(text) {
  if (!text) return "";
  const noisePatterns = [
    /\d[\d\s]*(j'aime|likes?)[^\n]*/gi,
    /\d[\d\s]*(en parlent|talking about)[^\n]*/gi,
    /se connecter[^\n]*/gi,
    /cr[eé]er un compte[^\n]*/gi,
    /^[\s·•|]+$/gm,
  ];
  let cleaned = text;
  for (const pat of noisePatterns) cleaned = cleaned.replace(pat, "");
  return cleanText(cleaned);
}

// ─── Parsing des horaires ─────────────────────────────────────────────────────
function parseHours(rawHoursText) {
  if (!rawHoursText) return null;
  const DAYS_FR = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
  const DAYS_EN = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const hours = {};
  const text  = rawHoursText.toLowerCase();
  const dayPattern = new RegExp(
    `(${[...DAYS_FR,...DAYS_EN].join("|")})\\s*[:\\-]?\\s*(\\d{1,2}[h:]\\s*\\d{0,2}\\s*[–\\-]\\s*\\d{1,2}[h:]\\s*\\d{0,2}|fermé|closed|24h|ouvert 24h)`,
    "gi"
  );
  let match;
  while ((match = dayPattern.exec(text)) !== null) {
    const day = match[1].toLowerCase();
    const norm = DAYS_EN.includes(day) ? DAYS_FR[DAYS_EN.indexOf(day)] : day;
    hours[norm] = match[2].trim().replace(/\s+/g, "");
  }
  return Object.keys(hours).length > 0 ? hours : null;
}

// ─── Heuristiques texte ───────────────────────────────────────────────────────
function extractServicesFromText(text) {
  const triggers = [
    /nos services?\s*[:\-–]/i, /prestations?\s*[:\-–]/i,
    /nous proposons?\s*[:\-–]/i, /what we (do|offer)\s*[:\-–]/i,
    /our services?\s*[:\-–]/i, /menu\s*[:\-–]/i, /carte\s*[:\-–]/i,
    /[eé]quipements?\s*[:\-–]/i, /facilities\s*[:\-–]/i,
  ];
  for (const pattern of triggers) {
    const match = text.match(pattern);
    if (!match) continue;
    const snippet = text.slice(match.index + match[0].length, match.index + match[0].length + 400);
    const items = snippet.split(/[\n,•·|\/]+/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 80);
    if (items.length >= 2) return [...new Set(items)].slice(0, 10);
  }
  return [];
}
function buildDescription(meta, rawText) {
  if (meta && meta.length > 20) return meta;
  const sentences = rawText.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 30 && s.length < 200);
  return sentences.slice(0, 2).join(". ") + (sentences.length > 0 ? "." : "");
}

// ─── Extraction emails/téléphones depuis du texte brut ───────────────────────
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d[\d\s\-().]{6,18}\d)/g;

function extractEmailsFromText(text) {
  return [...new Set((text.match(EMAIL_REGEX) || []).filter(isValidEmail))];
}
function extractPhonesFromText(text) {
  return [...new Set(
    (text.match(PHONE_REGEX) || [])
      .map(p => cleanPhone(p))
      .filter(isValidPhone)
  )];
}

// ─── Extraction "À propos" renforcée ─────────────────────────────────────────
/**
 * Extrait TOUT le contenu de l'onglet "À propos" Google Maps.
 * Stratégie multi-niveaux pour ne rien rater.
 *
 * Retourne :
 * {
 *   raw_sections: { "Titre section": ["item1", "item2", ...] },
 *   all_text: "texte brut complet de l'onglet",
 *   emails_found: [],     ← emails trouvés dans l'onglet À propos
 *   phones_found: [],     ← téléphones trouvés dans l'onglet À propos
 *   commodites, accessibilite, paiements, parking, ambiance,
 *   services, offres, public_cible, enfants, animaux,
 *   sante_securite, autres
 * }
 */
async function extractAboutTab(page) {
  const about = {
    raw_sections:   {},
    all_text:       "",
    emails_found:   [],
    phones_found:   [],
    commodites:     [],
    accessibilite:  [],
    paiements:      [],
    parking:        [],
    ambiance:       [],
    services:       [],
    offres:         [],
    public_cible:   [],
    enfants:        [],
    animaux:        [],
    sante_securite: [],
    autres:         [],
  };

  try {
    // ── Cliquer sur l'onglet "À propos" ──────────────────────────────────
    const aboutTabSelectors = [
      'button[aria-label*="propos"]',
      'button[aria-label*="About"]',
      'button[data-tab-index="2"]',
      'button[data-tab-index="3"]',
    ];

    let clicked = false;
    for (const sel of aboutTabSelectors) {
      const tab = page.locator(sel).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        clicked = true;
        await sleep(1800);
        break;
      }
    }

    // Essai par texte du bouton
    if (!clicked) {
      const tabs = await page.$$('[role="tab"], button');
      for (const tab of tabs) {
        const txt = await tab.textContent().catch(() => "");
        if (/\bà propos\b|\babout\b/i.test(txt)) {
          await tab.click().catch(() => {});
          clicked = true;
          await sleep(1800);
          break;
        }
      }
    }

    if (!clicked) return about;

    // ── Attendre que le contenu soit chargé ──────────────────────────────
    await page.waitForTimeout(1500);

    // ── Extraction complète du texte brut de l'onglet ─────────────────────
    // C'est la stratégie la plus robuste : on prend TOUT le texte visible
    const fullText = await page.evaluate(() => {
      // Cibler le panneau principal de l'onglet À propos
      const panels = [
        document.querySelector('[aria-label*="À propos"]'),
        document.querySelector('[aria-label*="About"]'),
        document.querySelector('[data-tab-index="2"]'),
        document.querySelector('.m6QErb[aria-label]'),
        document.querySelector('[role="main"]'),
      ].filter(Boolean);

      for (const panel of panels) {
        const text = panel.innerText?.trim() || "";
        if (text.length > 50) return text;
      }
      return document.body.innerText?.trim() || "";
    }).catch(() => "");

    about.all_text = cleanText(fullText).substring(0, 10000);

    // Chercher emails et téléphones dans le texte brut de l'onglet
    about.emails_found = extractEmailsFromText(about.all_text);
    about.phones_found = extractPhonesFromText(about.all_text);

    // ── Extraction structurée des sections ───────────────────────────────
    const rawData = await page.evaluate(() => {
      const result = {};

      const sectionSelectors = [".iP2t7d", ".e2moi", ".RcCsl > div", ".ugiz4"];
      let sections = [];
      for (const sel of sectionSelectors) {
        sections = Array.from(document.querySelectorAll(sel));
        if (sections.length > 0) break;
      }

      // Si aucune section structurée, prendre tout le contenu disponible
      if (sections.length === 0) {
        const mainPanel = document.querySelector('[role="main"], .m6QErb');
        if (mainPanel) {
          const allText = mainPanel.innerText?.trim().replace(/\s+/g, " ") || "";
          if (allText) result["__raw__"] = [allText];
        }
        return result;
      }

      for (const section of sections) {
        const titleEl = section.querySelector(
          ".iL3Qke, .fontTitleSmall, h2, h3, .Srm0re, [aria-level]"
        );
        const title = titleEl?.textContent?.trim() || "Divers";

        const items = [];

        // Stratégie 1 : items structurés avec classe connue
        const itemEls = section.querySelectorAll(
          ".hpLkke, .aFJEkb, li, .ks8rPe"
        );
        for (const itemEl of itemEls) {
          const labelEl = itemEl.querySelector(
            ".fontBodyMedium, span:not([aria-hidden='true'])"
          );
          const label = (labelEl?.textContent || itemEl.textContent || "").trim();

          // Détecter disponibilité via icône/aria
          const notAvailable = !!itemEl.querySelector(
            "[aria-label*='indisponible'], [aria-label*='not available'], .XWZjwc"
          );
          const available = notAvailable ? false : null;

          if (label && label.length > 1 && label.length < 150 && label !== title) {
            items.push({ label, available });
          }
        }

        // Stratégie 2 : si pas d'items trouvés, prendre tout le texte de la section
        if (items.length === 0) {
          const sectionText = section.innerText?.trim().replace(/\s+/g, " ") || "";
          const withoutTitle = sectionText.startsWith(title)
            ? sectionText.slice(title.length).trim()
            : sectionText;
          if (withoutTitle && withoutTitle.length > 1) {
            // Découper par lignes/sauts de ligne
            const lines = withoutTitle.split(/\n/).map(l => l.trim()).filter(l => l.length > 1);
            for (const line of lines) {
              if (line !== title) items.push({ label: line, available: null });
            }
          }
        }

        if (items.length > 0) result[title] = items;
      }

      return result;
    }).catch(() => ({}));

    about.raw_sections = rawData;

    // ── Classification des sections dans les catégories ───────────────────
    const CATEGORY_KEYWORDS = {
      accessibilite:  ["accessib", "fauteuil", "wheelchair", "handicap", "pmr", "ascenseur"],
      paiements:      ["paiement", "payment", "carte", "card", "espèce", "cash", "nfc", "visa", "mastercard", "mobile pay", "paypal"],
      parking:        ["parking", "stationnement", "garage", "voiture", "vélo", "moto"],
      ambiance:       ["ambiance", "atmosphère", "atmosphere", "romantique", "casual", "animé", "calme", "bruit", "terrasse"],
      services:       ["service", "livraison", "delivery", "emporter", "takeaway", "réservation", "reservation", "sur place", "dine-in", "room service"],
      offres:         ["offre", "promotion", "happy hour", "brunch", "déjeuner", "dîner", "menu", "cuisine", "buffet"],
      public_cible:   ["public", "famille", "group", "groupe", "couple", "adulte", "étudiant"],
      enfants:        ["enfant", "children", "child", "bébé", "baby", "chaise haute", "kids"],
      animaux:        ["animal", "animaux", "chien", "dog", "pet"],
      sante_securite: ["santé", "health", "sécurité", "security", "covid", "masque", "distanciation"],
      commodites:     ["wifi", "wi-fi", "télévision", "tv", "climatisation", "air conditionné", "piscine", "spa", "gym", "fitness", "bar", "restaurant", "parking", "navette", "transfert", "blanchisserie", "concierg"],
    };

    for (const [sectionTitle, items] of Object.entries(rawData)) {
      const titleLower = sectionTitle.toLowerCase();
      let assigned = false;

      for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        const matchTitle = keywords.some(kw => titleLower.includes(kw));
        const matchItems = items.some(it => keywords.some(kw => it.label.toLowerCase().includes(kw)));
        if (matchTitle || matchItems) {
          about[category].push(
            ...items.map(it =>
              it.available === false ? `✗ ${it.label}` :
              it.available === true  ? `✓ ${it.label}` : it.label
            )
          );
          assigned = true;
          break;
        }
      }

      if (!assigned && sectionTitle !== "__raw__") {
        about.autres.push(...items.map(it => `[${sectionTitle}] ${it.label}`));
      }
    }

    // Dédupliquer chaque catégorie
    for (const key of Object.keys(about)) {
      if (Array.isArray(about[key])) {
        about[key] = [...new Set(about[key])];
      }
    }

    // ── Retour sur l'onglet Présentation/Overview ─────────────────────────
    const overviewSelectors = [
      'button[aria-label*="Aperçu"]',
      'button[aria-label*="Présentation"]',
      'button[aria-label*="Overview"]',
      'button[data-tab-index="0"]',
    ];
    for (const sel of overviewSelectors) {
      const tab = page.locator(sel).first();
      if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tab.click().catch(() => {});
        await sleep(500);
        break;
      }
    }

  } catch (err) {
    about._error = err.message;
  }

  return about;
}

// ─── Scraping site web renforcé ───────────────────────────────────────────────
/**
 * Scrape le site web de l'établissement en crawlant jusqu'à MAX_PAGES pages.
 * Priorité absolue : emails et téléphones.
 * Crawl intelligent : page d'accueil + pages contact/about/réservation.
 */
async function scrapeWebsite(context, websiteUrl) {
  const result = {
    raw_text: "", emails: [], social_links: [], phones: [],
    page_title: "", meta_description: "", description: "",
    services: [], scraped_pages: [], error: null,
  };
  if (!websiteUrl) return result;

  const classification = classifyUrl(websiteUrl);
  if (classification.type === "social") {
    result.social_links.push({ platform: classification.platform, url: classification.url });
    return result;
  }
  if (classification.type === "ignore") return result;

  const MAX_PAGES    = 4;   // max pages crawlées par site
  const crawledUrls  = new Set();
  const allEmails    = new Set();
  const allPhones    = new Set();
  const allSocials   = new Map(); // platform → url
  let   combinedText = "";

  let page;
  try {
    const origin = new URL(websiteUrl).origin;

    // ── Fonction helper : scraper une page ───────────────────────────────
    const scrapePage = async (url) => {
      if (crawledUrls.has(url) || crawledUrls.size >= MAX_PAGES) return null;
      crawledUrls.add(url);

      let pg;
      try {
        pg = await context.newPage();
        await pg.route("**/*", route => {
          const t = route.request().resourceType();
          if (["image", "media", "font", "stylesheet"].includes(t)) return route.abort();
          return route.continue();
        });
        await pg.goto(url, { waitUntil: "domcontentloaded", timeout: WEBSITE_SCRAPE_TIMEOUT });
        await sleep(1000);

        // Titre et meta
        const pageTitle = await pg.title().catch(() => "");
        const metaDesc  = await pg.$eval(
          'meta[name="description"], meta[property="og:description"]',
          el => el.getAttribute("content") || ""
        ).catch(() => "");

        // Texte brut
        const rawText = await pg.evaluate(() => {
          ["script","style","noscript","nav","svg"].forEach(t =>
            document.querySelectorAll(t).forEach(el => el.remove())
          );
          return document.body?.innerText || "";
        }).catch(() => "");
        const cleanedText = cleanText(rawText).substring(0, MAX_TEXT_CHARS);
        combinedText += "\n" + cleanedText;

        // ── Emails ── méthodes multiples ─────────────────────────────────
        // 1. Liens mailto:
        const mailtoLinks = await pg.$$eval('a[href^="mailto:"]',
          els => els.map(el => el.href.replace("mailto:", "").split("?")[0].trim())
        ).catch(() => []);

        // 2. Regex sur tout le texte
        const emailsText = extractEmailsFromText(cleanedText + " " + metaDesc);

        // 3. Regex sur le HTML brut (parfois obfusqué)
        const htmlContent = await pg.content().catch(() => "");
        const emailsHtml = extractEmailsFromText(
          htmlContent.replace(/(<([^>]+)>)/gi, " ")
        );

        for (const e of [...mailtoLinks, ...emailsText, ...emailsHtml]) {
          if (isValidEmail(e)) allEmails.add(e.toLowerCase().trim());
        }

        // ── Téléphones ── méthodes multiples ─────────────────────────────
        // 1. Liens tel:
        const telLinks = await pg.$$eval('a[href^="tel:"]',
          els => els.map(el => el.href.replace("tel:", "").trim())
        ).catch(() => []);

        // 2. Regex sur texte + meta
        const phonesText = extractPhonesFromText(cleanedText + " " + metaDesc);

        // 3. Attributs data-phone, data-tel
        const dataPhones = await pg.$$eval('[data-phone], [data-tel], [itemprop="telephone"]',
          els => els.map(el => el.getAttribute("data-phone") || el.getAttribute("data-tel") || el.textContent || "").filter(Boolean)
        ).catch(() => []);

        // 4. Schema.org JSON-LD
        const jsonLdPhones = await pg.evaluate(() => {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          const phones = [];
          for (const s of scripts) {
            try {
              const data = JSON.parse(s.textContent || "");
              const findPhone = (obj) => {
                if (!obj || typeof obj !== "object") return;
                if (obj.telephone) phones.push(obj.telephone);
                if (obj.phone) phones.push(obj.phone);
                Object.values(obj).forEach(v => { if (typeof v === "object") findPhone(v); });
              };
              findPhone(data);
            } catch (_) {}
          }
          return phones;
        }).catch(() => []);

        for (const p of [...telLinks, ...phonesText, ...dataPhones, ...jsonLdPhones]) {
          const cleaned = cleanPhone(String(p));
          if (isValidPhone(cleaned)) allPhones.add(cleaned);
        }

        // ── Réseaux sociaux ───────────────────────────────────────────────
        const allLinks = await pg.$$eval("a[href]",
          els => els.map(el => el.href).filter(Boolean)
        ).catch(() => []);
        for (const link of allLinks) {
          const c = classifyUrl(link);
          if (c.type === "social" && !allSocials.has(c.platform)) {
            allSocials.set(c.platform, c.url);
          }
        }

        // Retourner les infos de cette page + les liens internes trouvés
        return {
          title: pageTitle,
          meta:  metaDesc,
          internalLinks: allLinks.filter(l => {
            try {
              return new URL(l).origin === origin && l !== url;
            } catch { return false; }
          }),
        };
      } catch (err) {
        return { error: err.message };
      } finally {
        if (pg) await pg.close().catch(() => {});
      }
    };

    // ── Phase 1 : page d'accueil ─────────────────────────────────────────
    const homePage = await scrapePage(websiteUrl);
    if (homePage) {
      result.page_title       = homePage.title || "";
      result.meta_description = homePage.meta  || "";
      result.scraped_pages.push(websiteUrl);

      // ── Phase 2 : pages contact/about/réservation ──────────────────────
      if (homePage.internalLinks) {
        // Trier les liens par pertinence (contact > about > réservation > autres)
        const priorityLinks = homePage.internalLinks
          .filter(l => CONTACT_PATH_KEYWORDS.some(kw =>
            l.toLowerCase().includes(kw)
          ))
          .slice(0, MAX_PAGES - 1);

        for (const link of priorityLinks) {
          if (crawledUrls.size >= MAX_PAGES) break;
          await scrapePage(link);
          result.scraped_pages.push(link);
          await sleep(600);
        }
      }
    }

    // ── Résultats finaux ─────────────────────────────────────────────────
    result.emails      = [...allEmails].slice(0, 10);
    result.phones      = [...allPhones].slice(0, 10);
    result.social_links = [...allSocials.entries()].map(([platform, url]) => ({ platform, url }));
    result.raw_text    = cleanText(combinedText).substring(0, MAX_TEXT_CHARS);
    result.services    = extractServicesFromText(result.raw_text);
    result.description = buildDescription(result.meta_description, result.raw_text);

  } catch (err) {
    result.error = err.message;
  }

  return result;
}

// ─── Extraction fiche Maps principale ────────────────────────────────────────
async function extractFicheDetail(page, ficheUrl) {
  const detail = {
    name:"", category:"", address:"", phone:"", phone_all:[],
    website_raw:"", rating:null, review_count:null,
    hours_text:"", is_open_now:null, price_level:"",
    description:"", place_id:"", maps_url:ficheUrl,
    photos_count:0, emails_maps:[],
    about: null,
    lat: null, lng: null,
    extra_data: {},
  };

  try {
    await page.goto(ficheUrl, { waitUntil:"domcontentloaded", timeout:30000 });
    await sleep(2500);
    await page.waitForSelector("h1", { timeout:10000 }).catch(() => {});
    await page.screenshot({ path: `debug_${Date.now()}.png` }).catch(()=>{});

    detail.name = await page.$eval("h1", el => el.textContent?.trim()||"").catch(()=>"");

    detail.category = await page.$eval(
      'button[jsaction*="category"], .DkEaL, [data-item-id*="category"] span',
      el => el.textContent?.trim()||""
    ).catch(()=>"");

    detail.address = await page.$eval(
      'button[data-item-id="address"] .Io6YTe, [data-item-id="address"] .fontBodyMedium',
      el => el.textContent?.trim()||""
    ).catch(()=>"");

    // ── Téléphone(s) depuis Google Maps ──────────────────────────────────
    // Méthode 1 : bouton téléphone standard
    for (const sel of [
      'button[data-item-id*="phone"] .Io6YTe',
      'button[data-tooltip*="numéro"] .Io6YTe',
      'button[data-tooltip*="phone"] .Io6YTe',
      '[data-item-id*="phone"] span.fontBodyMedium',
      'a[href^="tel:"]',
    ]) {
      const p = await page.$eval(sel, el =>
        el.tagName==="A" ? el.href.replace("tel:","") : el.textContent?.trim()||""
      ).catch(()=>"");
      if (p && isValidPhone(cleanPhone(p))) {
        detail.phone = cleanPhone(p);
        break;
      }
    }

    // Méthode 2 : scan de tous les data-item-id contenant "phone"
    const allPhoneEls = await page.$$('[data-item-id*="phone"], [data-item-id*="tel"]').catch(()=>[]);
    for (const el of allPhoneEls) {
      const txt = await el.textContent().catch(()=>"");
      const cleaned = cleanPhone(txt);
      if (isValidPhone(cleaned) && !detail.phone_all.includes(cleaned)) {
        detail.phone_all.push(cleaned);
      }
    }
    if (!detail.phone && detail.phone_all.length > 0) detail.phone = detail.phone_all[0];

    // ── Site web (Méthode 1: boutons officiels) ──────────────────────────
    const websiteSelectors = [
      'a[data-item-id="authority"]',
      'a[data-tooltip="Ouvrir le site Web"]',
      'a[data-tooltip*="site"]',
      'a[data-item-id*="website"]',
    ];
    for (const sel of websiteSelectors) {
      const href = await page.$eval(sel, el => el.href||"").catch(()=>"");
      if (href) {
        const resolved = extractRealUrl(href);
        if (resolved && !resolved.includes("google.com/maps")) {
          detail.website_raw = resolved; break;
        }
      }
    }

    // ── Site web (Méthode 2: Section "Résultats Web" via recherche forçée) ──────
    if (!detail.website_raw && detail.name) {
      // Pour forcer l'affichage de "Résultats Web" (masqué en accès direct depuis l'URL /place/), on simule une recherche
      const searchQuery = encodeURIComponent(`${detail.name} ${detail.address || ''}`);
      const searchUrl = `https://www.google.com/maps/search/${searchQuery}`;
      
      try {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await sleep(3000);

        // Scroll progressif dans le panneau latéral
        for (let i = 0; i < 6; i++) {
          await page.evaluate(() => {
            const sb = document.querySelector('.m6QErb[role="main"]') || document.querySelector('.m6QErb[aria-label]') || document.querySelector('.DxyBCb');
            if (sb) sb.scrollBy(0, 400);
          }).catch(()=>{});
          await sleep(1000);
        }
        await sleep(2500); // Attendre la disparition des squelettes de chargement dynamiques

        const webLinks = await page.$$eval('a', links => links.map(l => {
          let u = l.getAttribute('href') || l.getAttribute('data-url');
          if (u && u.startsWith('/url?q=')) u = decodeURIComponent(u.replace('/url?q=', '').split('&')[0]);
          return u || '';
        }).filter(u => u.startsWith('http')));

        for (const link of webLinks) {
          const resolved = extractRealUrl(link);
          const classification = classifyUrl(resolved);
          
          if (classification.type === "website" && !detail.website_raw) {
              detail.website_raw = resolved;
          } else if (classification.type === "social") {
              if (!detail.extra_data.social) detail.extra_data.social = [];
              if (!detail.extra_data.social.includes(resolved)) detail.extra_data.social.push(resolved);
          }
        }
      } catch (err) {
        // Ignorer les erreurs silencieuses du fallback
      }
    }

    // ── Note et avis ─────────────────────────────────────────────────────
    detail.rating = await page.$eval(
      'div.F7nice span[aria-hidden="true"], span.MW4etd',
      el => parseFloat(el.textContent?.trim()||"0")||null
    ).catch(()=>null);

    detail.review_count = await page.$eval(
      'span.UY7F9, button[jsaction*="review"] span',
      el => { const n=(el.textContent?.trim()||"").replace(/[^\d]/g,""); return n?parseInt(n):null; }
    ).catch(()=>null);

    detail.is_open_now = await page.$eval(
      'span.ZDu9vd, [data-item-id*="oh"] span',
      el => {
        const t = el.textContent?.toLowerCase()||"";
        if (t.includes("ouvert")||t.includes("open")) return true;
        if (t.includes("fermé")||t.includes("closed")) return false;
        return null;
      }
    ).catch(()=>null);

    // ── Horaires ─────────────────────────────────────────────────────────
    detail.hours_text = await page.evaluate(() => {
      const table = document.querySelector("table.WgFkxc");
      if (table) {
        return Array.from(table.querySelectorAll("tr")).map(row =>
          Array.from(row.querySelectorAll("th,td")).map(c=>c.textContent?.trim()).filter(Boolean).join(": ")
        ).filter(Boolean).join(" | ");
      }
      const div = document.querySelector('div[aria-label*="Horaires"]');
      return div?.textContent?.trim().replace(/\s+/g," ") || "";
    }).catch(()=>"");

    // Tenter d'ouvrir les horaires détaillés
    const expandHours = page.locator('[data-item-id*="oh"], button[aria-label*="Horaires"], button[aria-label*="hours"]').first();
    if (await expandHours.isVisible({ timeout:1000 }).catch(()=>false)) {
      await expandHours.click().catch(()=>{});
      await sleep(600);
      const expanded = await page.evaluate(() => {
        const table = document.querySelector("table.WgFkxc");
        if (table) {
          return Array.from(table.querySelectorAll("tr")).map(row =>
            Array.from(row.querySelectorAll("th,td")).map(c=>c.textContent?.trim()).filter(Boolean).join(": ")
          ).filter(Boolean).join(" | ");
        }
        return "";
      }).catch(()=>"");
      if (expanded) detail.hours_text = expanded;
    }

    detail.price_level = await page.$eval('span.mgr77e', el=>el.textContent?.trim()||"").catch(()=>"");

    // ── Description ───────────────────────────────────────────────────────
    for (const sel of ['div.PYvSYb', 'div[data-attrid*="description"] span', '.gm2imf span']) {
      const d = await page.$eval(sel, el => cleanText(el.textContent||"")).catch(()=>"");
      if (d && d.length > 10) { detail.description = d; break; }
    }

    // ── Emails sur la page Maps principale ────────────────────────────────
    const pageText = await page.$eval("body", el=>el.innerText||"").catch(()=>"");
    detail.emails_maps = extractEmailsFromText(pageText);

    // ── Données extra data-item-id ────────────────────────────────────────
    detail.extra_data = await page.evaluate(() => {
      const items = {};
      document.querySelectorAll("[data-item-id]").forEach(el => {
        const id  = el.getAttribute("data-item-id");
        const val = el.textContent?.trim();
        if (id && val && val.length < 200 && !id.includes("photo") && !id.includes("review"))
          items[id] = val;
      });
      return items;
    }).catch(()=>({}));

    // ── Coordonnées GPS ───────────────────────────────────────────────────
    try {
      const cu = page.url();
      const coordMatch = cu.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) { detail.lat = parseFloat(coordMatch[1]); detail.lng = parseFloat(coordMatch[2]); }
      const m1 = cu.match(/!1s([^!]+)/);
      if (m1) detail.place_id = decodeURIComponent(m1[1]);
      if (!detail.place_id) {
        const m2 = cu.match(/0x[0-9a-f]+:0x[0-9a-f]+/i);
        if (m2) detail.place_id = m2[0];
      }
    } catch (_) {}

    detail.photos_count = await page.$$eval(
      'button[jsaction*="photo"], div[data-photo-index]', els=>els.length
    ).catch(()=>0);

    // ── Onglet "À propos" — extraction complète ───────────────────────────
    detail.about = await extractAboutTab(page);

  } catch (err) { detail._error = err.message; }
  return detail;
}

// ─── Scrape liste de résultats ────────────────────────────────────────────────
async function scrapeResultList(page, searchQuery, maxResults) {
  emit("PROGRESS", { percentage:5, message:"Ouverture de Google Maps..." });
  await page.goto(
    `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`,
    { waitUntil:"domcontentloaded", timeout:30000 }
  );
  await sleep(2500);

  // Accepter les cookies si nécessaire
  const cookieBtn = page.locator(
    'button:has-text("Tout accepter"), button:has-text("Accept all"), button:has-text("Accepter tout")'
  );
  if (await cookieBtn.isVisible({ timeout:3000 }).catch(()=>false)) {
    await cookieBtn.first().click(); await sleep(1000);
  }

  emit("PROGRESS", { percentage:10, message:`Chargement des résultats pour "${searchQuery}"...` });
  await page.waitForSelector('[role="feed"], .Nv2PK, .hfpxzc', { timeout:15000 }).catch(()=>{});
  await sleep(1500);

  const ficheUrls    = new Set();
  let   scrollAttempts    = 0;
  const maxScrollAttempts = Math.ceil(maxResults / 5) + 5;

  while (ficheUrls.size < maxResults && scrollAttempts < maxScrollAttempts) {
    if (isCancelled()) break;
    const urls = await page.$$eval(
      'a.hfpxzc[href*="/maps/place/"], a[href*="/maps/place/"]',
      els => els.map(el=>el.href).filter(Boolean)
    ).catch(()=>[]);
    for (const u of urls) {
      if (ficheUrls.size >= maxResults) break;
      try { ficheUrls.add(u.split("?")[0]); } catch { ficheUrls.add(u); }
    }
    if (await page.$("span.HlvSq").catch(()=>null)) break;

    const loadMore = page.locator('button:has-text("Voir plus"), button:has-text("More results")');
    if (await loadMore.isVisible({ timeout:1000 }).catch(()=>false)) {
      await loadMore.click(); await sleep(SCROLL_DELAY);
    } else {
      await page.evaluate(()=>{
        const p = document.querySelector('[role="feed"]')
          || document.querySelector('.m6QErb[aria-label]')
          || document.querySelector(".DxyBCb");
        if (p) p.scrollBy(0, 600);
      });
      await sleep(SCROLL_DELAY);
    }
    scrollAttempts++;
    emit("PROGRESS", {
      percentage: Math.min(10 + Math.round((ficheUrls.size/maxResults)*20), 30),
      message: `${ficheUrls.size} établissements trouvés...`,
    });
  }
  return [...ficheUrls];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!SEARCH_QUERY.trim()) {
    emit("ERROR", { message:"Requête vide. Fournissez au moins un mot-clé." });
    process.exit(1);
  }

  emit("PROGRESS", { percentage:2, message:"Démarrage — extraction contacts + À propos renforcée" });

  const sessionDir = [
    path.join(__dirname, 'gmaps_session'),
    path.resolve(__dirname, '..', 'Maj', 'gmaps_session'),
    path.resolve(__dirname, '..', 'gmaps_session')
  ].find(d => fs.existsSync(d) && fs.readdirSync(d).length > 0) || path.join(__dirname, 'gmaps_session');

  const hasSession = fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0;
  let browser, context;

  if (hasSession) {
    emit("PROGRESS", { percentage:3, message:"Utilisation du profil Google Maps persistant..." });
    browser = await chromium.launchPersistentContext(sessionDir, {
      headless: false,
      args: [
        "--no-sandbox","--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars","--start-maximized",
      ],
      viewport: { width:1440, height:900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale:"fr-FR", timezoneId:"Europe/Paris",
      extraHTTPHeaders: { "Accept-Language":"fr-FR,fr;q=0.9,en;q=0.8" },
    });
    context = browser;
  } else {
    emit("PROGRESS", { percentage:3, message:"Mode incognito (session non trouvée)..." });
    const standaloneBrowser = await chromium.launch({
      headless: false,
      args: [
        "--no-sandbox","--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars","--start-maximized",
      ],
    });
    context = await standaloneBrowser.newContext({
      userAgent: randomUA(), locale:"fr-FR", timezoneId:"Europe/Paris",
      viewport: { width:1440, height:900 },
      extraHTTPHeaders: { "Accept-Language":"fr-FR,fr;q=0.9,en;q=0.8" },
    });
    browser = standaloneBrowser;
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator,"webdriver",{ get:()=>undefined });
    Object.defineProperty(navigator,"plugins",  { get:()=>[1,2,3,4,5] });
    window.chrome = { runtime:{} };
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // ── Vérification LOGIN (Logic Maj) ──────────────────────────────────────────
  emit("PROGRESS", { percentage:4, message:"Vérification de la connexion Google..." });
  await page.goto("https://www.google.fr/maps", { waitUntil:"domcontentloaded" });
  await sleep(2000);

  const isGuest = await page.locator('a[href*="accounts.google.com/ServiceLogin"]').isVisible({ timeout:5000 }).catch(()=>false);
  if (isGuest) {
    emit("PROGRESS", { percentage:4, message:"⚠️ Non connecté. Veuillez vous connecter dans la fenêtre Chromium." });
    console.log("\n[ACTION REQUISE] Veuillez vous connecter à votre compte Google dans le navigateur ouvert.");
    console.log("[ACTION REQUISE] Une fois connecté, appuyez sur ENTRÉE dans ce terminal pour continuer...\n");
    await new Promise(resolve => process.stdin.once('data', resolve));
    emit("PROGRESS", { percentage:5, message:"Connexion détectée, reprise du scrap..." });
  } else {
    emit("PROGRESS", { percentage:5, message:"Session Google active ✅" });
  }

  const results = [];

  try {
    // Phase 1 : récupération des URLs
    const listPage = await context.newPage();
    const ficheUrls = await scrapeResultList(listPage, SEARCH_QUERY, MAX_RESULTS);
    await listPage.close();

    emit("PROGRESS", { percentage:32, message:`${ficheUrls.length} fiches à analyser...` });
    if (ficheUrls.length === 0) {
      emit("ERROR", { message:`Aucun résultat pour "${SEARCH_QUERY}"` });
      await browser.close(); process.exit(0);
    }

    // Phase 2 : traitement de chaque fiche
    for (let i = 0; i < ficheUrls.length; i++) {
      if (isCancelled()) {
        emit("PROGRESS", { percentage:null, message:"Annulé." }); break;
      }

      const url = ficheUrls[i];
      const pct = 32 + Math.round(((i+1)/ficheUrls.length)*65);

      // ── 2a. Fiche Maps + onglet À propos ───────────────────────────────
      emit("PROGRESS", { percentage:pct, message:`Fiche ${i+1}/${ficheUrls.length} — Maps + À propos...` });
      const fichePage = await context.newPage();
      let detail;
      try {
        detail = await extractFicheDetail(fichePage, url);
      } finally {
        await fichePage.close().catch(()=>{});
      }
      if (!detail || !detail.name) continue;

      // ── 2b. Site web (scraping multi-pages) ────────────────────────────
      const mapsWC        = classifyUrl(detail.website_raw);
      let websiteUrl      = "";
      let mapsExtraSocial = [];
      if      (mapsWC.type === "website") websiteUrl = mapsWC.url;
      else if (mapsWC.type === "social")  mapsExtraSocial = [{ platform:mapsWC.platform, url:mapsWC.url }];

      let websiteData = {
        raw_text:"", emails:[], social_links:[], phones:[],
        page_title:"", meta_description:"", description:"",
        services:[], scraped_pages:[], error:null,
      };

      if (websiteUrl) {
        emit("PROGRESS", { percentage:pct, message:`Fiche ${i+1}/${ficheUrls.length} — Site web (contacts)...` });
        websiteData = await scrapeWebsite(context, websiteUrl);
      }

      // ── 2c. Fusion et déduplication des contacts ────────────────────────
      // EMAILS — toutes les sources confondues
      const allEmailSources = [
        ...websiteData.emails,
        ...(detail.emails_maps || []),
        ...(detail.about?.emails_found || []),
      ];
      const uniqueEmails = [...new Set(allEmailSources.map(e => e.toLowerCase().trim()).filter(isValidEmail))];

      // TÉLÉPHONES — toutes les sources confondues
      const allPhoneSources = [
        ...(detail.phone ? [detail.phone] : []),
        ...(detail.phone_all || []),
        ...websiteData.phones,
        ...(detail.about?.phones_found || []),
      ];
      const uniquePhones = [...new Set(allPhoneSources.map(p => cleanPhone(p)).filter(isValidPhone))];

      // RÉSEAUX SOCIAUX
      const allSocialLinks = [...websiteData.social_links];
      for (const s of mapsExtraSocial) {
        if (!allSocialLinks.find(x => x.platform === s.platform)) allSocialLinks.push(s);
      }

      const finalDescription = cleanPlatformDescription(
        detail.description || websiteData.meta_description || websiteData.description || ""
      );

      // ── 2d. Construction du prospect final ─────────────────────────────
      const prospect = {
        id:      `gmaps_${Date.now()}_${i}`,
        source:  "google_maps",
        name:    detail.name,
        company: detail.name,
        title:   detail.category || "Établissement",

        // ── CONTACTS (priorité absolue) ──
        email:       uniqueEmails[0] || "",
        emails_all:  uniqueEmails,
        phone:       uniquePhones[0] || "",
        phones_all:  uniquePhones,

        // Sources des contacts (pour audit)
        email_sources: {
          from_website:    websiteData.emails.filter(isValidEmail),
          from_maps_page:  (detail.emails_maps || []).filter(isValidEmail),
          from_about_tab:  (detail.about?.emails_found || []).filter(isValidEmail),
        },
        phone_sources: {
          from_maps:       detail.phone ? [detail.phone] : [],
          from_maps_all:   detail.phone_all || [],
          from_website:    websiteData.phones,
          from_about_tab:  detail.about?.phones_found || [],
        },

        website:         websiteUrl || "",
        website_display: websiteUrl ? websiteUrl.replace(/^https?:\/\/(www\.)?/,"") : "",
        address:         detail.address || "",
        social_links:    allSocialLinks,

        sector:      detail.category || "",
        description: finalDescription,
        services:    websiteData.services,

        // ── Google Maps stats ──
        rating:        detail.rating,
        review_count:  detail.review_count,
        is_open_now:   detail.is_open_now,
        hours:         parseHours(detail.hours_text),
        hours_raw:     detail.hours_text || "",
        price_level:   detail.price_level || "",
        photos_count:  detail.photos_count || 0,

        // ── Coordonnées GPS ──
        lat: detail.lat || null,
        lng: detail.lng || null,

        // ── Onglet À propos complet ──
        about: detail.about || null,

        // ── Données brutes data-item-id ──
        maps_extra_data: detail.extra_data || {},

        // ── Site web scrapé ──
        website_title:         websiteData.page_title || "",
        website_meta:          websiteData.meta_description || "",
        website_scraped_pages: websiteData.scraped_pages,
        website_scrape_error:  websiteData.error || null,

        place_id:    detail.place_id || "",
        maps_url:    detail.maps_url || url,
        scraped_at:  new Date().toISOString(),
        userId:      USER_ID || null,

        completeness_score: 0,
      };

      // ── Score de complétude ───────────────────────────────────────────
      let score = 0;
      if (prospect.name)                                            score += 10;
      if (prospect.phone)                                           score += 20;
      if (prospect.phones_all.length > 1)                          score += 5;   // bonus multi-téléphone
      if (prospect.website)                                         score += 15;
      if (prospect.email)                                           score += 25;
      if (prospect.emails_all.length > 1)                          score += 5;   // bonus multi-email
      if (prospect.address)                                         score += 10;
      if (prospect.sector)                                          score += 5;
      if (prospect.rating)                                          score += 3;
      if (prospect.description)                                     score += 3;
      if (prospect.services.length)                                 score += 3;
      if (prospect.social_links.length)                             score += 2;
      if (prospect.lat)                                             score += 2;
      if (prospect.about && (
        prospect.about.commodites.length > 0 ||
        prospect.about.services.length > 0   ||
        prospect.about.autres.length > 0
      ))                                                            score += 5;
      if (prospect.website_scraped_pages.length > 1)               score += 3;   // bonus multi-pages
      prospect.completeness_score = Math.min(score, 100);

      results.push(prospect);
      emit("RESULT", prospect);

      // Sauvegarde au fil de l'eau (sécurité anti-crash)
      try {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf-8");
      } catch (_) {}

      await sleep(DELAY_BETWEEN_FICHES);
    }

  } finally {
    await browser.close();
  }

  // Sauvegarde finale
  try { fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf-8"); } catch (_) {}

  emit("PROGRESS", { percentage:100, message:`Terminé. ${results.length} établissements extraits.` });
  emit("DONE", {
    total:              results.length,
    query:              SEARCH_QUERY,
    with_phone:         results.filter(r => r.phone).length,
    with_real_website:  results.filter(r => r.website).length,
    with_social_only:   results.filter(r => !r.website && r.social_links.length > 0).length,
    with_email:         results.filter(r => r.email).length,
    with_multi_email:   results.filter(r => r.emails_all.length > 1).length,
    with_multi_phone:   results.filter(r => r.phones_all.length > 1).length,
    avg_score:          results.length
      ? Math.round(results.reduce((s,r)=>s+r.completeness_score,0)/results.length)
      : 0,
  });

  process.exit(0);
}

main().catch(err => {
  emit("ERROR", { message:`Erreur fatale : ${err.message}` });
  process.exit(1);
});
