import { useState } from "react";
import Header from "@/components/dashboard/Header";
import EmailCampaignManager, { Campaign as PremiumCampaign } from "@/components/dashboard/EmailCampaignManager";
import CreateCampaignDialog from "@/components/dashboard/CreateCampaignDialog";
import CampaignsSubNav from "@/components/dashboard/CampaignsSubNav";
import EmailTemplateGenerator from "@/components/dashboard/EmailTemplateGenerator";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Layout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { triggerN8nWorkflow } from "@/integrations/n8n";
import { ApiKeyGuard } from "@/components/ApiKeyGuard";
import { useEmailCampaigns } from "@/hooks/useEmailCampaigns";
import { useApiKeys } from "@/hooks/useApiKeys";
import { generateEmailTemplate, refineEmailTemplate } from "@/services/openaiService";

/**
 * Page de gestion des campagnes de prospection (Version Premium)
 */
const Campaigns = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<"campaigns" | "templates">("campaigns");
  const { getKeyByProvider } = useApiKeys();

  // Hook unifié pour les campagnes
  const { 
    campaigns, 
    loading: isLoading, 
    fetchCampaigns, 
    createCampaign, 
    importFromProspects,
    addManualRecipient,
    launchDailyBatch,
    updateCampaign,
    getCampaignRecipients,
    removeRecipient
  } = useEmailCampaigns();

  // Gestion de la création
  const handleCreateCampaign = async (formData: any) => {
    try {
      const payload = {
        name: formData.name,
        status: "active" as const,
        from_name: formData.fromName,
        from_email: formData.fromEmail,
        subject: formData.subject,
        body_html: formData.body,
        daily_limit: formData.dailyLimit,
        schedule_time: formData.schedule,
        throttle_min_seconds: formData.throttleMin,
        throttle_max_seconds: formData.throttleMax,
        enable_warmup: formData.enableWarmup,
        tags: formData.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
        start_date: new Date().toISOString().split('T')[0],
      };

      await createCampaign(payload);

      toast({
        title: "Campagne lancée ! 🚀",
        description: "Votre campagne est maintenant active et l'envoi va débuter selon votre planning."
      });
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message || "Impossible de créer la campagne",
        variant: "destructive"
      });
    }
  };

  // Gestion de la génération d'email par IA via n8n
  const handleGenerateAI = async (name: string, context: string = "", tone: string = "Professionnel", sequenceType: string = "Premier contact") => {
    if (!user) return;
    setIsGeneratingAI(true);
    try {
      // 1. Get OpenAI Key
      const apiKey = await getKeyByProvider('openai');
      if (!apiKey) {
        throw new Error("Clé OpenAI manquante. Veuillez la configurer dans les paramètres.");
      }

      // 2. Get User Service Description
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_service_description')
        .eq('user_id', user.id)
        .maybeSingle();

      const serviceDescription = (profile as any)?.user_service_description || "";

      // 3. Generate Template
      const result = await generateEmailTemplate(user.id, name, serviceDescription, apiKey, tone, sequenceType);
      
      return {
        subject: result.subject || "Sans sujet",
        body: result.body || "Corps non généré"
      };
    } catch (err: unknown) {
      console.error('AI Generation Error:', err);
      toast({
        title: "Erreur IA",
        description: (err instanceof Error ? err.message : "Une erreur inconnue s'est produite") || "Échec de la génération automatique de l'email.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleRefineAI = async (currentSubject: string, currentBody: string, prompt: string, history: any[]) => {
    if (!user) return;
    
    setIsGeneratingAI(true);
    try {
      const apiKey = await getKeyByProvider('openai');
      
      if (!apiKey) {
        throw new Error("Clé OpenAI manquante. Veuillez la configurer dans les paramètres.");
      }

      const result = await refineEmailTemplate(apiKey, { subject: currentSubject, body: currentBody }, prompt, history);
      
      return {
        subject: result.subject || currentSubject,
        body: result.body || currentBody,
        message: result.message
      };
    } catch (err: unknown) {
      console.error('[handleRefineAI] AI Refinement Error:', err);
      toast({
        title: "Erreur IA",
        description: (err instanceof Error ? err.message : "Une erreur inconnue s'est produite") || "Échec de l'affinement automatique.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-emerald-500/30">
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-8">
        <ApiKeyGuard provider="smtp" featureName="les campagnes email">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  <Mail className="text-emerald-500" size={28} />
                </div>
                <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-500 bg-clip-text text-transparent">
                  Email Campaigns
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium text-sm flex items-center gap-2 pl-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Automatisez vos séquences avec intelligence et scalabilité.
              </p>
            </div>

            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 px-8 rounded-xl shadow-[0_8px_30px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={20} className="mr-2 stroke-[3px]" /> Nouvelle Campagne
            </Button>
          </div>

          <CampaignsSubNav activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab Content */}
          {activeTab === "campaigns" ? (
            <div className="animate-in fade-in duration-700 slide-in-from-bottom-2">
              <EmailCampaignManager
                campaigns={campaigns as any[]}
                isLoading={isLoading}
                onRefresh={fetchCampaigns}
                user={user}
                onAddProspects={async (campaignId, prospectIds) => {
                  const result = await importFromProspects(campaignId, prospectIds);
                  if (result.success) {
                    toast({
                      title: "Importation terminée",
                      description: `${result.added} prospects ajoutés. ${result.skipped} ignorés (doublons ou emails manquants).`
                    });
                    fetchCampaigns();
                  } else {
                    toast({
                      title: "Erreur",
                      description: "Impossible d'ajouter les prospects",
                      variant: "destructive"
                    });
                  }
                }}
                onLaunchBatch={launchDailyBatch}
                onUpdateTemplate={async (id, updates) => {
                  const success = await updateCampaign(id, updates);
                  if (success) {
                    toast({
                      title: "Succès",
                      description: "Template mis à jour avec succès"
                    });
                  }
                }}
                onUpdateCampaign={async (id, updates) => {
                  const success = await updateCampaign(id, updates);
                  if (success) {
                    toast({
                      title: "Succès",
                      description: "Paramètres de la campagne mis à jour"
                    });
                  }
                }}
                onGetRecipients={getCampaignRecipients}
                onRemoveRecipient={removeRecipient}
                onManualAdd={async (campaignId, data) => {
                  const result = await addManualRecipient(campaignId, data);
                  if (result.success) {
                    fetchCampaigns();
                  } else {
                    throw new Error(result.error);
                  }
                }}
                isGeneratingAI={isGeneratingAI}
                onGenerateAI={handleGenerateAI}
                onRefineAI={handleRefineAI}
              />
            </div>
          ) : (
            <EmailTemplateGenerator />
          )}
        </ApiKeyGuard>
      </main>

      {/* Campaign Creation Wizard */}
      <CreateCampaignDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateCampaign}
        isGeneratingAI={isGeneratingAI}
        onGenerateAI={handleGenerateAI}
      />
    </div>
  );
};

export default Campaigns;
