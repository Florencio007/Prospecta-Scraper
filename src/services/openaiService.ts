import { supabase } from "@/integrations/supabase/client";

/**
 * Service pour interagir directement avec OpenAI depuis le client.
 * Note: Dans une application de production, il est recommandé de passer par une Edge Function 
 * pour ne pas exposer les clés API, mais ici nous utilisons le mécanisme existant de Prospecta.
 */
export const fetchOpenAICompletion = async (apiKey: string, messages: any[]) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini', // Modèle performant et économique
            messages,
            temperature: 0.7,
            response_format: { type: "json_object" }
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Échec de la requête OpenAI');
    }

    const data = await response.json();
    return data.choices[0].message.content;
};

export const generateEmailTemplate = async (userId: string, campaignName: string, serviceDescription: string, apiKey: string, tone: string = "Professionnel", sequenceType: string = "Premier contact") => {
    const prompt = `
        Tu es un expert en copywriting pour la prospection B2B. 
        Génère un email de prospection personnalisé pour une campagne nommée : "${campaignName}".
        Type de séquence : "${sequenceType}".
        Ton souhaité : "${tone}".
        Ma description de service est : "${serviceDescription || "Service de prospection automatisée"}".
        
        Utilise les variables suivantes dans le message :
        - {{prenom}} pour le prénom du prospect
        - {{nom}} pour le nom du prospect
        - {{entreprise}} pour le nom de l'entreprise
        
        L'email doit être court, percutant, et structuré en HTML léger (pas de template complexe, juste des <p> et <br>).
        Réponds UNIQUEMENT au format JSON avec les clés suivantes :
        {
            "subject": "L'objet de l'email avec un emoji",
            "body": "Le contenu de l'email au format HTML"
        }
    `;

    const content = await fetchOpenAICompletion(apiKey, [
        { role: 'system', content: `Tu es un copywriter pro specialisé dans le ton ${tone}. Tu réponds uniquement en JSON.` },
        { role: 'user', content: prompt }
    ]);

    try {
        // Strip out any markdown code blocks (e.g., ```json\n...\n```)
        let cleanedContent = content.trim();
        if (cleanedContent.startsWith('```')) {
            const lines = cleanedContent.split('\n');
            if (lines.length > 1) {
                // Remove first line (e.g. ```json)
                lines.shift();
                // Remove last line (e.g. ```)
                if (lines[lines.length - 1].trim().startsWith('```')) {
                    lines.pop();
                }
                cleanedContent = lines.join('\n');
            }
        }
        return JSON.parse(cleanedContent);
    } catch (e) {
        console.error("Erreur de parsing JSON OpenAI", content, e);
        throw new Error("Le format de réponse de l'IA est invalide. Veuillez réessayer.");
    }
};

export const refineEmailTemplate = async (
    apiKey: string, 
    currentTemplate: { subject: string, body: string }, 
    userRequest: string, 
    history: { role: 'user' | 'assistant', content: string }[] = []
) => {
    const prompt = `
        Tu es un expert en copywriting. L'utilisateur souhaite modifier son email de prospection actuel.
        
        EMAIL ACTUEL :
        Objet : ${currentTemplate.subject}
        Corps : ${currentTemplate.body}
        
        DEMANDE DE L'UTILISATEUR :
        "${userRequest}"
        
        CONSIGNES :
        - Garde les variables {{prenom}}, {{nom}}, {{entreprise}} si elles sont déjà présentes.
        - L'email doit être en HTML léger (<p>, <br>).
        - Réponds UNIQUEMENT au format JSON avec la structure exacte suivante :
        {
            "subject": "Nouvel objet",
            "body": "Nouveau corps HTML",
            "message": "Ton message au prospect pour expliquer tes modifications de manière conversationnelle (ex: 'Voici une version plus courte, dis-moi ce que tu en penses !')"
        }
    `;

    const messages = [
        { role: 'system', content: 'Tu es un copywriter pro. Tu réponds uniquement en JSON.' },
        ...history,
        { role: 'user', content: prompt }
    ];

    const content = await fetchOpenAICompletion(apiKey, messages as any);

    try {
        let cleanedContent = content.trim();
        if (cleanedContent.startsWith('```')) {
            const lines = cleanedContent.split('\n');
            if (lines.length > 1) {
                lines.shift();
                if (lines[lines.length - 1].trim().startsWith('```')) {
                    lines.pop();
                }
                cleanedContent = lines.join('\n');
            }
        }
        return JSON.parse(cleanedContent);
    } catch (e) {
        console.error("Erreur de parsing JSON OpenAI", content, e);
        throw new Error("L'IA n'a pas pu générer un format valide. Veuillez réessayer.");
    }
};
