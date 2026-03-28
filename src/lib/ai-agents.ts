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
export const profileurAgent = async (apiKey: string, prospectData: any, userData?: { profile: any }): Promise<string> => {
    const prompt = `
        Tu es l'Agent Profileur de Prospecta. Ton rôle est d'analyser les données d'un prospect B2B et de générer un résumé exécutif court (2-3 phrases).
        
        ${userData?.profile ? `TON ENTREPRISE :
        - Secteur : ${userData.profile.industry}
        - Service : ${userData.profile.user_service_description}
        - Proposition de valeur : ${userData.profile.value_prop}` : ''}

        DONNÉES DU PROSPECT :
        Nom : ${prospectData.name}
        Entreprise : ${prospectData.company}
        Secteur : ${prospectData.industry}
        Position : ${prospectData.position}
        Site Web : ${prospectData.website}
        Intelligence Web : ${JSON.stringify(prospectData.web_intelligence || {})}
        
        CONSIGNES :
        - Sois factuel et stratégique.
        - Identifie le besoin potentiel ou l'opportunité en lien avec TON ENTREPRISE si possible.
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
export const strategeAgent = async (apiKey: string, prospectData: any, userData?: { profile: any }): Promise<any> => {
    const prompt = `
        Tu es l'Agent Stratège de Prospecta. Ton rôle est de proposer 3 suggestions d'actions concrètes pour approcher ce prospect.
        
        ${userData?.profile ? `TON ENTREPRISE :
        - Secteur : ${userData.profile.industry}
        - Service : ${userData.profile.user_service_description}
        - Proposition de valeur : ${userData.profile.value_prop}` : ''}

        PROSPECT : ${prospectData.name} (${prospectData.company})
        CONTEXTE : ${prospectData.summary || "Nouveau prospect"}
        
        Réponds UNIQUEMENT au format JSON avec la structure suivante :
        {
            "suggestions": [
                {"type": "email", "label": "Angle d'approche", "description": "Explication de pourquoi cet angle en rapport avec ton offre"},
                {"type": "linkedin", "label": "Point d'accroche", "description": "Détail de l'accroche personnalisée"},
                {"type": "call", "label": "Sujet de discussion", "description": "Proposition de valeur clé spécifique pour ce prospect"}
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
export const copywriterAgent = async (apiKey: string, prospectData: any, objective: string, userData?: { profile: any }): Promise<string> => {
    const prompt = `
        Tu es l'Agent Copywriter de Prospecta. 
        Génère un message de prospection ultra-personnalisé pour ${prospectData.name} chez ${prospectData.company}.
        
        ${userData?.profile ? `TON ENTREPRISE (L'EXPÉDITEUR) :
        - Secteur : ${userData.profile.industry}
        - Service : ${userData.profile.user_service_description}
        - Proposition de valeur : ${userData.profile.value_prop}` : ''}

        OBJECTIF : ${objective}
        INFO PROSPECT : ${prospectData.summary || prospectData.industry}
        
        CONSIGNES :
        - Ton : ${userData?.profile?.communication_tone || 'Professionnel'}, direct, sans "bullshit".
        - Structure : Accroche personnalisée -> Problématique -> Solution (ton offre) -> CTA clair.
        - Fais le lien DIRECT entre le prospect et TON service.
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
        Tu es l'Assistant Intelligent de Prospecta "X-10", l'IA experte intégrée directement dans la plateforme.
        Ton rôle est d'aider l'utilisateur à naviguer, optimiser sa prospection et comprendre les algorithmes de la plateforme.
        
        CONNAISSANCE DE LA PLATEFORME (ALGORITHMES ET FONCTIONS) :
        1. PROSPECT FINDER : 
           - Utilise le Multi-Channel Scanning (LinkedIn, Google Maps, Pages Jaunes, Pappers, Societe.com, Facebook).
           - Fonctionne via SSE (Server-Sent Events) pour des résultats en temps réel sans rechargement.
           - LinkedIn/Facebook : Nécessite des comptes dédiés pour éviter les bans. Utilise des scrapers Playwright avancés qui simulent le comportement humain.
        2. E-MAIL CAMPAIGNS :
           - Utilise exclusivement le protocole SMTP (standard industriel) pour l'envoi des messages.
           - Assure une délivrabilité optimale via une configuration personnalisée.
        3. TRACKING & ANALYTICS :
           - Emails suivis via un pixel invisible dynamique (/api/email/track/open/:id).
           - Les statistiques (Ouvertures, Clics) sont mises à jour en temps réel en base de données.
        4. CRM INTEGRATION :
           - Gestion des doublons automatique lors de l'import.
           - Segmentation par Tags et Statuts (New, Contacted, Replied, etc.).
        5. PERSISTANCE :
           - Les sessions de recherche et les crédentiels sociaux sont persistés dans localStorage et Supabase pour une continuité parfaite.

        CONTEXTE UTILISATEUR :
        - Nom : ${userData.profile?.full_name || "Utilisateur"}
        - Secteur : ${industry}
        - Proposition de valeur : ${valueProp}
        - Métriques : ${userData.stats.totalProspects} prospects, ${userData.stats.messagesSent} messages envoyés, ${userData.stats.responseRate}% de réponse.
        
        CONSIGNES DE RÉPONSE :
        - Sois l'expert technique et stratégique ultime.
        - Si l'utilisateur pose une question sur un problème (ex: "Mes mails ne partent pas"), vérifie s'il a configuré le SMTP dans ses paramètres.
        - STRUCTURE : Utilise du Markdown propre. Gras pour les points clés.
        - Encourage l'utilisateur à exploiter ses ${userData.stats.totalProspects} prospects.
    `;

    return await fetchOpenAICompletion(apiKey, [
        { role: 'system', content: systemPrompt },
        ...messages
    ]);
};
