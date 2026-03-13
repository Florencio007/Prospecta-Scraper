import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Globe, MessageCircle, ExternalLink, ShieldCheck, Zap, Linkedin, Facebook, Instagram, Twitter, Youtube, Pin, Share2, Copy, Save, X, MapPin, Sparkles, Loader2, Plus, Clock, Users, MessageSquare, ThumbsUp } from "lucide-react";
import { Prospect } from "@/data/mockData";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { enrichProspectLocally } from "@/services/enrichmentService";
import { useApiKeys } from "@/hooks/useApiKeys";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import CampaignSelectionDialog from "./CampaignSelectionDialog";
import { useProspectAI } from "@/hooks/useProspectAI";

const extractDomain = (url: string = "") => {
    if (!url) return "";
    try {
        const cleanUrl = url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split("/")[0];
        return cleanUrl.toLowerCase();
    } catch (e) {
        return url.toLowerCase();
    }
};


interface ProspectDetailViewProps {
    prospect: Prospect | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const ProspectDetailView = ({ prospect, isOpen, onOpenChange }: ProspectDetailViewProps) => {
    const { t } = useLanguage();
    const { toast } = useToast();
    const { getKeyByProvider } = useApiKeys();
    const [isEnriching, setIsEnriching] = useState(false);
    const [localProspect, setLocalProspect] = useState<Prospect | null>(null);
    const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
    const [prospectIdsForCampaign, setProspectIdsForCampaign] = useState<string[]>([]);
    const { analyzeProspect, isAnalyzing } = useProspectAI();

    // Sync local prospect when it changes from props
    if (prospect && (!localProspect || localProspect.id !== prospect.id)) {
        setLocalProspect(prospect);
    }

    const currentProspect = localProspect || prospect;


    // Debug logging
    if (isOpen) {
        console.log("ProspectDetailView render:", { isOpen, prospectName: prospect?.name, hasWebIntelligence: !!prospect?.webIntelligence });
    }

    const handleAction = async (actionKey: string) => {
        if (!prospect) return;

        if (actionKey === "connect") {
            if (prospect.source?.toLowerCase() === "govcon" && prospect.website) {
                window.open(prospect.website, "_blank");
                toast({
                    title: t("openingLink"),
                    description: t("redirectingToSam"),
                });
                return;
            }

            // Ensure saved before adding to campaign to have a valid UUID
            const savedId = await ensureProspectSaved();
            if (!savedId) return;

            // Open campaign selection dialog with the explicit UUID
            setProspectIdsForCampaign([savedId]);
            setIsCampaignDialogOpen(true);
            return;
        }

        toast({
            title: t("success"),
            description: t("actionForProspect", { action: t(actionKey), name: currentProspect.name }),
        });
    };

    const isEnrichable = (url?: string) => {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        // Check if it's a real website or just a Google Maps link
        if (lowerUrl.includes("google.com/maps") || lowerUrl.includes("goo.gl/maps")) return false;
        return true;
    };

    const handleEnrich = async () => {
        if (!currentProspect) return;

        if (!isEnrichable(currentProspect.website)) {
            toast({
                title: t("websiteRequired"),
                description: t("websiteRequiredDesc"),
                variant: "destructive"
            });
            return;
        }

        // Ensure saved before enriching to have a valid UUID for updates
        const savedId = await ensureProspectSaved();
        if (!savedId) return;

        setIsEnriching(true);

        try {
            // 1. Check Enrichment Cache
            const domain = extractDomain(currentProspect.website);
            console.log("Checking enrichment cache for domain:", domain);

            const { data: cachedEnrichment } = await supabase
                .from('cached_enrichments')
                .select('data')
                .eq('domain', domain)
                .maybeSingle();
 
            let enrichedData = null;
 
            if (cachedEnrichment) {
                console.log("Enrichment Cache HIT!");
                enrichedData = cachedEnrichment.data as any;
                toast({
                    title: t("success"),
                    description: "Intelligence récupérée du cache ! ⚡",
                });
            } else {
                console.log("Enrichment Cache MISS. Calling local enrichment...");
 
                const openAiKey = await getKeyByProvider('openai');
                if (!openAiKey) {
                    toast({
                        title: "Clé OpenAI requise",
                        description: "Veuillez configurer votre clé OpenAI dans les Paramètres (Intégrations) pour utiliser l'enrichissement IA.",
                        variant: "destructive"
                    });
                    setIsEnriching(false);
                    return;
                }
 
                try {
                    const res = await enrichProspectLocally(
                        currentProspect.website,
                        openAiKey,
                        { name: currentProspect.name, company: currentProspect.company }
                    );
 
                    enrichedData = res;
 
                    // Save to Cache (Background)
                    (async () => {
                        await supabase
                            .from('cached_enrichments')
                            .insert([{
                                domain: domain,
                                data: enrichedData
                            }]);
                    })();
                } catch (enrichError: any) {
                    throw new Error(enrichError.message);
                }
            }
 
            if (enrichedData) {
                const aiIntelligence = enrichedData.ai_intelligence || {};
 
                const updatedProspect = {
                    ...currentProspect,
                    // Mettre à jour les infos de contact si trouvées
                    phone: enrichedData.phone || currentProspect.phone,
                    email: enrichedData.email || currentProspect.email,
                    score: enrichedData.score_global || currentProspect.score,
                    aiIntelligence: {
                        contactInfo: aiIntelligence.contact_info || { phones: [], emails: [], addresses: [] },
                        keyPeople: aiIntelligence.key_people || [],
                        activities: aiIntelligence.activities || {},
                        recentNews: aiIntelligence.recent_news || [],
                        companyCulture: aiIntelligence.company_culture || {},
                        opportunities: aiIntelligence.prospecting_opportunities || [],
                        salesScripts: aiIntelligence.sales_scripts || [],
                        executiveSummary: aiIntelligence.executive_summary || ""
                    }
                } as Prospect;
 
                // Important: Mettre à jour l'état local immédiatement pour la réactivité UI
                setLocalProspect(updatedProspect);
 
                // Persister dans la base de données
                try {
                    // 1. Mise à jour du score dans la table prospects
                    const { error: pError } = await supabase
                        .from("prospects")
                        .update({ score: updatedProspect.score })
                        .eq("id", currentProspect.id);
 
                    if (pError) console.error("Error updating prospect score:", pError);
 
                    // 2. Mise à jour des infos détaillées dans prospect_data
                    const { error: pdError } = await supabase
                        .from("prospect_data")
                        .update({
                            phone: updatedProspect.phone,
                            email: updatedProspect.email,
                            summary: updatedProspect.aiIntelligence?.executiveSummary,
                            ai_intelligence: updatedProspect.aiIntelligence // Stockage du JSON complet
                        })
                        .eq("prospect_id", currentProspect.id);
 
                    if (pdError) console.error("Error updating prospect data:", pdError);
                } catch (persistError) {
                    console.error("Persistence error:", persistError);
                }

                const contactCount = (aiIntelligence.contact_info?.phones?.length || 0) + (aiIntelligence.contact_info?.emails?.length || 0);
                toast({
                    title: t("aiEnrichmentSuccess"),
                    description: t("aiEnrichmentSuccessDesc", { contactCount, personCount: aiIntelligence.key_people?.length || 0 }),
                });
            } else {
                throw new Error(t("aiEnrichmentNoData"));
            }
        } catch (error: any) {
            console.error("AI Enrichment error:", error);
            toast({
                title: t("error"),
                description: t("aiEnrichmentError"),
                variant: "destructive",
            });
        } finally {
            setIsEnriching(false);
        }
    };


    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: t("copied"),
            description: t("copiedDesc"),
        });
    };

    const handleAIAnalysis = async () => {
        if (!currentProspect) return;

        // On s'assure que le prospect est sauvegardé
        const savedId = await ensureProspectSaved();
        if (!savedId) return;

        // Préparation des données pour l'agent
        const prospectData = {
            name: currentProspect.name,
            company: currentProspect.company,
            position: currentProspect.position,
            industry: currentProspect.industry || "B2B",
            website: currentProspect.website,
            web_intelligence: currentProspect.aiIntelligence || {}
        };

        const result = await analyzeProspect(savedId, prospectData);
        if (result) {
            // Mettre à jour l'état local pour refléter les changements
            setLocalProspect({
                ...currentProspect,
                summary: result.summary,
                aiIntelligence: {
                    ...(currentProspect.aiIntelligence as any || {}),
                    executiveSummary: result.summary,
                    ai_suggestions: result.suggestions
                }
            } as any);
        }
    };

    const isSocialUrl = (url?: string) => {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes("facebook.com") ||
            lowerUrl.includes("linkedin.com") ||
            lowerUrl.includes("instagram.com") ||
            lowerUrl.includes("twitter.com") ||
            lowerUrl.includes("x.com") ||
            lowerUrl.includes("youtube.com") ||
            lowerUrl.includes("tiktok.com");
    };

    const getUrlIcon = (url: string) => {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes("facebook.com")) return { icon: <Facebook size={14} />, color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "hover:border-blue-500/30", label: "Facebook" };
        if (lowerUrl.includes("linkedin.com")) return { icon: <Linkedin size={14} />, color: "text-blue-400", bgColor: "bg-blue-400/10", borderColor: "hover:border-blue-400/30", label: "LinkedIn" };
        if (lowerUrl.includes("instagram.com")) return { icon: <Instagram size={14} />, color: "text-pink-500", bgColor: "bg-pink-500/10", borderColor: "hover:border-pink-500/30", label: "Instagram" };
        if (lowerUrl.includes("twitter.com") || lowerUrl.includes("x.com")) return { icon: <Twitter size={14} />, color: "text-blue-300", bgColor: "bg-blue-300/10", borderColor: "hover:border-blue-300/30", label: "Twitter (X)" };
        if (lowerUrl.includes("youtube.com")) return { icon: <Youtube size={14} />, color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "hover:border-red-500/30", label: "YouTube" };
        if (lowerUrl.includes("pinterest.com") || lowerUrl.includes("pinterest.fr")) return { icon: <Pin size={14} />, color: "text-red-600", bgColor: "bg-red-600/10", borderColor: "hover:border-red-600/30", label: "Pinterest" };
        return { icon: <Globe size={14} />, color: "text-muted-foreground", bgColor: "bg-muted", borderColor: "hover:border-accent/30", label: t("visitWebsite") };
    };

    // Safe render helper for array items
    const renderSafeValue = (val: any) => {
        if (typeof val === 'string') return val;
        if (typeof val === 'number') return String(val);
        if (typeof val === 'object' && val !== null) {
            // Handle opening hours format {day: 'Monday', hours: '...'} or {day: '...', hour: '...'}
            if (val.day) {
                const day = val.day;
                let hours = val.hours || val.hour || "";
                // Localize "to" separator
                if (typeof hours === 'string') {
                    hours = hours.replace(/ to /gi, ` ${t("to")} `);
                }
                return `${day}${hours ? `: ${hours}` : ""}`;
            }
            // Try to extract a meaningful name or fallback to string
            return val.text || val.name || val.label || val.title || JSON.stringify(val).substring(0, 50) + '...';
        }
        return String(val);
    };

    // If not open, we can return null (optimization), OR keep it mounted but hidden.
    // Radix Dialog handles unmounting content usually.
    const isSafeEmail = (email?: string) => {
        if (!email) return false;
        const lowerEmail = email.toLowerCase();
        // Detect typical obfuscation keywords or "protected" messages
        return !lowerEmail.includes("protégée") &&
            !lowerEmail.includes("javascript") &&
            !lowerEmail.includes("[email protected]") &&
            !lowerEmail.includes("spammeurs") &&
            email.includes("@") &&
            email.length < 100; // Unusually long strings are likely obfuscation scripts
    };

    const isUUID = (id: string) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
    };

    const ensureProspectSaved = async (): Promise<string | null> => {
        if (!currentProspect) return null;

        // If it's already a UUID, we assume it's saved
        if (isUUID(currentProspect.id)) return currentProspect.id;

        console.log("Prospect is not saved yet (non-UUID ID). Saving now...");

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast({ title: t("error"), description: t("mustBeLoggedIn"), variant: "destructive" });
                return null;
            }

            // 1. Insert into prospects
            const { data: newP, error: pErr } = await supabase.from("prospects").insert([{
                source: currentProspect.source,
                score: currentProspect.score,
                user_id: user.id,
                status: 'new'
            }]).select().single();

            if (pErr) throw pErr;

            if (newP) {
                // 2. Insert into prospect_data
                const { error: pdErr } = await supabase.from("prospect_data").insert([{
                    prospect_id: newP.id,
                    name: currentProspect.name,
                    company: currentProspect.company,
                    position: currentProspect.position,
                    email: currentProspect.email,
                    phone: currentProspect.phone,
                    initials: currentProspect.initials,
                    website: currentProspect.website,
                    contract_details: currentProspect.contractDetails || null,
                    web_intelligence: currentProspect.aiIntelligence || null
                }]);

                if (pdErr) throw pdErr;

                // Update local state with new ID
                const updated = { ...currentProspect, id: newP.id };
                setLocalProspect(updated);
                return newP.id;
            }
            return null;
        } catch (error: any) {
            console.error("Error auto-saving prospect:", error);
            toast({ title: t("error"), description: t("errorSavingProspect"), variant: "destructive" });
            return null;
        }
    };

    if (!isOpen) return null;

    // Safety fallback if opened without prospect
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl p-0 overflow-hidden bg-background text-foreground border-border focus:outline-none shadow-2xl rounded-3xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>{t("prospectDetails")}: {currentProspect?.name}</DialogTitle>
                    <DialogDescription>{t("prospectDetailsDesc", { name: currentProspect?.name || "" })}</DialogDescription>
                </DialogHeader>

                <div className="flex h-[85vh] max-h-[850px]">
                    {!currentProspect ? (
                        <div className="flex-1 flex items-center justify-center p-12 text-muted-foreground">
                            <div className="text-center space-y-4">
                                <Loader2 className="mx-auto h-12 w-12 animate-spin opacity-20" />
                                <p>{t("loading")}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Left Sidebar - Prospect Info */}
                            <div className="w-1/3 border-r border-border p-6 space-y-8 bg-card overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <div className="relative inline-block mb-4">
                                            {currentProspect.photo || (currentProspect.contractDetails as any)?.photo ? (
                                                <img 
                                                    src={currentProspect.photo || (currentProspect.contractDetails as any)?.photo} 
                                                    alt={currentProspect.name}
                                                    className="h-24 w-24 rounded-full border-4 border-accent/20 object-cover shadow-lg"
                                                />
                                            ) : (
                                                <div className="h-24 w-24 rounded-full bg-accent/10 border-4 border-accent/20 flex items-center justify-center text-3xl font-bold text-accent shadow-lg">
                                                    {currentProspect.initials || "?"}
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 right-0 h-6 w-6 bg-green-500 rounded-full border-4 border-card"></div>
                                        </div>
                                        <h3 className="text-xl font-bold text-foreground">{currentProspect.name}</h3>
                                        <p className="text-muted-foreground text-sm font-medium">{currentProspect.position || t("positionUnknown")}</p>
                                        <div className="flex items-center justify-center gap-1 mt-1 text-xs text-muted-foreground/80">
                                            <Globe size={12} />
                                            <span>{currentProspect.company || t("companyUnknown")}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <Button
                                            onClick={() => handleAction("connect")}
                                            className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl shadow-md transition-all font-bold py-6"
                                        >
                                            <Plus className="mr-2" size={18} /> {t("addToCampaign")}
                                        </Button>
                                        <Button
                                            onClick={handleEnrich}
                                            disabled={isEnriching}
                                            className="w-full border-border text-foreground hover:bg-muted rounded-xl transition-all py-6"
                                            variant="outline"
                                        >
                                            {isEnriching ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck className="mr-2" size={18} />}
                                            <span className="font-medium">{isEnriching ? t("verifying") : t("verifyEnrich")}</span>
                                        </Button>
                                        <Button
                                            onClick={handleAIAnalysis}
                                            disabled={isAnalyzing}
                                            className="w-full border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/5 rounded-xl transition-all py-6"
                                            variant="outline"
                                        >
                                            {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Zap className="mr-2" size={18} />}
                                            <span className="font-bold">{isAnalyzing ? t("analyzing") : t("aiStrategy")}</span>
                                        </Button>
                                    </div>

                                    <div className={`rounded-2xl p-4 border transition-all duration-500 ${currentProspect.aiIntelligence ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-secondary/30 border-border/50'} flex items-center justify-between`}>
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{t("leadScore")}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-2xl font-black transition-colors duration-500 ${currentProspect.aiIntelligence ? 'text-emerald-500' : 'text-foreground'}`}>
                                                    {currentProspect.score || 0}%
                                                </span>
                                                <Badge className={`${currentProspect.aiIntelligence ? 'bg-emerald-500/20 text-emerald-500' : 'bg-accent/20 text-accent'} border-none text-[10px] px-1.5 py-0 transition-colors duration-500`}>
                                                    {t("highIntent")}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className={`h-10 w-10 rounded-full border-4 transition-colors duration-500 ${currentProspect.aiIntelligence ? 'border-emerald-500/30' : 'border-border'} flex items-center justify-center`}>
                                            <div className={`h-2 w-2 rounded-full animate-pulse transition-colors duration-500 ${currentProspect.aiIntelligence ? 'bg-emerald-500' : 'bg-accent'}`}></div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-border/50 mt-2">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[10px] uppercase font-bold text-accent tracking-wider">{t("businessDetails")}</span>
                                        </div>
                                        <div className="bg-secondary/30 p-3 rounded-xl border border-border/50 space-y-3">
                                            {currentProspect.website && !isSocialUrl(currentProspect.website) && isEnrichable(currentProspect.website) && (
                                                <a
                                                    href={currentProspect.website.startsWith('http') ? currentProspect.website : `https://${currentProspect.website}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 px-3 py-2 bg-background shadow-sm rounded-lg border border-border hover:border-blue-500/50 transition-all group"
                                                >
                                                    <div className={`${getUrlIcon(currentProspect.website).color}`}>
                                                        {getUrlIcon(currentProspect.website).icon}
                                                    </div>
                                                    <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                                                        {getUrlIcon(currentProspect.website).label}
                                                    </span>
                                                    <ExternalLink size={10} className="ml-auto text-muted-foreground/60 group-hover:text-blue-400" />
                                                </a>
                                            )}
                                            {(isSafeEmail(currentProspect.email) || currentProspect.phone) && (
                                                <div className="flex flex-col gap-2 pb-2 border-b border-border/10">
                                                    {isSafeEmail(currentProspect.email) && (
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <Mail size={12} className="text-accent" />
                                                            <span className="truncate">{currentProspect.email}</span>
                                                        </div>
                                                    )}
                                                    {currentProspect.phone && (
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <Phone size={12} className="text-accent" />
                                                            <span>{currentProspect.phone}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={12} className="text-accent shadow-sm" />
                                                    <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">{t("fullAddress")}</span>
                                                </div>
                                                <a
                                                    href={currentProspect.contractDetails?.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentProspect.contractDetails?.address || currentProspect.address || currentProspect.name)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block group/link mx-[-4px] px-[4px] py-1 rounded-md hover:bg-accent/5 transition-colors"
                                                >
                                                    <p className="text-xs text-foreground leading-relaxed pl-5 group-hover/link:text-accent transition-colors flex items-center gap-1">
                                                        {currentProspect.contractDetails?.address || currentProspect.address || t("addressNotAvailable")}
                                                        {(currentProspect.contractDetails?.address || currentProspect.address || currentProspect.contractDetails?.googleMapsUrl) && (
                                                            <ExternalLink size={10} className="opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                                        )}
                                                    </p>
                                                </a>
                                            </div>

                                            {currentProspect.contractDetails?.openingHours && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={12} className="text-amber-500" />
                                                        <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">{t("openingHours")}</span>
                                                    </div>
                                                    <div className="pl-5 space-y-1">
                                                        {currentProspect.contractDetails.openingHours.slice(0, 2).map((hour: string, idx: number) => (
                                                            <div key={idx} className="text-[10px] text-foreground/80">{hour}</div>
                                                        ))}
                                                        {currentProspect.contractDetails.openingHours.length > 2 && (
                                                            <div className="text-muted-foreground/60 italic text-[10px]">+{currentProspect.contractDetails.openingHours.length - 2} {t("otherDays")}...</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-border/50 mt-auto">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-3 block px-1">{t("socialNetworks")}</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {((currentProspect.socialLinks?.facebook) || (currentProspect.website && currentProspect.website.toLowerCase().includes("facebook.com"))) && (
                                                <a href={currentProspect.socialLinks?.facebook || currentProspect.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl border border-border/30 hover:border-blue-500/40 hover:bg-secondary/40 transition-all group">
                                                    <Facebook size={16} className="text-blue-500" />
                                                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-blue-400 transition-colors">Facebook</span>
                                                </a>
                                            )}
                                            {((currentProspect.socialLinks?.linkedin) || (currentProspect.website && currentProspect.website.toLowerCase().includes("linkedin.com"))) && (
                                                <a href={currentProspect.socialLinks?.linkedin || currentProspect.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl border border-border/30 hover:border-blue-400/40 hover:bg-secondary/40 transition-all group">
                                                    <Linkedin size={16} className="text-blue-400" />
                                                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-blue-400 transition-colors">LinkedIn</span>
                                                </a>
                                            )}
                                            {((currentProspect.socialLinks?.instagram) || (currentProspect.website && currentProspect.website.toLowerCase().includes("instagram.com"))) && (
                                                <a href={currentProspect.socialLinks?.instagram || currentProspect.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl border border-border/30 hover:border-pink-500/40 hover:bg-secondary/40 transition-all group">
                                                    <Instagram size={16} className="text-pink-500" />
                                                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-pink-400 transition-colors">Instagram</span>
                                                </a>
                                            )}
                                            {((currentProspect.socialLinks?.twitter) || (currentProspect.website && (currentProspect.website.toLowerCase().includes("twitter.com") || currentProspect.website.toLowerCase().includes("x.com")))) && (
                                                <a href={currentProspect.socialLinks?.twitter || currentProspect.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl border border-border/30 hover:border-blue-300/40 hover:bg-secondary/40 transition-all group">
                                                    <Twitter size={16} className="text-blue-300" />
                                                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-blue-300 transition-colors">Twitter (X)</span>
                                                </a>
                                            )}
                                            {((currentProspect.socialLinks?.youtube) || (currentProspect.website && currentProspect.website.toLowerCase().includes("youtube.com"))) && (
                                                <a href={currentProspect.socialLinks?.youtube || currentProspect.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl border border-border/30 hover:border-red-500/40 hover:bg-secondary/40 transition-all group">
                                                    <Youtube size={16} className="text-red-500" />
                                                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-red-500 transition-colors">YouTube</span>
                                                </a>
                                            )}
                                            {((currentProspect.socialLinks?.pinterest) || (currentProspect.website && (currentProspect.website.toLowerCase().includes("pinterest.com") || currentProspect.website.toLowerCase().includes("pinterest.fr")))) && (
                                                <a href={currentProspect.socialLinks?.pinterest || currentProspect.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl border border-border/30 hover:border-red-600/40 hover:bg-secondary/40 transition-all group">
                                                    <Pin size={16} className="text-red-600" />
                                                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-red-600 transition-colors">Pinterest</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div className="flex-1 overflow-y-auto bg-background scrollbar-thin scrollbar-thumb-muted">
                                <Tabs defaultValue="intelligence" className="w-full">
                                    {/* Tabs Header */}
                                    <div className="px-6 pt-6 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
                                        <TabsList className="bg-transparent border-none p-0 gap-8 h-auto">
                                            <TabsTrigger
                                                value="intelligence"
                                                className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none px-0 pb-4 text-sm font-medium text-muted-foreground transition-all"
                                            >
                                                <Globe size={16} className="mr-2" /> {t("webAnalyse")}
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="profile"
                                                className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none px-0 pb-4 text-sm font-medium text-muted-foreground transition-all"
                                            >
                                                <Users size={16} className="mr-2" /> {t("profile")}
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="linkedin"
                                                className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none px-0 pb-4 text-sm font-medium text-muted-foreground transition-all"
                                            >
                                                {currentProspect?.source === 'facebook' || currentProspect?.source === 'facebook_page' ? (
                                                    <><Facebook size={16} className="mr-2" /> Activité Facebook</>
                                                ) : (
                                                    <><Linkedin size={16} className="mr-2" /> {t("linkedinActivity")}</>
                                                )}
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="ai"
                                                className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none px-0 pb-4 text-sm font-medium text-muted-foreground transition-all"
                                            >
                                                <Zap size={16} className="mr-2" /> {t("aiScripts")}
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <div className="p-6">
                                        <TabsContent value="intelligence" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-bold flex items-center gap-2">
                                                    <ShieldCheck className="text-emerald-500" size={20} />
                                                    {t("webIntelligence")}
                                                </h3>
                                                <Badge className={`${currentProspect.aiIntelligence ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"} border-none transition-colors duration-500 uppercase tracking-tighter`}>
                                                    {currentProspect.aiIntelligence ? t("verified") : t("notVerified")}
                                                </Badge>
                                            </div>

                                            {isEnriching ? (
                                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/20 animate-in fade-in zoom-in duration-500">
                                                    <div className="relative">
                                                        <div className="h-24 w-24 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse">
                                                            <Logo size="md" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <h4 className="text-xl font-bold text-emerald-500 animate-bounce">{t("aiAnalyzingWeb")}</h4>
                                                        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                                                            {t("aiExtractingInfo")}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" />
                                                    </div>
                                                </div>
                                            ) : currentProspect.aiIntelligence ? (
                                                <div className="space-y-8 animate-in fade-in duration-500">
                                                    {/* Executive Summary */}
                                                    {(currentProspect.aiIntelligence?.executiveSummary || currentProspect.summary || currentProspect.aiIntelligence?.executive_summary) && (
                                                        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-6 rounded-2xl border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                                                            <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                                                                <Users size={16} /> {t("profileSummary")}
                                                            </h4>
                                                            <p className="text-sm text-foreground/90 leading-relaxed italic">
                                                                "{currentProspect.aiIntelligence?.executiveSummary || currentProspect.summary || currentProspect.aiIntelligence?.executive_summary}"
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* AI Strategic Suggestions */}
                                                    {(currentProspect.aiIntelligence as any)?.ai_suggestions && (
                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-bold flex items-center gap-2 text-primary">
                                                                <Zap size={18} className="text-emerald-500" /> {t("aiSuggestionsTitle")}
                                                            </h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                {(currentProspect.aiIntelligence as any).ai_suggestions.map((s: any, i: number) => (
                                                                    <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                                                                s.type === 'email' ? 'bg-blue-100 text-blue-600' :
                                                                                s.type === 'linkedin' ? 'bg-indigo-100 text-indigo-600' :
                                                                                'bg-orange-100 text-orange-600'
                                                                            }`}>
                                                                                {s.type}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 mb-1">{s.label}</p>
                                                                        <p className="text-[10px] text-slate-500 leading-tight">{s.description}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Contact & Decisions */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-4">
                                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                                <Phone size={14} className="text-accent" /> {t("phones")}
                                                            </h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {currentProspect.aiIntelligence.contactInfo?.phones?.map((phone, idx) => (
                                                                    <a key={idx} href={`tel:${phone}`} className="px-3 py-2 bg-secondary/40 rounded-lg border border-border/50 text-sm text-blue-500 hover:bg-secondary/60 transition-colors">
                                                                        {phone}
                                                                    </a>
                                                                )) || <p className="text-xs text-muted-foreground italic">{t("noPhoneExtracted")}</p>}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                                <Mail size={14} className="text-accent" /> {t("emails")}
                                                            </h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {currentProspect.aiIntelligence.contactInfo?.emails?.filter(isSafeEmail).map((email, idx) => (
                                                                    <a key={idx} href={`mailto:${email}`} className="px-3 py-2 bg-secondary/40 rounded-lg border border-border/50 text-sm text-blue-500 hover:bg-secondary/60 transition-colors">
                                                                        {email}
                                                                    </a>
                                                                )) || <p className="text-xs text-muted-foreground italic">{t("noEmailExtracted")}</p>}
                                                                {currentProspect.aiIntelligence.contactInfo?.emails?.filter(isSafeEmail).length === 0 && (
                                                                    <p className="text-xs text-muted-foreground italic">{t("noEmailExtracted")}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Opportunities */}
                                                    <div className="space-y-4">
                                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                                            <Zap size={18} className="text-accent" /> {t("businessOpportunities")}
                                                        </h4>
                                                        <div className="grid grid-cols-1 gap-3">
                                                            {currentProspect.aiIntelligence.opportunities && currentProspect.aiIntelligence.opportunities.length > 0 ? (
                                                                currentProspect.aiIntelligence.opportunities.map((opp, idx) => (
                                                                    <div key={idx} className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20">
                                                                        <h5 className="text-sm font-bold text-emerald-500 mb-1">{opp.signal}</h5>
                                                                        <p className="text-xs text-muted-foreground leading-relaxed">{opp.context}</p>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground italic px-2 py-4 bg-muted/10 rounded-xl border border-dashed border-border/30">
                                                                    {t("noOpportunitiesFound")}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-muted/20 rounded-3xl border border-dashed border-border/50">
                                                    <div className="h-20 w-20 rounded-full bg-accent/5 flex items-center justify-center text-accent mb-2">
                                                        <Sparkles size={40} className="animate-pulse" />
                                                    </div>
                                                    <h4 className="text-xl font-bold text-foreground">{t("aiAnalysisRequired")}</h4>
                                                    <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                                                        {t("extractIntelligenceDesc")}
                                                    </p>
                                                    <Button
                                                        onClick={handleEnrich}
                                                        className="bg-accent hover:bg-accent/90 text-white rounded-full px-8 py-6 h-auto shadow-lg shadow-accent/20 transition-all hover:scale-105"
                                                    >
                                                        <Sparkles className="mr-2 h-5 w-5" />
                                                        {t("extractIntelligence")}
                                                    </Button>
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="profile" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                            {/* PROFIL A PROPOS (Contract Details) */}
                                            {currentProspect.contractDetails ? (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                                            <Users className="text-primary" size={20} /> Profil {currentProspect.source === 'facebook' || currentProspect.source === 'facebook_page' ? 'Facebook' : 'LinkedIn'}
                                                        </h3>
                                                        
                                                        {/* Profile URL links */}
                                                        <div className="flex gap-2">
                                                            {currentProspect.socialLinks?.linkedin && (
                                                                <a
                                                                    href={currentProspect.socialLinks.linkedin}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-400 text-sm hover:bg-blue-500/10 transition-colors w-fit"
                                                                >
                                                                    <Linkedin size={14} />
                                                                    Voir le profil LinkedIn
                                                                </a>
                                                            )}
                                                            {currentProspect.socialLinks?.facebook && (
                                                                <a
                                                                    href={currentProspect.socialLinks.facebook}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-400/20 bg-blue-400/5 text-blue-400 text-sm hover:bg-blue-400/10 transition-colors w-fit"
                                                                >
                                                                    <span style={{fontSize:14}}>📘</span>
                                                                    Voir le profil Facebook
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* About / Bio */}
                                                    {currentProspect.contractDetails.about && (
                                                        <div className="space-y-2">
                                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Résumé</h5>
                                                            <p className="text-sm text-foreground/80 leading-relaxed bg-muted/10 rounded-xl p-4 border border-border/30 whitespace-pre-wrap">
                                                                {currentProspect.contractDetails.about}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Company Specific Details (LinkedIn/Facebook Pages) */}
                                                    {(currentProspect.contractDetails.industry || currentProspect.contractDetails.foundedYear || currentProspect.contractDetails.employeeCount || currentProspect.contractDetails.companyType) && (
                                                        <div className="space-y-3 mt-4">
                                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Informations Générales</h5>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {currentProspect.contractDetails.industry && (
                                                                    <div className="p-3 bg-secondary/20 rounded-xl border border-border/30 flex flex-col gap-1">
                                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Secteur</span>
                                                                        <span className="text-sm font-semibold text-foreground/90">{currentProspect.contractDetails.industry}</span>
                                                                    </div>
                                                                )}
                                                                {currentProspect.contractDetails.employeeCount && (
                                                                    <div className="p-3 bg-secondary/20 rounded-xl border border-border/30 flex flex-col gap-1">
                                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Taille de l'entreprise</span>
                                                                        <span className="text-sm font-semibold text-foreground/90">{currentProspect.contractDetails.employeeCount} {currentProspect.contractDetails.companySize && `(${currentProspect.contractDetails.companySize})`}</span>
                                                                    </div>
                                                                )}
                                                                {currentProspect.contractDetails.companyType && (
                                                                    <div className="p-3 bg-secondary/20 rounded-xl border border-border/30 flex flex-col gap-1">
                                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Type d'entreprise</span>
                                                                        <span className="text-sm font-semibold text-foreground/90">{currentProspect.contractDetails.companyType}</span>
                                                                    </div>
                                                                )}
                                                                {currentProspect.contractDetails.foundedYear && (
                                                                    <div className="p-3 bg-secondary/20 rounded-xl border border-border/30 flex flex-col gap-1">
                                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Fondée en</span>
                                                                        <span className="text-sm font-semibold text-foreground/90">{currentProspect.contractDetails.foundedYear}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Specialties */}
                                                    {currentProspect.contractDetails.specialties?.length > 0 && (
                                                        <div className="space-y-2 mt-4">
                                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Spécialisations</h5>
                                                            <div className="flex flex-wrap gap-2">
                                                                {currentProspect.contractDetails.specialties.map((spec: string, i: number) => (
                                                                    <span key={i} className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs font-medium border border-accent/20">
                                                                        {spec}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Experiences */}
                                                    {currentProspect.contractDetails.experiences?.length > 0 && (
                                                        <div className="space-y-3">
                                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expériences</h5>
                                                            <div className="space-y-2">
                                                                {currentProspect.contractDetails.experiences.map((exp: any, i: number) => (
                                                                    <div key={i} className="flex gap-3 p-3 rounded-xl bg-muted/10 border border-border/30">
                                                                        <div className="min-w-0">
                                                                            <p className="text-sm font-semibold text-foreground truncate">{exp.role}</p>
                                                                            <p className="text-xs text-muted-foreground">{exp.company}</p>
                                                                            {exp.duration && <p className="text-[10px] text-muted-foreground/60">{exp.duration}</p>}
                                                                            {exp.description && <p className="text-xs text-foreground/70 mt-1 line-clamp-2">{exp.description}</p>}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Education */}
                                                    {currentProspect.contractDetails.education?.length > 0 && (
                                                        <div className="space-y-3">
                                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Formation</h5>
                                                            <div className="space-y-2">
                                                                {currentProspect.contractDetails.education.map((edu: any, i: number) => (
                                                                    <div key={i} className="p-3 rounded-xl bg-muted/10 border border-border/30">
                                                                        <p className="text-sm font-semibold">{edu.school}</p>
                                                                        {edu.degree && <p className="text-xs text-muted-foreground">{edu.degree}</p>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Skills */}
                                                    {currentProspect.contractDetails.skills?.length > 0 && (
                                                            <div className="space-y-3">
                                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Compétences</h5>
                                                            <div className="flex flex-wrap gap-2">
                                                                {currentProspect.contractDetails.skills.slice(0, 15).map((skill: any, i: number) => (
                                                                    <span key={i} className="px-2 py-1 bg-secondary/40 rounded-md text-xs border border-border/50 text-foreground/80">
                                                                        {skill.name} {skill.endorsements ? `(${skill.endorsements})` : ''}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Certifications */}
                                                    {currentProspect.contractDetails.certifications?.length > 0 && (
                                                        <div className="space-y-3">
                                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Certifications</h5>
                                                            <div className="space-y-2">
                                                                {currentProspect.contractDetails.certifications.map((cert: any, i: number) => (
                                                                    <div key={i} className="p-3 rounded-xl bg-muted/10 border border-border/30">
                                                                        <p className="text-sm font-semibold">{cert.name}</p>
                                                                        {cert.issuer && <p className="text-xs text-muted-foreground">{cert.issuer}</p>}
                                                                        {cert.date && <p className="text-[10px] text-muted-foreground/60">{cert.date}</p>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Recommandations */}
                                                    {currentProspect.contractDetails.recommendations?.length > 0 && (
                                                        <div className="space-y-3">
                                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recommandations</h5>
                                                            <div className="space-y-2">
                                                                {currentProspect.contractDetails.recommendations.map((rec: any, i: number) => (
                                                                    <div key={i} className="p-3 rounded-xl bg-muted/10 border border-border/30">
                                                                        <p className="text-sm font-semibold">{rec.from}</p>
                                                                        {rec.role && <p className="text-xs text-muted-foreground">{rec.role}</p>}
                                                                        {rec.text && <p className="text-xs text-foreground/70 mt-1 italic line-clamp-3">"{rec.text}"</p>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="py-20 text-center bg-muted/20 rounded-3xl border border-dashed border-border/50">
                                                    <Users size={40} className="mx-auto text-muted-foreground/30 mb-4" />
                                                    <p className="text-muted-foreground italic">Aucune information de profil extraite.</p>
                                                </div>
                                            )}
                                        </TabsContent>

                                        <TabsContent value="linkedin" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                            <h3 className="text-lg font-bold flex items-center gap-2">
                                                {currentProspect?.source === 'facebook' || currentProspect?.source === 'facebook_page' ? (
                                                    <><Facebook className="text-blue-500" size={20} /> Activité Facebook</>
                                                ) : (
                                                    <><Linkedin className="text-blue-500" size={20} /> {t("linkedinActivity")}</>
                                                )}
                                            </h3>



                                            {/* LinkedIn Activities (Posts and Comments) */}
                                            {currentProspect.aiIntelligence?.activities?.posts?.length > 0 ? (
                                                <div className="space-y-4">
                                                    <h4 className="text-sm font-bold flex items-center gap-2 text-primary">
                                                        <MessageSquare size={18} className="text-blue-500" /> Posts récents
                                                    </h4>
                                                    <div className="grid grid-cols-1 gap-4">
                                                        {currentProspect.aiIntelligence.activities.posts.map((post: any, i: number) => (
                                                            <div key={i} className="p-4 bg-muted/10 rounded-2xl border border-border/30">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="text-xs font-semibold text-muted-foreground">{post.date}</span>
                                                                    <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full font-medium uppercase">{post.actionType}</span>
                                                                </div>
                                                                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{post.text}</p>
                                                                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                                                                    <span className="flex items-center gap-1"><ThumbsUp size={12}/> {post.likes}</span>
                                                                    <span className="flex items-center gap-1"><MessageCircle size={12}/> {post.comments}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}

                                            {currentProspect.aiIntelligence?.activities?.comments?.length > 0 ? (
                                                 <div className="space-y-4">
                                                    <h4 className="text-sm font-bold flex items-center gap-2 text-primary mt-4">
                                                        <MessageCircle size={18} className="text-blue-500" /> Commentaires récents
                                                    </h4>
                                                    <div className="grid grid-cols-1 gap-4">
                                                        {currentProspect.aiIntelligence.activities.comments.map((comment: any, i: number) => (
                                                            <div key={i} className="p-4 bg-muted/10 rounded-2xl border border-border/30">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="text-xs font-semibold text-muted-foreground">{comment.date}</span>
                                                                </div>
                                                                <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg mb-3 border border-border/20 text-xs">
                                                                    <p className="font-semibold mb-1 text-muted-foreground">{comment.originalPost?.author}</p>
                                                                    <p className="text-muted-foreground/80 line-clamp-2">{comment.originalPost?.text}</p>
                                                                </div>
                                                                <p className="text-sm font-medium text-foreground/90 whitespace-pre-wrap">↳ {comment.myComment}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}

                                            {(!currentProspect.aiIntelligence?.activities?.posts?.length) &&
                                             (!currentProspect.aiIntelligence?.activities?.comments?.length) && (
                                                <div className="py-20 text-center bg-muted/20 rounded-3xl border border-dashed border-border/50">
                                                    <MessageSquare size={40} className="mx-auto text-muted-foreground/30 mb-4" />
                                                    <p className="text-muted-foreground italic">Aucune activité récente (posts ou commentaires) trouvée.</p>
                                                </div>
                                            )}
                                        </TabsContent>


                                        <TabsContent value="ai" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                            {isEnriching ? (
                                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/20 animate-in fade-in zoom-in duration-500">
                                                    <div className="relative">
                                                        <div className="h-24 w-24 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse">
                                                            <Logo size="md" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <h4 className="text-xl font-bold text-emerald-500 animate-bounce">{t("generatingScripts")}</h4>
                                                        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                                                            Nous créons des emails d'approche et des elevator pitchs sur mesure.
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                                            <Zap className="text-emerald-500" size={20} /> {t("salesScripts")}
                                                        </h3>
                                                        {currentProspect.aiIntelligence?.salesScripts && (
                                                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/5">
                                                                {currentProspect.aiIntelligence.salesScripts.length} générés
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-4">
                                                        {currentProspect.aiIntelligence?.salesScripts && currentProspect.aiIntelligence.salesScripts.length > 0 ? (
                                                            currentProspect.aiIntelligence.salesScripts.map((script, idx) => (
                                                                <div key={idx} className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/20 group hover:border-emerald-500/40 transition-all duration-300">
                                                                    <div className="flex items-center justify-between mb-4">
                                                                        <h4 className="text-sm font-bold text-emerald-500 flex items-center gap-2 capitalize">
                                                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                            {script.title}
                                                                        </h4>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(script.content);
                                                                                toast({ title: t("copied"), description: t("copiedDesc") });
                                                                            }}
                                                                        >
                                                                            <Copy size={14} />
                                                                        </Button>
                                                                    </div>
                                                                    <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap bg-card/50 p-4 rounded-xl border border-border/30">
                                                                        {script.content}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="bg-muted/10 p-10 rounded-2xl border border-dashed border-border/50 text-center">
                                                                <Sparkles size={32} className="mx-auto text-muted-foreground/30 mb-4" />
                                                                <p className="text-sm text-muted-foreground italic">
                                                                    {t("aiEnrichmentCallDesc")}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>

            {/* Campaign Selection Dialog */}
            <CampaignSelectionDialog
                isOpen={isCampaignDialogOpen}
                onOpenChange={setIsCampaignDialogOpen}
                prospectIds={prospectIdsForCampaign}
            />
        </Dialog>
    );
};

export default ProspectDetailView;
