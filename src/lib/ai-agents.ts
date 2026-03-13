import { fetchOpenAICompletion } from "@/services/openaiService";

/**
 * Interface pour les résultats des agents
 */
export interface AgentResult {
    content: string;
    metadata?: any;
}

/**
 * Agent Profileur : Analyse les données du prospect pour en faire un résumé percutant.
 */
export const profileurAgent = async (apiKey: string, prospectData: any): Promise<string> => {
    const prompt = `
        Tu es l'Agent Profileur de Prospecta. Ton rôle est d'analyser les données d'un prospect B2B et de générer un résumé exécutif court (2-3 phrases).
        
        DONNÉES DU PROSPECT :
        Nom : ${prospectData.name}
        Entreprise : ${prospectData.company}
        Secteur : ${prospectData.industry}
        Position : ${prospectData.position}
        Site Web : ${prospectData.website}
        Intelligence Web : ${JSON.stringify(prospectData.web_intelligence || {})}
        
        CONSIGNES :
        - Sois factuel et stratégique.
        - Identifie le besoin potentiel ou l'opportunité.
        - Ne fais pas de phrases inutiles.
    `;

    return await fetchOpenAICompletion(apiKey, [
        { role: 'system', content: 'Tu es un expert en intelligence commerciale B2B. Tu rédiges des résumés de profil prospect.' },
        { role: 'user', content: prompt }
    ]);
};

/**
 * Agent Stratège : Propose des suggestions d'actions et de points d'accroche.
 */
export const strategeAgent = async (apiKey: string, prospectData: any): Promise<any> => {
    const prompt = `
        Tu es l'Agent Stratège de Prospecta. Ton rôle est de proposer 3 suggestions d'actions concrètes pour approcher ce prospect.
        
        PROSPECT : ${prospectData.name} (${prospectData.company})
        CONTEXTE : ${prospectData.summary || "Nouveau prospect"}
        
        Réponds UNIQUEMENT au format JSON avec la structure suivante :
        {
            "suggestions": [
                {"type": "email", "label": "Angle d'approche", "description": "Explication de pourquoi cet angle"},
                {"type": "linkedin", "label": "Point d'accroche", "description": "Détail de l'accroche"},
                {"type": "call", "label": "Sujet de discussion", "description": "Proposition de valeur clé"}
            ]
        }
    `;

    const response = await fetchOpenAICompletion(apiKey, [
        { role: 'system', content: 'Tu es un stratège de vente B2B. Tu réponds uniquement en JSON.' },
        { role: 'user', content: prompt }
    ]);

    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch (e) {
        console.error("Erreur parsing Agent Stratège", response);
        return { suggestions: [] };
    }
};

/**
 * Agent Copywriter : Génère des messages ultra-personnalisés.
 */
export const copywriterAgent = async (apiKey: string, prospectData: any, objective: string): Promise<string> => {
    const prompt = `
        Tu es l'Agent Copywriter de Prospecta. 
        Génère un message de prospection ultra-personnalisé pour ${prospectData.name} chez ${prospectData.company}.
        
        OBJECTIF : ${objective}
        INFO PROSPECT : ${prospectData.summary || prospectData.industry}
        
        CONSIGNES :
        - Ton : Professionnel, direct, sans "bullshit".
        - Structure : Accroche personnalisée -> Problématique -> Solution -> CTA clair.
        - Max 4-5 phrases.
    `;

    return await fetchOpenAICompletion(apiKey, [
        { role: 'system', content: 'Tu es un copywriter B2B de haut niveau spécialisé dans la personnalisation.' },
        { role: 'user', content: prompt }
    ]);
};

/**
 * Agent Analyste : Analyse les performances des campagnes et donne des conseils.
 */
export const analysteAgent = async (apiKey: string, dashboardData: any): Promise<string> => {
    const prompt = `
        Tu es l'Analyste Stratégique de Prospecta. Ton rôle est d'analyser les métriques de prospection et de donner des conseils précis.
        
        DONNÉES DU DASHBOARD :
        - Prospects totaux : ${dashboardData.totalProspects}
        - Taux de réponse : ${dashboardData.responseRate}%
        - Messages envoyés : ${dashboardData.messagesSent}
        - Sources principales : ${JSON.stringify(dashboardData.topSources)}
        - Activité récente : ${JSON.stringify(dashboardData.recentActivity)}
        
        CONSIGNES :
        - Analyse les tendances (ex: quelle source est la plus efficace).
        - Identifie les points d'amélioration (ex: si le taux de réponse est bas, suggère de revoir les templates).
        - Donne 3 conseils stratégiques CONCRETS et immédiats.
        - Ton : Expert, encourageant et basé sur les chiffres.
        - Format : Utilise du Markdown (gras, listes) pour la lisibilité.
    `;

    return await fetchOpenAICompletion(apiKey, [
        { role: 'system', content: 'Tu es un analyste de données spécialisé en Growth Hacking et prospection B2B.' },
        { role: 'user', content: prompt }
    ]);
};

/**
 * Agent ChatBot : Chat libre avec historique et contexte utilisateur.
 */
export const chatAgent = async (
    apiKey: string, 
    messages: { role: 'user' | 'assistant', content: string }[], 
    userData: { profile: any, stats: any }
): Promise<string> => {
    const industry = userData.profile?.industry || "B2B";
    const valueProp = userData.profile?.value_prop || "Solutions de croissance";
    
    const systemPrompt = `
        Tu es l'Assistant Intelligent de Prospecta. Ton rôle est d'aider l'utilisateur à optimiser sa prospection.
        
        CONTEXTE UTILISATEUR :
        - Nom : ${userData.profile?.full_name || "Utilisateur"}
        - Secteur : ${industry}
        - Proposition de valeur : ${valueProp}
        - Métriques : ${userData.stats.totalProspects} prospects, ${userData.stats.messagesSent} messages envoyés, ${userData.stats.responseRate}% de réponse.
        
        CONSIGNES :
        - Sois conversationnel, amical et proactif.
        - Utilise les données fournies pour donner des conseils personnalisés.
        - STRUCTURE : Utilise des sauts de ligne clairs. Tu peux utiliser du gras (**texte**) pour les points importants, l'interface s'occupera du rendu.
        - ÉVITE : Les listes trop denses ou les caractères spéciaux inutiles comme #.
        - Encourage l'utilisateur à agir sur ses prospects (${userData.stats.totalProspects} disponibles).
    `;

    return await fetchOpenAICompletion(apiKey, [
        { role: 'system', content: systemPrompt },
        ...messages
    ]);
};
