import { useState } from "react";
import Header from "@/components/dashboard/Header";
import EmailCampaignManager, { Campaign as PremiumCampaign } from "@/components/dashboard/EmailCampaignManager";
import CreateCampaignDialog from "@/components/dashboard/CreateCampaignDialog";
import CampaignsSubNav from "@/components/dashboard/CampaignsSubNav";
import EmailTemplateGenerator from "@/components/dashboard/EmailTemplateGenerator";
import Inbox from "@/pages/Inbox";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Layout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { triggerN8nWorkflow } from "@/integrations/n8n";
import { ApiKeyGuard } from "@/components/ApiKeyGuard";
import { cn } from "@/lib/utils";
import { useEmailCampaigns } from "@/hooks/useEmailCampaigns";
import { useApiKeys } from "@/hooks/useApiKeys";
import { generateEmailTemplate, refineEmailTemplate } from "@/services/openaiService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

/**
 * Page de gestion des campagnes de prospection (Version Premium)
 */
const Campaigns = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<"campaigns" | "templates" | "inbox">("campaigns");
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

      const newCampaign = await createCampaign(payload);

      // Separate manual prospects (id starts with "manual_") from existing ones
      const allIds: string[] = formData.prospectIds || [];
      const selectedProspects: any[] = formData.selectedProspects || [];

      const manualIds = allIds.filter((id: string) => id.startsWith("manual_"));
      const realIds = allIds.filter((id: string) => !id.startsWith("manual_"));

      // Persist manually added prospects to Supabase
      if (user && manualIds.length > 0) {
        for (const manualId of manualIds) {
          const mp = selectedProspects.find((p: any) => p.id === manualId);
          if (!mp) continue;
          try {
            // Create prospect record (core)
            const { data: prospectRow } = await supabase
              .from("prospects")
              .insert({ 
                user_id: user.id, 
                source: "manual",
                status: "new"
              })
              .select("id")
              .single();
              
            if (prospectRow?.id) {
              // Create prospect_data record (details)
              await supabase.from("prospect_data").insert({
                prospect_id: prospectRow.id,
                name: mp.name,
                email: mp.email,
                company: mp.company,
                initials: mp.initials
              });
              realIds.push(prospectRow.id);
            }
          } catch (_) {}
        }
      }

      // Import all prospects (existing + newly created manual) into the campaign
      if (newCampaign && realIds.length > 0) {
        const result = await importFromProspects(newCampaign.id, realIds);
        if (result.success && result.added > 0) {
          toast({
            title: `${result.added} prospect(s) ajouté(s) à la campagne`,
          });
        }
      }

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

      <main className={cn(
        "mx-auto px-4 sm:px-6 pt-20 transition-all duration-500",
        activeTab === "inbox" ? "max-w-full h-screen overflow-hidden flex flex-col px-0 sm:px-0" : "max-w-7xl pb-8"
      )}>
        <ApiKeyGuard provider="smtp" featureName="les campagnes email">
          {/* Header Section - Hidden when Inbox is active to save space */}
          {activeTab !== "inbox" && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
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
          )}

          <div className={cn(activeTab === "inbox" && "px-4")}>
            <CampaignsSubNav activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Tab Content */}
          {activeTab === "campaigns" ? (
            <div className="animate-in fade-in duration-700 slide-in-from-bottom-2 space-y-6">

              {/* Campaign Performance Chart */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <BarChart3 size={20} className="text-emerald-500" />
                    Analyse de Performance des Campagnes
                  </CardTitle>
                  <CardDescription>
                    Comparaison de l'engagement (Envois, Ouvertures, Clics, Réponses) de vos campagnes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {campaigns && campaigns.length > 0 ? (
                    <div className="h-[300px] w-full">
                      <ChartContainer
                        config={{
                          sent_count: { label: "Envoyés", color: "#2563EB" },
                          opened_count: { label: "Ouverts", color: "#7C3AED" },
                          clicked_count: { label: "Cliqués", color: "#F59E0B" },
                          replied_count: { label: "Répondus", color: "#10B981" },
                        }}
                        className="h-full w-full"
                      >
                        <BarChart 
                          data={(campaigns as any[]).map(c => ({
                            ...c,
                            sent_count: c.sent_count || 0,
                            opened_count: c.opened_count || 0,
                            clicked_count: c.clicked_count || 0,
                            replied_count: c.replied_count || 0
                          })).slice(0, 5)} 
                          margin={{ top: 20, right: 0, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12 }}
                            tickMargin={10}
                          />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend iconType="circle" />
                          <Bar dataKey="sent_count" name="Envoyés" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          <Bar dataKey="opened_count" name="Ouverts" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          <Bar dataKey="clicked_count" name="Cliqués" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          <Bar dataKey="replied_count" name="Répondus" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                        <BarChart3 size={24} className="text-emerald-500/40" />
                      </div>
                      <p className="text-sm text-slate-500 max-w-xs">
                        Aucune donnée de campagne disponible pour le moment. Lancez votre première campagne pour voir les statistiques.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

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
          ) : activeTab === "templates" ? (
            <EmailTemplateGenerator />
          ) : (
            <div className="flex-1 min-h-0 animate-in fade-in duration-700">
              <Inbox isStandalone={false} />
            </div>
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
