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
    return text.replace(/\s+/g, ' ').trim().substring(0, 15000); // Limiter la taille pour OpenAI
}

export async function enrichProspectLocally(
    url: string,
    openAiKey: string,
    prospectContext: { name?: string, company?: string }
): Promise<EnrichmentResult> {
    if (!openAiKey) {
        throw new Error("Clé API OpenAI manquante.");
    }

    // 1. Scraping du site via un proxy CORS public
    // On utilise allorigins pour contourner les CORS sans nécessiter de backend dédié
    let rawText = "";
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

    // 2. Analyse via OpenAI
    const systemPrompt = `
Tu es un expert en intelligence commerciale et scraping web.
Analyse le contenu brut du site web d'un prospect et extrais les informations clés.
Le prospect est: ${prospectContext.name || 'Inconnu'} appartenant à l'entreprise ${prospectContext.company || 'Inconnue'}.

Renvoie UNIQUEMENT un objet JSON strictement formaté selon la structure demandée ci-dessous. Ne renvoie aucun autre texte.
Structure JSON attendue:
{
    "phone": "numero de tel principal ou null",
    "email": "email principal de contact ou null",
    "score_global": 85, // Score de 0 à 100 estimant la qualité/taille de l'entreprise
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
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
                    { role: "user", content: `Contenu de la page web: \n\n${rawText}` }
                ],
                temperature: 0.3,
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Erreur OpenAI");
        }

        const openAiData = await response.json();
        const jsonContent = openAiData.choices[0].message.content;

        try {
            const parsed = JSON.parse(jsonContent) as EnrichmentResult;
            return parsed;
        } catch (e) {
            console.error("Erreur de parsing JSON OpenAI", jsonContent);
            throw new Error("Le format renvoyé par l'IA est invalide.");
        }
    } catch (error: any) {
        console.error("Erreur OpenAI:", error);
        throw new Error(`Erreur lors de l'analyse IA: ${error.message}`);
    }
}
