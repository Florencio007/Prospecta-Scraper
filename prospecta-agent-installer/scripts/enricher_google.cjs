/**
 * enricher_google.cjs
 * Script d'enrichissement Playwright pour Prospecta AI
 *
 * Usage : node enricher_google.cjs --prospects='[{...}]'
 *
 * Communication avec le backend via stdout :
 *   PROGRESS:{"percentage": 50, "message": "..."}
 *   RESULT:{...}    → prospect enrichi
 *   ERROR:{"id":"...","message":"..."}
 *   DONE:{"enriched": 7, "skipped": 2}
 */

"use strict";

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// Arguments: --prospects='...' --openai-key='...'
const args = process.argv.slice(2);
const openaiKeyArg = args.find(a => a.startsWith('--openai-key='));
const OPENAI_API_KEY = openaiKeyArg ? openaiKeyArg.replace('--openai-key=', '') : null;

// ─── Config ──────────────────────────────────────────────────────────────────
const CANCEL_LOCK = path.join(__dirname, "cancel_scrape.lock");
const MAX_SEARCHES_PER_PROSPECT = 3; // max requêtes Google par fiche
const DELAY_BETWEEN_SEARCHES_MS = [1800, 3500]; // délai aléatoire [min, max]
const DELAY_BETWEEN_PROSPECTS_MS = [2000, 4000];

// User-agents réalistes rotatifs
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function randomDelay(range) {
  const [min, max] = range;
  return new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min)
  );
}

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function isCancelled() {
  return fs.existsSync(CANCEL_LOCK);
}

function emit(type, payload) {
  console.log(`${type}:${JSON.stringify(payload)}`);
}

/**
 * Détermine quels champs sont manquants et nécessitent une recherche Google
 */
function getMissingFields(prospect) {
  const missing = [];
  if (!prospect.email || prospect.email === "") missing.push("email");
  if (!prospect.website || prospect.website === "") missing.push("website");
  if (!prospect.phone || prospect.phone === "") missing.push("phone");
  if (!prospect.sector || prospect.sector === "") missing.push("sector");
  return missing;
}

/**
 * Construit la requête Google selon le champ manquant
 */
function buildQuery(prospect, field) {
  const company = prospect.company || prospect.name || "";
  const city = prospect.city || "";

  switch (field) {
    case "email":
      if (prospect.website) {
        return `"${company}" email contact site:${prospect.website}`;
      }
      return `"${company}" "${city}" email contact`;

    case "website":
      return `"${company}" "${city}" site officiel`;

    case "phone":
      return `"${company}" "${city}" téléphone contact`;

    case "sector":
      return `"${company}" activité secteur métier`;

    default:
      return `"${company}" "${city}"`;
  }
}

// ─── Extracteurs par champ ────────────────────────────────────────────────────

/**
 * Tente d'extraire un email depuis la page Google
 * Cherche dans : Knowledge Panel, snippets, premier résultat
 */
async function extractEmail(page) {
  // 1. Knowledge Panel
  const kpText = await page
    .$eval("#rhs", (el) => el.innerText)
    .catch(() => "");
  const emailFromKP = kpText.match(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
  );
  if (emailFromKP) return { value: emailFromKP[0], source: "google_knowledge_panel", confidence: "high" };

  // 2. Snippets de résultats
  const snippets = await page
    .$$eval(".VwiC3b", (els) => els.map((e) => e.innerText))
    .catch(() => []);
  for (const s of snippets) {
    const match = s.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if (match && !match[0].includes("example")) {
      return { value: match[0], source: "google_snippet", confidence: "medium" };
    }
  }

  return null;
}

/**
 * Tente d'extraire un site web depuis la page Google
 */
async function extractWebsite(page) {
  // 1. Premier résultat organique — URL affichée
  const firstUrl = await page
    .$eval(".yuRUbf a", (el) => el.href)
    .catch(() => null);

  if (firstUrl) {
    // Filtrer les annuaires connus
    const annuaires = ["pagesjaunes", "societe.com", "verif.com", "manageo", "linkedin", "facebook", "twitter"];
    const isAnnuaire = annuaires.some((a) => firstUrl.includes(a));
    if (!isAnnuaire) {
      try {
        const domain = new URL(firstUrl).hostname.replace("www.", "");
        return { value: domain, source: "google_first_result", confidence: "medium" };
      } catch {
        // URL invalide, continuer
      }
    }
  }

  // 2. Knowledge Panel — site web
  const kpLinks = await page
    .$$eval("#rhs a[href]", (els) => els.map((e) => e.href))
    .catch(() => []);
  for (const link of kpLinks) {
    if (link.startsWith("http") && !link.includes("google")) {
      try {
        const domain = new URL(link).hostname.replace("www.", "");
        return { value: domain, source: "google_knowledge_panel", confidence: "high" };
      } catch {
        // continuer
      }
    }
  }

  return null;
}

/**
 * Tente d'extraire un téléphone depuis la page Google
 */
async function extractPhone(page) {
  // 1. Knowledge Panel Google My Business
  const kpText = await page
    .$eval("#rhs", (el) => el.innerText)
    .catch(() => "");

  const phonePatterns = [
    /(?:\+33|0033|0)[1-9](?:[.\-\s]?\d{2}){4}/g, // France
    /(?:\+261|0)[23][0-9](?:[.\-\s]?\d{2}){3}/g,  // Madagascar
    /\+?[\d\s.\-()]{10,15}/g,                       // International générique
  ];

  for (const pattern of phonePatterns) {
    const match = kpText.match(pattern);
    if (match) {
      return { value: match[0].trim(), source: "google_knowledge_panel", confidence: "high" };
    }
  }

  // 2. Snippets
  const snippets = await page
    .$$eval(".VwiC3b", (els) => els.map((e) => e.innerText))
    .catch(() => []);

  for (const s of snippets) {
    for (const pattern of phonePatterns) {
      const match = s.match(pattern);
      if (match) {
        return { value: match[0].trim(), source: "google_snippet", confidence: "medium" };
      }
    }
  }

  return null;
}

/**
 * Tente d'extraire le secteur d'activité depuis la page Google
 */
async function extractSector(page) {
  // Knowledge Panel — catégorie
  const kpText = await page
    .$eval("#rhs", (el) => el.innerText)
    .catch(() => "");

  // Patterns courants dans le KP Google My Business
  const sectorPatterns = [
    /(?:Secteur|Secteur d'activité|Catégorie|Type)\s*[:\-]\s*(.+)/i,
    /(?:Industry|Category)\s*[:\-]\s*(.+)/i,
  ];

  for (const pattern of sectorPatterns) {
    const match = kpText.match(pattern);
    if (match) {
      return { value: match[1].trim(), source: "google_knowledge_panel", confidence: "high" };
    }
  }

  // Premier snippet — première phrase
  const firstSnippet = await page
    .$eval(".VwiC3b", (el) => el.innerText)
    .catch(() => "");

  if (firstSnippet && firstSnippet.length > 10) {
    const sentence = firstSnippet.split(".")[0].trim();
    if (sentence.length > 5 && sentence.length < 120) {
      return { value: sentence, source: "google_snippet", confidence: "low" };
    }
  }

  return null;
}

// ─── Enrichissement d'un prospect ────────────────────────────────────────────

async function enrichProspect(page, prospect) {
  const missingFields = getMissingFields(prospect);
  if (missingFields.length === 0) return prospect; // Rien à enrichir

  // Limiter au max de recherches autorisées
  const fieldsToSearch = missingFields.slice(0, MAX_SEARCHES_PER_PROSPECT);
  const enriched = { ...prospect, enrichment_log: [] };

  for (const field of fieldsToSearch) {
    if (isCancelled()) break;

    const query = buildQuery(prospect, field);

    emit("PROGRESS", {
      percentage: null, // géré par le backend
      message: `Recherche Google : "${query}"`,
      current_prospect_id: prospect.id,
      current_field: field,
    });

    try {
      // Navigation Google
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=fr&gl=fr`,
        { waitUntil: "domcontentloaded", timeout: 15000 }
      );

      // Accepter cookies si popup présente
      const cookieBtn = page.locator("button:has-text('Tout accepter'), button:has-text('Accept all')");
      if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cookieBtn.click();
        await page.waitForTimeout(500);
      }

      // Vérifier blocage Google (CAPTCHA)
      const pageTitle = await page.title();
      if (pageTitle.includes("unusual traffic") || pageTitle.includes("robot")) {
        emit("ERROR", {
          id: prospect.id,
          message: "Google a détecté un comportement automatique. Enrichissement suspendu.",
        });
        break; // Arrêter pour ce prospect
      }

      // Extraction selon le champ
      let result = null;
      switch (field) {
        case "email":   result = await extractEmail(page);   break;
        case "website": result = await extractWebsite(page); break;
        case "phone":   result = await extractPhone(page);   break;
        case "sector":  result = await extractSector(page);  break;
      }

      if (result) {
        enriched[field] = result.value;
        enriched[`${field}_source`] = result.source;
        enriched[`${field}_confidence`] = result.confidence;
        enriched[`${field}_guessed`] = false;
        enriched.enrichment_log.push({
          field,
          value: result.value,
          source: result.source,
          confidence: result.confidence,
          query,
          snippets: snippets.slice(0, 3) // Store snippets for AI review
        });
      } else {
        // Fallback : marquer comme non trouvé
        enriched[`${field}_source`] = "not_found";
        enriched[`${field}_confidence`] = null;
        enriched.enrichment_log.push({
          field,
          value: null,
          source: "not_found",
          query,
        });
      }
    } catch (err) {
      enriched.enrichment_log.push({
        field,
        value: null,
        source: "error",
        error: err.message,
        query,
      });
    }

    // Délai anti-détection entre chaque recherche
    await randomDelay(DELAY_BETWEEN_SEARCHES_MS);
  }

  // Fallback email par pattern si toujours manquant et site trouvé
  if (!enriched.email && enriched.website) {
    const firstName = (prospect.firstName || "").toLowerCase().replace(/\s/g, "");
    const lastName = (prospect.lastName || "").toLowerCase().replace(/\s/g, "");
    const domain = enriched.website.replace(/^www\./, "");

    if (firstName && lastName && domain) {
      enriched.email = `${firstName}.${lastName}@${domain}`;
      enriched.email_source = "pattern_inference";
      enriched.email_confidence = "low";
      enriched.email_guessed = true;
    }
  }

  // ─── AI Analysis ──────────────────────────────────────────────────────────
  if (OPENAI_API_KEY && enriched.enrichment_log.length > 0) {
    emit("PROGRESS", { percentage: null, message: `Analyse IA des informations Google...`, current_prospect_id: prospect.id });
    try {
      const allSnippets = enriched.enrichment_log
        .filter(l => l.snippets && l.snippets.length > 0)
        .map(l => l.snippets.join("\n"))
        .join("\n\n");

      if (allSnippets.trim()) {
        const aiResult = await runAIAnalysis(prospect, allSnippets);
        if (aiResult) {
          enriched.ai_intelligence = aiResult.ai_intelligence;
          if (aiResult.email && !enriched.email) enriched.email = aiResult.email;
          if (aiResult.phone && !enriched.phone) enriched.phone = aiResult.phone;
          if (aiResult.score_global) enriched.score_global = aiResult.score_global;
        }
      }
    } catch (e) {
      console.error("AI Analysis error:", e.message);
    }
  }

  return enriched;
}

/**
 * Runs OpenAI analysis on collected snippets
 */
async function runAIAnalysis(prospect, text) {
  const { default: fetch } = await import('node-fetch');
  
  const systemPrompt = `Tu es un expert en intelligence commerciale.
Analyse les snippets de recherche Google pour ${prospect.name} chez ${prospect.company || 'Inconnue'}.
Extraits une intelligence complète : décideurs, services, opportunités.
Renvoie UNIQUEMENT un JSON : { "phone": "...", "email": "...", "score_global": 0-100, "ai_intelligence": { ... } }`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: "json_object" },
      messages: [ { role: "system", content: systemPrompt }, { role: "user", content: text } ],
      temperature: 0.3
    })
  });

  if (!response.ok) return null;
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Parser les prospects depuis les arguments CLI
  let prospects = [];
  const args = process.argv.slice(2);
  const prospectsArg = args.find((a) => a.startsWith("--prospects="));

  if (prospectsArg) {
    try {
      prospects = JSON.parse(prospectsArg.replace("--prospects=", ""));
    } catch {
      emit("ERROR", { message: "Impossible de parser les prospects fournis." });
      process.exit(1);
    }
  }

  if (!prospects.length) {
    emit("ERROR", { message: "Aucun prospect à enrichir." });
    process.exit(0);
  }

  // Filtrer uniquement les fiches avec des champs manquants
  const toEnrich = prospects.filter((p) => getMissingFields(p).length > 0);
  const alreadyComplete = prospects.filter((p) => getMissingFields(p).length === 0);

  emit("PROGRESS", {
    percentage: 0,
    message: `${toEnrich.length} fiche(s) à enrichir sur ${prospects.length} total`,
    total: toEnrich.length,
  });

  // Retourner immédiatement les fiches déjà complètes
  for (const p of alreadyComplete) {
    emit("RESULT", { ...p, enrichment_status: "already_complete" });
  }

  if (toEnrich.length === 0) {
    emit("DONE", { enriched: 0, skipped: 0, already_complete: alreadyComplete.length });
    process.exit(0);
  }

  // Lancer le navigateur
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    userAgent: randomUA(),
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
  });

  // Masquer les traces d'automatisation
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();

  let enrichedCount = 0;
  let skippedCount = 0;

  try {
    for (let i = 0; i < toEnrich.length; i++) {
      if (isCancelled()) {
        emit("PROGRESS", {
          percentage: Math.round((i / toEnrich.length) * 100),
          message: "Enrichissement annulé par l'utilisateur.",
        });
        break;
      }

      const prospect = toEnrich[i];
      const percentage = Math.round(((i + 1) / toEnrich.length) * 100);

      emit("PROGRESS", {
        percentage,
        message: `Enrichissement ${i + 1}/${toEnrich.length} : ${prospect.company || prospect.name}`,
        current_index: i + 1,
        total: toEnrich.length,
      });

      try {
        const enrichedProspect = await enrichProspect(page, prospect);
        enrichedProspect.enrichment_status = "enriched";
        emit("RESULT", enrichedProspect);
        enrichedCount++;
      } catch (err) {
        skippedCount++;
        emit("ERROR", {
          id: prospect.id,
          message: `Erreur lors de l'enrichissement : ${err.message}`,
        });
        // Retourner la fiche originale non enrichie
        emit("RESULT", { ...prospect, enrichment_status: "error" });
      }

      // Délai entre chaque prospect
      if (i < toEnrich.length - 1) {
        await randomDelay(DELAY_BETWEEN_PROSPECTS_MS);
      }
    }
  } finally {
    await browser.close();
  }

  emit("DONE", {
    enriched: enrichedCount,
    skipped: skippedCount,
    already_complete: alreadyComplete.length,
    total: prospects.length,
  });

  process.exit(0);
}

main().catch((err) => {
  emit("ERROR", { message: `Erreur fatale : ${err.message}` });
  process.exit(1);
});
