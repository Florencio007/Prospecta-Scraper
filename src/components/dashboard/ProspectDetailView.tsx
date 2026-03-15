import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Globe, MessageCircle, ExternalLink, ShieldCheck, Zap, Linkedin, Facebook, Instagram, Twitter, Youtube, Pin, Share2, Copy, Save, X, MapPin, Sparkles, Loader2, Plus, Clock, Users, MessageSquare, ThumbsUp, Star, Info } from "lucide-react";
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
import { LoadingLogo } from "@/components/LoadingLogo";
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
        // Try to load enriched data from localStorage first - user requirement
        const cacheKey = `enrichment_${prospect.id}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                // Basic validation: ensure it's still the same prospect
                if (parsed.id === prospect.id) {
                    setLocalProspect(parsed);
                } else {
                    setLocalProspect(prospect);
                }
            } catch (e) {
                setLocalProspect(prospect);
            }
        } else {
            setLocalProspect(prospect);
        }
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

        // Ensure saved before enriching to have a valid UUID for updates
        const savedId = await ensureProspectSaved();
        if (!savedId) return;

        const openAiKey = await getKeyByProvider('openai');
        if (!openAiKey) {
            toast({
                title: "Clé OpenAI requise",
                description: "Veuillez configurer votre clé OpenAI dans les Paramètres (Intégrations) pour utiliser l'enrichissement IA.",
                variant: "destructive"
            });
            return;
        }

        setIsEnriching(true);

        try {
            const hasWebsite = !!currentProspect.website && 
                             !currentProspect.website.toLowerCase().includes("google.com/maps") && 
                             !currentProspect.website.toLowerCase().includes("goo.gl/maps");

            console.log(hasWebsite ? "Starting Website Enrichment..." : "Starting Google Search Enrichment...");

            const queryParams = new URLSearchParams({
                name: currentProspect.name,
                company: currentProspect.company || '',
                l: currentProspect.city || '',
                id: currentProspect.id || '',
                website: currentProspect.website || '',
                openAiKey: openAiKey
            });

            const endpoint = hasWebsite ? '/api/scrape/enrich-website' : '/api/scrape/enrich-google';
            const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
            const eventSource = new EventSource(`${serverUrl}${endpoint}?${queryParams.toString()}`);

            eventSource.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.message) {
                        // Progress update
                        console.log(`Enrichment Progress: ${data.percentage}% - ${data.message}`);
                    }

                    if (data.result) {
                        const enrichedData = data.result;
                        const aiIntelligence = enrichedData.ai_intelligence || {};

                        const updatedProspect = {
                            ...currentProspect,
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
                                executiveSummary: aiIntelligence.executive_summary || "",
                                ai_suggestions: aiIntelligence.ai_suggestions || []
                            }
                        } as Prospect;

                        // Important: Update UI immediately
                        setLocalProspect(updatedProspect);

                        // Browser Persistence (localStorage) - user requirement
                        localStorage.setItem(`enrichment_${currentProspect.id}`, JSON.stringify(updatedProspect));

                        // DB Persistence (Supabase)
                        if (currentProspect.id) {
                            try {
                                await supabase
                                    .from("prospects")
                                    .update({ score: updatedProspect.score } as any)
                                    .eq("id", currentProspect.id);

                                await supabase
                                    .from("prospect_data")
                                    .update({
                                        phone: updatedProspect.phone,
                                        email: updatedProspect.email,
                                        summary: updatedProspect.aiIntelligence?.executiveSummary,
                                        ai_intelligence: updatedProspect.aiIntelligence
                                    } as any)
                                    .eq("prospect_id", currentProspect.id);
                            } catch (pErr) {
                                console.error("DB Update error:", pErr);
                            }
                        }

                        const contactCount = (aiIntelligence.contact_info?.phones?.length || 0) + (aiIntelligence.contact_info?.emails?.length || 0);
                        toast({
                            title: t("aiEnrichmentSuccess"),
                            description: t("aiEnrichmentSuccessDesc", { contactCount, personCount: aiIntelligence.key_people?.length || 0 }),
                        });

                        eventSource.close();
                        setIsEnriching(false);
                    }

                    if (data.error) {
                        throw new Error(data.error);
                    }
                } catch (e: any) {
                    console.error("Event processing error:", e);
                    toast({
                        title: t("error"),
                        description: e.message || t("aiEnrichmentError"),
                        variant: "destructive"
                    });
                    eventSource.close();
                    setIsEnriching(false);
                }
            };

            eventSource.onerror = (err) => {
                console.error("EventSource error:", err);
                eventSource.close();
                setIsEnriching(false);
                toast({
                    title: t("error"),
                    description: "Erreur de connexion avec le serveur d'enrichissement",
                    variant: "destructive"
                });
            };

        } catch (error: any) {
            console.error("AI Enrichment error:", error);
            toast({
                title: t("error"),
                description: t("aiEnrichmentError"),
                variant: "destructive",
            });
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

            // 0. Check if prospect already exists by email OR name+company to avoid unique constraint error
            if (currentProspect.email || (currentProspect.name && currentProspect.company)) {
                let existing = null;
                
                // Try by email first
                if (currentProspect.email) {
                    const { data: byEmail } = await supabase
                        .from("prospect_data")
                        .select("prospect_id, prospects!inner(user_id)")
                        .eq("email", currentProspect.email)
                        .eq("prospects.user_id", user.id)
                        .maybeSingle();
                    if (byEmail) existing = byEmail;
                }
                
                // Fallback to name + company
                if (!existing && currentProspect.name && currentProspect.company) {
                    const { data: byName } = await supabase
                        .from("prospect_data")
                        .select("prospect_id, prospects!inner(user_id)")
                        .eq("name", currentProspect.name)
                        .eq("company", currentProspect.company)
                        .eq("prospects.user_id", user.id)
                        .maybeSingle();
                    if (byName) existing = byName;
                }
                
                if (existing) {
                    console.log("Prospect already exists in DB. Using existing ID:", existing.prospect_id);
                    const updated = { ...currentProspect, id: existing.prospect_id as string };
                    setLocalProspect(updated);
                    return existing.prospect_id as string;
                }
            }

            // 1. Insert into prospects
            const { data: newP, error: pErr } = await supabase.from("prospects").insert([{
                source: currentProspect.source,
                score: currentProspect.score,
                user_id: user.id,
                status: 'new'
            }]).select().single() as any;

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
            const errorMessage = error.message || error.details || t("errorSavingProspect");
            toast({ 
                title: t("error"), 
                description: `${t("errorSavingProspect")}: ${errorMessage}`, 
                variant: "destructive" 
            });
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
                                <LoadingLogo size="lg" className="opacity-40" />
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
                                        <div className="flex flex-col items-center justify-center gap-1 mt-1">
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground/80">
                                                <Globe size={12} />
                                                <span>{currentProspect.company || t("companyUnknown")}</span>
                                            </div>
                                            {(currentProspect.contractDetails?.starRating || currentProspect.contractDetails?.price) && (
                                                <div className="flex items-center gap-3 mt-2">
                                                    {currentProspect.contractDetails?.starRating && (
                                                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">
                                                            <Star size={10} className="mr-1 fill-amber-500" /> {currentProspect.contractDetails.starRating}
                                                        </Badge>
                                                    )}
                                                    {currentProspect.contractDetails?.price && (
                                                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                                                            {currentProspect.contractDetails.price}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
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
                                            {isEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="mr-2" size={18} />}
                                            <span className="font-medium">{isEnriching ? t("verifying") : t("extractIntelligence")}</span>
                                        </Button>
                                        <Button
                                            onClick={handleAIAnalysis}
                                            disabled={isAnalyzing}
                                            className="w-full border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/5 rounded-xl transition-all py-6"
                                            variant="outline"
                                        >
                                            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="mr-2" size={18} />}
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
                                            
                                            {/* Plateformes Google Maps Additionnelles */}
                                            {currentProspect.contractDetails?.platformLinks && Array.isArray(currentProspect.contractDetails.platformLinks) && currentProspect.contractDetails.platformLinks.map((pl: any, idx: number) => (
                                                <a key={idx} href={pl.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-secondary/20 rounded-xl border border-border/30 hover:border-accent/40 hover:bg-secondary/40 transition-all group">
                                                    <Globe size={16} className="text-accent" />
                                                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-accent transition-colors">{pl.name}</span>
                                                </a>
                                            ))}
                                            
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
                                                        <LoadingLogo size="lg" compact />
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
                                                    {/* Executive Summary — FIXED: was wrapped in literal string quotes */}
                                                    {(currentProspect.aiIntelligence?.executiveSummary || currentProspect.summary || (currentProspect.aiIntelligence as any)?.executive_summary) && (
                                                        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-6 rounded-2xl border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                                                            <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                                                                <Users size={16} /> {t("profileSummary")}
                                                            </h4>
                                                            <p className="text-sm text-foreground/90 leading-relaxed italic">
                                                                &ldquo;{currentProspect.aiIntelligence?.executiveSummary || currentProspect.summary || (currentProspect.aiIntelligence as any)?.executive_summary}&rdquo;
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
                                                                {currentProspect.aiIntelligence.contactInfo?.phones?.length > 0 ? (
                                                                    currentProspect.aiIntelligence.contactInfo.phones.map((phone, idx) => (
                                                                        <a key={idx} href={`tel:${phone}`} className="px-3 py-2 bg-secondary/40 rounded-lg border border-border/50 text-sm text-blue-500 hover:bg-secondary/60 transition-colors">
                                                                            {phone}
                                                                        </a>
                                                                    ))
                                                                ) : <p className="text-xs text-muted-foreground italic">{t("noPhoneExtracted")}</p>}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                                <Mail size={14} className="text-accent" /> {t("emails")}
                                                            </h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {currentProspect.aiIntelligence.contactInfo?.emails?.filter(isSafeEmail).length > 0 ? (
                                                                    currentProspect.aiIntelligence.contactInfo.emails.filter(isSafeEmail).map((email, idx) => (
                                                                        <a key={idx} href={`mailto:${email}`} className="px-3 py-2 bg-secondary/40 rounded-lg border border-border/50 text-sm text-blue-500 hover:bg-secondary/60 transition-colors">
                                                                            {email}
                                                                        </a>
                                                                    ))
                                                                ) : <p className="text-xs text-muted-foreground italic">{t("noEmailExtracted")}</p>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Key People - NEW */}
                                                    {currentProspect.aiIntelligence.keyPeople && currentProspect.aiIntelligence.keyPeople.length > 0 && (
                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-bold flex items-center gap-2">
                                                                <Users size={18} className="text-blue-500" /> Personnes Clés
                                                            </h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                {currentProspect.aiIntelligence.keyPeople.map((person, idx) => (
                                                                    <div key={idx} className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <p className="text-sm font-bold text-foreground">{person.name}</p>
                                                                            <Badge variant="outline" className="text-[9px] uppercase">{person.role}</Badge>
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground line-clamp-2">{person.context}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Activities & Services - NEW */}
                                                    {currentProspect.aiIntelligence.activities && (Object.keys(currentProspect.aiIntelligence.activities).length > 0) && (
                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-bold flex items-center gap-2">
                                                                <Zap size={18} className="text-amber-500" /> Activités & Spécialités
                                                            </h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                {currentProspect.aiIntelligence.activities.services && currentProspect.aiIntelligence.activities.services.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Services</p>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {currentProspect.aiIntelligence.activities.services.map((s, i) => (
                                                                                <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {currentProspect.aiIntelligence.activities.technologies && currentProspect.aiIntelligence.activities.technologies.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Technologies</p>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {currentProspect.aiIntelligence.activities.technologies.map((t, i) => (
                                                                                <Badge key={i} variant="outline" className="text-[10px] border-blue-500/20 text-blue-500">{t}</Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {currentProspect.aiIntelligence.activities.sectors && currentProspect.aiIntelligence.activities.sectors.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Secteurs</p>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {currentProspect.aiIntelligence.activities.sectors.map((s, i) => (
                                                                                <Badge key={i} variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-500">{s}</Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Recent News - NEW */}
                                                    {currentProspect.aiIntelligence.recentNews && currentProspect.aiIntelligence.recentNews.length > 0 && (
                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-bold flex items-center gap-2">
                                                                <Globe size={18} className="text-blue-400" /> Actualités Récentes
                                                            </h4>
                                                            <div className="space-y-3">
                                                                {currentProspect.aiIntelligence.recentNews.map((news, idx) => (
                                                                    <div key={idx} className="p-4 bg-muted/20 rounded-xl border border-border/30">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <Badge className="text-[9px] uppercase bg-blue-400/10 text-blue-500 border-none">{news.type}</Badge>
                                                                        </div>
                                                                        <p className="text-xs text-foreground/80 leading-relaxed">{news.description}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Company Culture - NEW */}
                                                    {currentProspect.aiIntelligence.companyCulture && (currentProspect.aiIntelligence.companyCulture.mission || (currentProspect.aiIntelligence.companyCulture.values && currentProspect.aiIntelligence.companyCulture.values.length > 0)) && (
                                                        <div className="space-y-4">
                                                            <h4 className="text-sm font-bold flex items-center gap-2">
                                                                <ShieldCheck size={18} className="text-emerald-500" /> Vision & Valeurs
                                                            </h4>
                                                            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-3">
                                                                {currentProspect.aiIntelligence.companyCulture.mission && (
                                                                    <div>
                                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Mission</p>
                                                                        <p className="text-sm italic text-foreground/80">"{currentProspect.aiIntelligence.companyCulture.mission}"</p>
                                                                    </div>
                                                                )}
                                                                {currentProspect.aiIntelligence.companyCulture.values && currentProspect.aiIntelligence.companyCulture.values.length > 0 && (
                                                                    <div>
                                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Valeurs</p>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {currentProspect.aiIntelligence.companyCulture.values.map((val, i) => (
                                                                                <span key={i} className="text-xs font-medium text-emerald-600 dark:text-emerald-400">#{val}</span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

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
                                                            <Users className="text-primary" size={20} /> Profil {
                                                                currentProspect.source === 'facebook' || currentProspect.source === 'facebook_page' ? 'Facebook' : 
                                                                currentProspect.source === 'google_maps' ? 'Google Maps' : 'LinkedIn'
                                                            }
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
                                                    
                                                    {/* Description IA générée automatiquement depuis les données disponibles */}
                                                    {(() => {
                                                        const cd = currentProspect.contractDetails as any;
                                                        const isFb = currentProspect.source === 'facebook' || currentProspect.source === 'facebook_page';

                                                        // Génère une description riche à partir des données collectées
                                                        const parts: string[] = [];
                                                        const name = currentProspect.name || currentProspect.company || '';

                                                        // Vue d'ensemble / About
                                                        let rawAbout = cd?.about;
                                                        let overview = '';
                                                        let amenities: string[] = [];
                                                        
                                                        if (rawAbout && typeof rawAbout === 'object') {
                                                            overview = rawAbout.description || rawAbout.overview || '';
                                                            amenities = rawAbout.amenities || [];
                                                        } else {
                                                            overview = rawAbout || cd?.description || cd?.overview || currentProspect.summary || '';
                                                        }
                                                        
                                                        const overviewStr = typeof overview === 'string' ? overview : String(overview || '');

                                                         if (overviewStr) parts.push(overviewStr);

                                                        // Données structurées
                                                        const sector = cd?.industry || cd?.category || cd?.sector || '';
                                                        const size = cd?.employeeCount || cd?.companySize || '';
                                                        const founded = cd?.foundedYear || cd?.founded || '';
                                                        const hq = cd?.address || cd?.headquarters || cd?.location || currentProspect.address || '';
                                                        const specs = Array.isArray(cd?.specialties) && cd.specialties.length > 0 ? cd.specialties.slice(0, 4).join(', ') : '';
                                                        const site = cd?.website || currentProspect.website || '';
                                                        const followers = cd?.followers || '';

                                                        // Construction intelligente si pas de vue d'ensemble
                                                        if (!overviewStr && name) {
                                                            let desc = `${name}`;
                                                            if (sector) desc += ` est une entreprise spécialisée dans le secteur ${sector}`;
                                                            if (hq) desc += ` basée à ${hq}`;
                                                            if (founded) desc += `, fondée en ${founded}`;
                                                            if (size) desc += `. Elle compte environ ${size} collaborateurs`;
                                                            if (specs) desc += `. Ses domaines d'expertise incluent : ${specs}`;
                                                            if (site) desc += `. Présence web : ${site}`;
                                                            if (followers) desc += `. ${followers} sur les réseaux sociaux`;
                                                            desc += '.';
                                                            parts.push(desc);
                                                        } else if (overviewStr && typeof overviewStr === 'string') {
                                                            // Complète la description avec des métadonnées structurées
                                                            const extras: string[] = [];
                                                            if (sector) extras.push(`Secteur : ${sector}`);
                                                            if (size) extras.push(`Taille : ${size}`);
                                                            if (founded) extras.push(`Fondée en ${founded}`);
                                                            if (hq) extras.push(`Localisation : ${hq}`);
                                                            if (specs) extras.push(`Spécialisations : ${specs}`);
                                                            if (extras.length > 0) parts.push(extras.join(' · '));
                                                        }
                                                        
                                                        // Les équipements sont désormais affichés dans une grille de badges dédiée

                                                        if (parts.length === 0) return null;

                                                        const finalDescription = parts.join('\n\n');

                                                        return (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</h5>
                                                                </div>
                                                                <p className="text-sm text-foreground/80 leading-relaxed bg-muted/10 rounded-xl p-4 border border-border/30 whitespace-pre-wrap">
                                                                    {finalDescription}
                                                                </p>
                                                                {/* Lien Google Maps si disponible */}
                                                                {(cd?.googleMapsUrl || cd?.mapsUrl) && (
                                                                    <a
                                                                        href={cd.googleMapsUrl || cd.mapsUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-2 w-fit mt-1 text-xs text-blue-500 hover:text-blue-400 transition-colors px-3 py-1.5 bg-blue-500/5 border border-blue-500/20 rounded-lg hover:bg-blue-500/10"
                                                                    >
                                                                        <MapPin size={12} /> Voir sur Google Maps
                                                                        <ExternalLink size={10} />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Company Specific Details (LinkedIn/Facebook Pages) */}
                                                    {(currentProspect.contractDetails.industry || currentProspect.contractDetails.foundedYear || currentProspect.contractDetails.employeeCount || currentProspect.contractDetails.companyType || currentProspect.contractDetails.plusCode || currentProspect.contractDetails.checkIn) && (
                                                        <div className="space-y-3 mt-4">
                                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Informations Générales</h5>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {currentProspect.contractDetails.industry && (
                                                                    <div className="p-3 bg-secondary/20 rounded-xl border border-border/30 flex flex-col gap-1">
                                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Secteur</span>
                                                                        <span className="text-sm font-semibold text-foreground/90">{currentProspect.contractDetails.industry}</span>
                                                                    </div>
                                                                )}
                                                                {currentProspect.contractDetails.plusCode && (
                                                                    <div className="p-3 bg-secondary/20 rounded-xl border border-border/30 flex flex-col gap-1">
                                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Plus Code</span>
                                                                        <span className="text-sm font-semibold text-foreground/90">{currentProspect.contractDetails.plusCode}</span>
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
                                                                {currentProspect.contractDetails.rating && (
                                                                    <div className="p-3 bg-secondary/20 rounded-xl border border-border/30 flex flex-col gap-1">
                                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Note Google</span>
                                                                        <span className="text-sm font-semibold text-amber-500 flex items-center gap-1">
                                                                            {currentProspect.contractDetails.rating} ⭐ 
                                                                            <span className="text-muted-foreground text-[10px] font-normal">
                                                                                ({currentProspect.contractDetails.totalScore || 0} avis)
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {currentProspect.contractDetails.category && (
                                                                    <div className="p-3 bg-secondary/20 rounded-xl border border-border/30 flex flex-col gap-1">
                                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Catégorie</span>
                                                                        <span className="text-sm font-semibold text-foreground/90">{currentProspect.contractDetails.category}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Équipements & Services (Amenities) */}
                                                    {(() => {
                                                        const amenities = (currentProspect.contractDetails as any)?.about?.amenities || 
                                                                         (currentProspect.contractDetails as any)?.amenities || [];
                                                        if (!amenities || amenities.length === 0) return null;
                                                        return (
                                                            <div className="space-y-3 mt-6">
                                                                <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                                    <Info size={14} className="text-blue-500" /> Équipements & Services
                                                                </h5>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {amenities.map((item: string, i: number) => (
                                                                        <span key={i} className="px-3 py-1.5 bg-blue-500/5 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-medium border border-blue-500/10 hover:bg-blue-500/10 transition-colors">
                                                                            {item}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Avis Google Maps */}
                                                    {currentProspect.contractDetails.reviews?.length > 0 && (
                                                        <div className="space-y-4 mt-8">
                                                            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                                <Star size={14} className="text-amber-500" /> Avis Clients Google
                                                            </h5>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {currentProspect.contractDetails.reviews.map((rev: any, i: number) => (
                                                                    <div key={i} className="p-4 bg-muted/10 rounded-2xl border border-border/10 space-y-2 hover:bg-muted/20 transition-all">
                                                                        <div className="flex justify-between items-start">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-sm font-bold text-foreground/90">{rev.author}</span>
                                                                                <div className="flex text-amber-500 mt-1">
                                                                                    {(() => {
                                                                                        const ratingStr = rev.rating || '5';
                                                                                        const stars = parseInt(ratingStr.match(/\d/)?.[0] || '5') || 5;
                                                                                        return Array.from({ length: 5 }).map((_, si) => (
                                                                                            <Star key={si} size={10} fill={si < stars ? "currentColor" : "none"} className={si < stars ? "text-amber-500" : "text-muted-foreground/30"} />
                                                                                        ));
                                                                                    })()}
                                                                                </div>
                                                                            </div>
                                                                            <span className="text-[10px] text-muted-foreground">{rev.date}</span>
                                                                        </div>
                                                                        <p className="text-sm text-foreground/70 italic leading-relaxed line-clamp-4">"{rev.text}"</p>
                                                                    </div>
                                                                ))}
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
                                            {/* Normalise les deux structures possibles : activities (LinkedIn) et activity.posts/comments (Facebook) */}
                                            {(() => {
                                                const ai = currentProspect.aiIntelligence as any;
                                                const cd = currentProspect.contractDetails as any;
                                                // LinkedIn scraper stores posts at: prospect.activity.posts (saved under contract_details)
                                                // Facebook / LinkedIn via aiIntelligence: ai.activities.posts or ai.activity.posts
                                                const posts: any[] = 
                                                    ai?.activities?.posts || 
                                                    ai?.activity?.posts || 
                                                    cd?.activity?.posts || 
                                                    (currentProspect as any)?.activity?.posts || 
                                                    [];
                                                const comments: any[] = 
                                                    ai?.activities?.comments || 
                                                    ai?.activity?.comments || 
                                                    cd?.activity?.comments || 
                                                    (currentProspect as any)?.activity?.comments || 
                                                    [];
                                                const isFacebook = currentProspect.source === 'facebook' || currentProspect.source === 'facebook_page';

                                                return (
                                                    <>
                                                        {posts.length > 0 && (
                                                            <div className="space-y-4">
                                                                <h4 className="text-sm font-bold flex items-center gap-2 text-primary">
                                                                    <MessageSquare size={18} className={isFacebook ? 'text-blue-500' : 'text-blue-400'} />
                                                                    {isFacebook ? 'Publications Facebook' : 'Posts récents'}
                                                                </h4>
                                                                <div className="grid grid-cols-1 gap-4">
                                                                    {posts.map((post: any, i: number) => (
                                                                        <div key={i} className="p-4 bg-muted/10 rounded-2xl border border-border/30">
                                                                            <div className="flex justify-between items-center mb-2">
                                                                                <span className="text-xs font-semibold text-muted-foreground">{post.date}</span>
                                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${
                                                                                    isFacebook ? 'bg-blue-500/10 text-blue-500' : 'bg-blue-400/10 text-blue-400'
                                                                                }`}>{post.actionType || 'Post'}</span>
                                                                            </div>
                                                                            {post.text && <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{post.text}</p>}
                                                                            {post.image && (
                                                                                <img src={post.image} alt="" className="mt-2 rounded-lg max-h-48 object-cover w-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                                            )}
                                                                            {post.originalPost?.text && (
                                                                                <div className="mt-2 p-3 bg-white/30 dark:bg-black/20 rounded-xl border border-border/20 text-xs">
                                                                                    <p className="font-semibold text-muted-foreground mb-1">🔁 {post.originalPost.author}</p>
                                                                                    <p className="text-muted-foreground/80 line-clamp-3">{post.originalPost.text}</p>
                                                                                </div>
                                                                            )}
                                                                            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                                                                                {post.likes !== undefined && <span className="flex items-center gap-1"><ThumbsUp size={12}/> {post.likes}</span>}
                                                                                {post.comments !== undefined && <span className="flex items-center gap-1"><MessageCircle size={12}/> {post.comments}</span>}
                                                                                {post.shares !== undefined && <span className="flex items-center gap-1"><Share2 size={12}/> {post.shares}</span>}
                                                                                {post.postUrl && <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline"><ExternalLink size={10}/> voir</a>}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {comments.length > 0 && (
                                                            <div className="space-y-4">
                                                                <h4 className="text-sm font-bold flex items-center gap-2 text-primary mt-4">
                                                                    <MessageCircle size={18} className="text-blue-500" />
                                                                    {isFacebook ? 'Commentaires Facebook' : 'Commentaires récents'}
                                                                </h4>
                                                                <div className="grid grid-cols-1 gap-4">
                                                                    {comments.map((comment: any, i: number) => (
                                                                        <div key={i} className="p-4 bg-muted/10 rounded-2xl border border-border/30">
                                                                            <div className="flex justify-between items-center mb-2">
                                                                                <span className="text-xs font-semibold text-muted-foreground">{comment.date}</span>
                                                                            </div>
                                                                            {(comment.originalPost?.text || comment.originalPostText) && (
                                                                                <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg mb-3 border border-border/20 text-xs">
                                                                                    <p className="font-semibold mb-1 text-muted-foreground">{comment.originalPost?.author || comment.originalPostAuthor}</p>
                                                                                    <p className="text-muted-foreground/80 line-clamp-2">{comment.originalPost?.text || comment.originalPostText}</p>
                                                                                    {(comment.originalPost?.url || comment.originalPostUrl) && (
                                                                                        <a href={comment.originalPost?.url || comment.originalPostUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-[10px] mt-1 flex items-center gap-1"><ExternalLink size={9}/> voir le post</a>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {comment.myComment && (
                                                                                <p className="text-sm font-medium text-foreground/90 whitespace-pre-wrap">↳ {comment.myComment}</p>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {posts.length === 0 && comments.length === 0 && (
                                                            <div className="py-20 text-center bg-muted/20 rounded-3xl border border-dashed border-border/50">
                                                                <MessageSquare size={40} className="mx-auto text-muted-foreground/30 mb-4" />
                                                                <p className="text-muted-foreground italic">Aucune activité récente (posts ou commentaires) trouvée.</p>
                                                                <p className="text-muted-foreground/50 text-xs mt-2">{isFacebook ? 'Assurez-vous que le profil / la page est public.' : 'Vérifiez que les posts LinkedIn sont récupérés.'}</p>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                            <h3 className="text-lg font-bold flex items-center gap-2">
                                                {currentProspect?.source === 'facebook' || currentProspect?.source === 'facebook_page' ? (
                                                    <><Facebook className="text-blue-500" size={20} /> Activité Facebook</>
                                                ) : (
                                                    <><Linkedin className="text-blue-500" size={20} /> {t("linkedinActivity")}</>
                                                )}
                                            </h3>



                                            {/* Le rendu des activités est maintenant géré par le bloc au-dessus */}
                                        </TabsContent>


                                        <TabsContent value="ai" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                            {isEnriching ? (
                                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/20 animate-in fade-in zoom-in duration-500">
                                                    <LoadingLogo 
                                                        size="lg" 
                                                        message={t("generatingScripts")}
                                                        className="mb-2"
                                                    />
                                                    <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                                                        Nous créons des emails d'approche et des elevator pitchs sur mesure.
                                                    </p>
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

export default React.memo(ProspectDetailView);
