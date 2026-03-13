import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApiKeys } from "@/hooks/useApiKeys";
import { profileurAgent, strategeAgent } from "@/lib/ai-agents";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook pour gérer l'intelligence artificielle appliquée aux prospects.
 * Permet de générer des résumés et des suggestions et de les persister dans Supabase.
 */
export const useProspectAI = () => {
    const { getKeyByProvider } = useApiKeys();
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    /**
     * Analyse un prospect : génère résumé et suggestions, puis sauvegarde.
     */
    const analyzeProspect = async (prospectId: string, prospectData: any) => {
        setIsAnalyzing(true);
        try {
            const apiKey = await getKeyByProvider('openai');
            if (!apiKey) {
                throw new Error("Clé OpenAI manquante");
            }

            // 1. Appel des agents
            const summary = await profileurAgent(apiKey, prospectData);
            const suggestionsData = await strategeAgent(apiKey, { ...prospectData, summary });

            // 2. Persistance dans Supabase
            // On utilise 'summary' pour le résumé et on stocke les suggestions dans 'web_intelligence'
            const { error } = await supabase
                .from('prospect_data')
                .update({
                    summary: summary,
                    web_intelligence: {
                        ...(prospectData.web_intelligence as object || {}),
                        ai_suggestions: suggestionsData.suggestions,
                        last_ai_analysis: new Date().toISOString()
                    }
                } as any)
                .eq('prospect_id', prospectId);

            if (error) throw error;

            toast({
                title: "Intelligence IA mise à jour",
                description: "Le profil et les suggestions ont été générés avec succès.",
            });

            return { summary, suggestions: suggestionsData.suggestions };
        } catch (error: any) {
            console.error("Erreur lors de l'analyse IA:", error);
            toast({
                title: "Erreur d'analyse IA",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    return {
        analyzeProspect,
        isAnalyzing
    };
};
