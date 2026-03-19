import { fetchOpenAICompletion } from "./openaiService";
import { supabase } from "@/integrations/supabase/client";
import { getAgentApiUrl } from "@/utils/agentUtils";

export interface EnrichmentResult {
    phone?: string;
    email?: string;
    score_global?: number;
    ai_intelligence?: {
        executive_summary?: string;
        contact_info?: {
            phones?: string[];
            emails?: string[];
            addresses?: string[];
        };
        key_people?: {
            name: string;
            role: string;
        }[];
        activities?: Record<string, any>;
        recent_news?: any[];
        company_culture?: Record<string, any>;
        prospecting_opportunities?: {
            signal: string;
            context: string;
        }[];
        sales_scripts?: {
            title: string;
            content: string;
        }[];
    };
    // Added for simplified structure support
    industry?: string;
    company_description?: string;
    pain_points?: string[];
    technologies?: string[];
}

// Fonction pour extraire le texte brut d'un HTML
function extractTextFromHTML(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Supprimer les éléments non pertinents
    const scripts = doc.querySelectorAll('script, style, noscript, iframe, svg, img, video, audio');
    scripts.forEach(s => s.remove());

    // Extraire le texte et nettoyer
    const text = doc.body?.textContent || "";
    // Remplacer les espaces multiples et les sauts de ligne multiples par un seul
    return text.replace(/\s+/g, ' ').trim().substring(0, 15000); // Limiter la taille
}

async function analyzeWithAI(
    rawText: string,
    openAiKey: string,
    prospectContext: { name?: string, company?: string },
    userContext?: { service?: string, value_prop?: string, industry?: string }
): Promise<EnrichmentResult> {
    const systemPrompt = `
Tu es un expert en intelligence commerciale et scraping web.
Analyse le contenu brut du site web d'un prospect et extrais les informations clés.
Le prospect est: ${prospectContext.name || 'Inconnu'} appartenant à l'entreprise ${prospectContext.company || 'Inconnue'}.

${userContext?.service ? `TON ENTREPRISE (L'utilisateur de Prospecta) :
- Secteur : ${userContext.industry || 'Non spécifié'}
- Service : ${userContext.service}
- Proposition de valeur : ${userContext.value_prop || 'Non spécifiée'}

IMPORTANT : Lors de l'analyse, identifie spécifiquement les "prospecting_opportunities" et crée des "sales_scripts" (Icebreaker Email et Elevator Pitch) qui mettent en relation DIRECTE les besoins du prospect avec TON service pour maximiser l'intérêt.` : ''}

Renvoie UNIQUEMENT un objet JSON strictement formaté selon la structure demandée ci-dessous. Ne renvoie aucun autre texte.
Structure JSON attendue:
{
    "phone": "numero de tel principal ou null",
    "email": "email principal de contact ou null",
    "score_global": 85, // Score de 0 à 100 basé sur les critères :
    // - Complétude des infos (Email, Tel, Bureau) : 40pts
    // - Clarté du positionnement business : 20pts
    // - Preuve sociale / Actualités récentes : 20pts
    // - Potentiel de conversion (opportunités détectées) : 20pts
    "ai_intelligence": {
        "executive_summary": "Résumé de l'entreprise, sa proposition de valeur et sa cible (3-4 lignes max).",
        "contact_info": { "phones": ["tel1", "tel2"], "emails": ["email1", "email2"], "addresses": ["adresse 1"] },
        "key_people": [ { "name": "Nom", "role": "Rôle", "context": "Détails/Contexte" } ],
        "activities": { "services": ["Service A", "Service B"], "technologies": ["Tech 1"], "sectors": ["Secteur X"] },
        "recent_news": [ { "type": "Type", "description": "Description de l'actualité" } ],
        "company_culture": { "mission": "Mission de l'entreprise", "values": ["Valeur 1", "Valeur 2"] },
        "prospecting_opportunities": [
            { "signal": "Ex: Recrutement en cours / Nouveau produit", "context": "Détails" }
        ],
        "sales_scripts": [
            { "title": "Icebreaker Email", "content": "Objet: ...\\n\\nBonjour..." },
            { "title": "Elevator Pitch (Call)", "content": "Bonjour, je vous appelle car..." }
        ]
    }
}
`;

    try {
        const content = await fetchOpenAICompletion(openAiKey, [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Contenu de la page web: \n\n${rawText}` }
        ]);

        try {
            return JSON.parse(content) as EnrichmentResult;
        } catch (e) {
            console.error("Erreur de parsing JSON IA", content);
            throw new Error("Le format renvoyé par l'IA est invalide.");
        }
    } catch (error: any) {
        console.error("Erreur IA:", error);
        throw new Error(`Erreur lors de l'analyse IA: ${error.message}`);
    }
}

export async function enrichProspectLocally(
    url: string,
    openAiKey: string,
    prospectContext: { name?: string, company?: string },
    userContext?: { service?: string, value_prop?: string, industry?: string }
): Promise<EnrichmentResult> {
    if (!openAiKey) {
        throw new Error("Clé API OpenAI manquante.");
    }

    // 1. Scraping du site
    let rawText = "";
    
    // Tente de contacter l'agent local en premier
    const agentBase = getAgentApiUrl();
    let useLocalAgent = false;
    
    try {
        const healthCheck = await fetch(`${agentBase}/api/health`, { signal: AbortSignal.timeout(1000) });
        if (healthCheck.ok) useLocalAgent = true;
    } catch (e) {
        useLocalAgent = false;
    }

    if (useLocalAgent) {
        try {
            const enrichUrl = url.startsWith('http') ? url : `https://${url}`;
            
            // Si la clé est du JSON (OpenRouter/OpenAI mix), on extrait la clé brute pour l'agent local
            let actualKey = openAiKey;
            if (openAiKey && openAiKey.startsWith('{')) {
                try {
                    const parsed = JSON.parse(openAiKey);
                    actualKey = parsed.apiKey || openAiKey;
                } catch(e) {}
            }

            const response = await fetch(`${agentBase}/api/scrape/enrich-website?website=${encodeURIComponent(enrichUrl)}&openAiKey=${encodeURIComponent(actualKey)}&name=${encodeURIComponent(prospectContext.name || '')}&company=${encodeURIComponent(prospectContext.company || '')}`);
            
            if (response.ok) {
                 // The agent might return the enrichment directly or we can fallback to local analysis if it just scrapes
                 // For now, let's assume it returns text or we continue with local analysis of its result
                 console.log("[Enrichment] Agent local utilisé.");
            }
        } catch (error) {
            console.warn("[Enrichment] Échec agent local, repli sur proxy CORS");
        }
    }

    if (!rawText) {
        try {
            const fullUrl = url.startsWith('http') ? url : `https://${url}`;
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(fullUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("Erreur lors de la récupération du site web.");

            const data = await response.json();
            const html = data.contents;
            rawText = extractTextFromHTML(html);

            if (!rawText || rawText.length < 50) {
                throw new Error("La page semble vide ou protégée contre le scraping basique.");
            }
        } catch (error: any) {
            console.error("Erreur de scraping:", error);
            throw new Error(`Impossible de scraper le site web: ${error.message}`);
        }
    }

    // 2. Analyse via IA (unifiée)
    return analyzeWithAI(rawText, openAiKey, prospectContext, userContext);
}
