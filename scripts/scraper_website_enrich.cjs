/**
 * scraper_website_enrich.cjs
 * Scrapes a website, crawls a few pages, and uses OpenAI to analyze for Prospecta AI.
 */

"use strict";

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// Arguments: websiteUrl name company openAiKey userService userValueProp userIndustry
const args = process.argv.slice(2);
const websiteUrl = args[0];
const personName = args[1] || "Inconnu";
const companyName = args[2] || "Inconnue";
const openAiKey = args[3];
const userService = args[4] || "";
const userValueProp = args[5] || "";
const userIndustry = args[6] || "";

if (!websiteUrl || !openAiKey) {
  process.stdout.write(`ERROR: websiteUrl and openAiKey are required.\n`);
  process.exit(1);
}

function emit(type, payload) {
  process.stdout.write(`${type}:${JSON.stringify(payload)}\n`);
}

async function getFetch() {
  if (globalThis.fetch) return globalThis.fetch;
  const { default: fetch } = await import('node-fetch');
  return fetch;
}

async function scrapeWebsite() {
  emit("PROGRESS", { percentage: 10, message: `Démarrage du scraping de ${websiteUrl}...` });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    const fullUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;

    emit("PROGRESS", { percentage: 20, message: `Navigation vers ${fullUrl}...` });
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      emit("PROGRESS", { percentage: 25, message: `Erreur navigation (${e.message}), tentative avec domcontentloaded...` });
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    // 1. Extract links to crawl (limit to 5 internal links)
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const base = window.location.origin;
      return anchors
        .map(a => a.href)
        .filter(href => href.startsWith(base) && !href.includes('#') && !href.includes('mailto:') && !href.includes('tel:'))
        .filter((value, index, self) => self.indexOf(value) === index) // Unique
        .slice(0, 10);
    });

    let aggregatedText = "";

    // Scrape homepage
    emit("PROGRESS", { percentage: 30, message: `Extraction du texte de la page d'accueil...` });
    const homeText = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script, style, noscript, iframe, svg, img, video, audio, nav, footer, header');
      scripts.forEach(s => s.remove());
      return document.body.innerText;
    });
    aggregatedText += `PAGE: Homepage\n${homeText}\n\n`;

    // Scrape other pages
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      emit("PROGRESS", { percentage: 30 + (i * 5), message: `Scraping page secondaire: ${link}...` });
      try {
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const pageText = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script, style, noscript, iframe, svg, img, video, audio, nav, footer, header');
          scripts.forEach(s => s.remove());
          return document.body.innerText;
        });
        aggregatedText += `PAGE: ${link}\n${pageText}\n\n`;
      } catch (e) {
        console.error(`Failed to scrape ${link}: ${e.message}`);
      }
    }

    await browser.close();

    // Limit text size for OpenAI (approx 15k characters to stay within tokens safely)
    aggregatedText = aggregatedText.replace(/\s+/g, ' ').trim().substring(0, 25000);

    emit("PROGRESS", { percentage: 60, message: `Analyse IA des données collectées...` });

    // 2. OpenAI Analysis
    const fetchFn = await getFetch();
    const systemPrompt = `
Tu es un expert en intelligence commerciale hautement qualifié.
Ta mission est d'analyser le contenu textuel collecté sur le site web d'un prospect et d'en extraire une intelligence complète pour aider un commercial.
Le prospect est: ${personName} chez ${companyName}.

Tu dois fournir un détail complet, NE RIEN MANQUER d'important (décideurs, services, opportunités).

${userService ? `TON ENTREPRISE (L'utilisateur de Prospecta) :
- Secteur : ${userIndustry || 'Non spécifié'}
- Service : ${userService}
- Proposition de valeur : ${userValueProp || 'Non spécifiée'}

IMPORTANT : Lors de l'analyse, identifie spécifiquement les "prospecting_opportunities" et crée des "sales_scripts" (Icebreaker Email et Elevator Pitch) qui mettent en relation DIRECTE les besoins du prospect avec TON service pour maximiser l'intérêt.` : 'Donne des scripts de vente ultra-personnalisés basés sur le contenu trouvé.'}

Renvoie UNIQUEMENT un objet JSON strictement formaté.
Structure JSON:
{
    "phone": "numero de tel principal ou null",
    "email": "email principal de contact ou null",
    "score_global": 85,
    "ai_intelligence": {
        "executive_summary": "Résumé stratégique (5-12 lignes).",
        "contact_info": { "phones": ["tel1", "tel2"], "emails": ["email1", "email2"], "addresses": ["adresse 1"] },
        "key_people": [ { "name": "Nom", "role": "Rôle", "context": "Détails" } ],
        "activities": { "services": ["Service A", "Service B"], "technologies": ["Tech 1"], "sectors": ["Secteur X"] },
        "recent_news": [ { "type": "Type", "description": "Actualité" } ],
        "company_culture": { "mission": "Mission", "values": ["Valeur 1"] },
        "prospecting_opportunities": [ { "signal": "Signal d'affaires", "context": "Détails" } ],
        "sales_scripts": [ 
          { "title": "Icebreaker Email Personnalisé", "content": "Objet: ...\\n\\nBonjour..." },
          { "title": "Pitch d'appel direct", "content": "..." }
        ]
    }
}
`;

    const openAiResponse = await fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Contenu collecté sur le site: \n\n${aggregatedText}` }
        ],
        temperature: 0.3,
      })
    });

    if (!openAiResponse.ok) {
      const err = await openAiResponse.json();
      throw new Error(`OpenAI Error: ${err.error?.message || openAiResponse.statusText}`);
    }

    const aiData = await openAiResponse.json();
    const jsonContent = aiData.choices[0].message.content;
    const result = JSON.parse(jsonContent);

    emit("PROGRESS", { percentage: 100, message: `Analyse terminée.` });
    emit("RESULT", result);

  } catch (error) {
    if (browser) await browser.close();
    process.stdout.write(`ERROR:${error.message}\n`);
    process.exit(1);
  }
}

scrapeWebsite();
