import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Search, Filter, Mail, Linkedin, Facebook, MessageCircle, Globe, Instagram, Music, Zap, CheckCircle2, XCircle, MoreVertical, Trash2, Phone, ExternalLink, Loader2, Building2, User, Download, LayoutGrid, List } from "lucide-react";
import Header from "@/components/dashboard/Header";
import ProspectDetailView from "@/components/dashboard/ProspectDetailView";
import CampaignSelectionDialog from "@/components/dashboard/CampaignSelectionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useApiKeys } from "@/hooks/useApiKeys";
import { logProspectAdded } from "@/lib/activityLogger";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { calculateProspectScore } from "@/utils/scoring";
import { enrichProspectLocally } from "@/services/enrichmentService";
import { exportProspects } from "@/lib/exportUtils";

const Prospects = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { getKeyByProvider } = useApiKeys();
  const navigate = useNavigate();
  const [prospects, setProspects] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedViewProspect, setSelectedViewProspect] = useState<any | null>(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [filterEmail, setFilterEmail] = useState(false);
  const [filterPhone, setFilterPhone] = useState(false);
  const [filterLinkedin, setFilterLinkedin] = useState(false);
  const [filterWebsite, setFilterWebsite] = useState(false);
  const [activeTypeTab, setActiveTypeTab] = useState<string>("all");
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isCleanConfirmOpen, setIsCleanConfirmOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const lastScrollY = useRef(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    source: "LinkedIn",
    score: 75,
    email: "",
    photoUrl: "",
    phone: "",
    website_url: "",
    linkedin_url: "",
    address: "",
    summary: "",
    prospect_type: "person",
  });

  const getSourceIcon = (source: string) => {
    const iconProps = { size: 16, className: "inline-block mr-1" };
    switch (source?.toLowerCase()) {
      case "google": 
      case "google_maps": return <Globe {...iconProps} />;
      case "email": return <Mail {...iconProps} />;
      case "linkedin": return <Linkedin {...iconProps} />;
      case "facebook": return <Facebook {...iconProps} />;
      case "whatsapp": return <MessageCircle {...iconProps} />;
      case "instagram": return <Instagram {...iconProps} />;
      case "tiktok": return <Music {...iconProps} />;
      case "pappers": return <Building2 {...iconProps} />;
      default: return <Globe {...iconProps} />;
    }
  };

  const formatSource = (source: string) => {
    if (!source) return "Source inconnue";
    switch (source.toLowerCase()) {
      case "google":
      case "google_maps": return "Google Maps";
      case "linkedin": return "LinkedIn";
      case "facebook": return "Facebook";
      case "instagram": return "Instagram";
      case "pappers": return "Pappers";
      case "societe.com": return "Société.com";
      case "infogreffe": return "Infogreffe";
      default: return source;
    }
  };

  const getTypeIcon = (type: string) => {
    const iconProps = { size: 14, className: "inline-block mr-1.5" };
    if (type === "company") return <Building2 {...iconProps} />;
    return <User {...iconProps} />;
  };

  const getScoreVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 50) return "secondary";
    return "outline";
  };

  const location = useLocation();

  // Debounce search term (250ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadProspects = useCallback(async (isSilent = false) => {
    if (!isSilent && prospects.length === 0) {
      setIsLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from("prospects")
        .select("*, prospect_data(*)")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Erreur de chargement des prospects:", error);
      }

      const flattenedData = data?.map((p: any) => {
        const pd = Array.isArray(p.prospect_data) ? (p.prospect_data[0] || {}) : (p.prospect_data || {});
        
        const enhancedProspect = {
          ...p,
          ...pd,
          id: p.id,
          contractDetails: pd.contract_details || p.contractDetails || {},
          webIntelligence: pd.web_intelligence || p.webIntelligence || {},
          aiIntelligence: pd.ai_intelligence || p.aiIntelligence || {},
          socialLinks: pd.social_links || p.socialLinks || {},
          name: pd.name || p.name || 'Nom inconnu',
          company: pd.company || p.company || 'Entreprise inconnue',
          email: pd.email || p.email || '',
          photoUrl: pd.photo_url || p.photoUrl || '',
          phone: pd.phone || p.phone || pd.contract_details?.phone || pd.contractDetails?.phone || pd.contactInfo?.phones?.[0] || '',
          website_url: pd.website_url || p.website_url || pd.websiteUrl || p.websiteUrl || pd.contract_details?.website || pd.contractDetails?.website || '',
          initials: pd.initials || p.initials || (pd.name || p.name || 'N').substring(0, 2).toUpperCase(),
          prospect_type: pd.contract_details?.prospect_type || pd.prospect_type || p.prospect_type || ((p.source || "").toLowerCase().includes('maps') || (p.source || "").toLowerCase().includes('pappers') || (p.source || "").toLowerCase().includes('societe') || (p.source || "").toLowerCase().includes('infogreffe') ? 'company' : 'person')
        };
        
        // Ensure a score is present, calculate it dynamically if missing
        if (typeof (enhancedProspect as any).score !== 'number') {
            (enhancedProspect as any).score = calculateProspectScore(enhancedProspect);
        }

        return enhancedProspect;
      }) || [];

      setProspects(flattenedData);
    } catch (error: any) {
      console.error("Fetch error in loadProspects:", error);
      if (!isSilent) setProspects([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadProspects();
    const params = new URLSearchParams(location.search);
    if (params.get("action") === "new") {
      setIsDialogOpen(true);
      navigate("/prospects", { replace: true });
    }
  }, [user, location.search, loadProspects]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProspects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProspects.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleAddProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const isDuplicate = prospects.some(p =>
      (formData.company && p.company?.toLowerCase() === formData.company.toLowerCase()) ||
      (formData.email && p.email?.toLowerCase() === formData.email.toLowerCase())
    );

    if (isDuplicate) {
      toast({
        title: "Doublon détecté ! 🛡️",
        description: "Ce prospect ou cette entreprise existe déjà dans votre liste locale.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (formData.email) {
        const { data: dbExistingEmail } = await supabase
          .from("prospect_data")
          .select("prospect_id, prospects!inner(user_id)")
          .eq("email", formData.email)
          .eq("prospects.user_id", user.id)
          .maybeSingle();

        if (dbExistingEmail) {
          toast({
            title: "Doublon détecté ! 🛡️",
            description: "Un prospect avec cet email existe déjà dans votre base de données.",
            variant: "destructive",
          });
          return;
        }
      }

      if (formData.name && formData.company) {
        const { data: dbExistingName } = await supabase
          .from("prospect_data")
          .select("prospect_id, prospects!inner(user_id)")
          .eq("name", formData.name)
          .eq("company", formData.company)
          .eq("prospects.user_id", user.id)
          .maybeSingle();

        if (dbExistingName) {
          toast({
            title: "Doublon détecté ! 🛡️",
            description: "Un prospect avec ce nom et cette entreprise existe déjà.",
            variant: "destructive",
          });
          return;
        }
      }
    } catch (err) {
      console.warn("Database duplicate check failed:", err);
    }

    try {
      const initials = formData.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

      const { data: newProspect, error: pError } = await (supabase.from("prospects") as any).insert([{
        source: formData.source,
        score: formData.score,
        user_id: user.id,
        status: 'new'
      }]).select().single();

      if (pError) throw pError;
      if (!newProspect) throw new Error("Failed to create prospect record");

      const { error: pdError } = await (supabase.from("prospect_data") as any).insert([{
        prospect_id: newProspect.id,
        name: formData.name,
        company: formData.company,
        email: formData.email || null,
        initials,
        website: formData.website_url || null,
        address: formData.address || null,
        summary: formData.summary || null,
        social_links: formData.linkedin_url ? { linkedin: formData.linkedin_url } : null,
        contract_details: {
          prospect_type: (formData as any).prospect_type // Save the type
        }
      }]);

      if (pdError) throw pdError;

      toast({ title: t("success"), description: t("profileUpdatedDesc") });
      setIsDialogOpen(false);
      setFormData({
        name: "",
        company: "",
        source: "LinkedIn",
        score: 75,
        email: "",
        photoUrl: "",
        phone: "",
        website_url: "",
        linkedin_url: "",
        address: "",
        summary: "",
        prospect_type: "person", // Default to person for manual add
      });
      loadProspects(true);
    } catch (error: any) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    }
  };

  const handleBulkEnrich = async () => {
    if (selectedIds.size === 0) return;
    
    let openai_api_key = "";
    try {
      // Priorité 1 : Nouvelle table user_api_keys (supporte JSON/OpenRouter/OpenAI/etc.)
      const newKey = await getKeyByProvider('openai');
      if (newKey) {
        openai_api_key = newKey;
      } else {
        // Priorité 2 : Fallback legacy profiles table
        const { data: profile } = (await supabase.from("profiles").select("openai_api_key").eq("id", user?.id).single()) as any;
        if (profile?.openai_api_key) {
            openai_api_key = profile.openai_api_key;
        }
      }

      if (!openai_api_key) {
        toast({
          title: "Clé OpenAI manquante ⚠️",
          description: "Veuillez configurer votre clé API dans les Paramètres pour utiliser l'enrichissement.",
          variant: "destructive",
        });
        return;
      }
    } catch(e) { console.warn("Failed checking OpenAI API key:", e); }

    toast({
        title: "Enrichissement en cours 🚀",
        description: `Enrichissement de ${selectedIds.size} prospect(s)... L'agent prend le relais !`,
    });

    let successCount = 0;
    const idsToEnrich = Array.from(selectedIds);
    setSearchTerm("");

    for (const id of idsToEnrich) {
      const prospect = prospects.find(p => p.id === id);
      if (!prospect || !prospect.website_url) continue;
      
      try {
        if (!openai_api_key) continue;

        const enrichedData = await enrichProspectLocally(
            prospect.website_url, 
            openai_api_key, 
            { name: prospect.name, company: prospect.company }
        );
        
        if (enrichedData) {
            const updatedProspectContext = {
                ...prospect,
                ...enrichedData,
                email: enrichedData.email || prospect.email,
                phone: enrichedData.phone || prospect.phone,
                website_url: prospect.website_url, // enrichedData doesn't have it
                social_links: {
                    ...prospect.social_links,
                    linkedin: (enrichedData as any).linkedinProfile || prospect.social_links?.linkedin
                }
            };
            
            const newScore = calculateProspectScore(updatedProspectContext);
            
            const { error: dbError } = await (supabase
              .from('prospects') as any)
              .update({
                  score: newScore,
                  prospect_data: {
                      ...(prospect.prospect_data ? (Array.isArray(prospect.prospect_data) ? prospect.prospect_data[0] : prospect.prospect_data) : {}),
                      ...enrichedData,
                      score_global: newScore
                  }
              })
              .eq('id', id);
              
            if (!dbError) {
                successCount++;
            } else {
                console.error(`Failed to update prospect ${id} in DB:`, dbError);
            }
        }
      } catch (error) {
        console.error(`Failed to enrich prospect ${id}:`, error);
      }
    }

    toast({
        title: "Enrichissement terminé ✨",
        description: `${successCount} sur ${idsToEnrich.length} prospects ont été enrichis avec succès !`,
        variant: successCount > 0 ? "default" : "destructive",
    });

    setSelectedIds(new Set());
    loadProspects(false);
  };

  const handleDeleteProspect = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("prospects").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: t("success"), description: t("prospectDeleted") });
      setDeleteId(null);
      loadProspects(true);
    } catch (error: any) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { error } = await supabase
        .from("prospects")
        .delete()
        .in("id", Array.from(selectedIds));
      if (error) throw error;
      toast({
        title: t("success"),
        description: t("bulkDeleteSuccess", { count: selectedIds.size })
      });
      setSelectedIds(new Set());
      setIsBulkDeleteConfirmOpen(false);
      loadProspects(true);
    } catch (error: any) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    }
  };

  const handleCleanDuplicates = async () => {
    if (!user || prospects.length === 0) return;

    setIsLoading(true);
    try {
      const seen = new Set<string>();
      const toDelete: string[] = [];

      const sorted = [...prospects].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      for (const p of sorted) {
        const emailKey = p.email ? `email:${p.email.toLowerCase()}` : null;
        const nameKey = (p.name && p.company) ? `name:${p.name.toLowerCase()}|co:${p.company.toLowerCase()}` : null;

        const isEmailDup = emailKey && seen.has(emailKey);
        const isNameDup = nameKey && seen.has(nameKey);

        if (isEmailDup || isNameDup) {
          toDelete.push(p.id);
        } else {
          if (emailKey) seen.add(emailKey);
          if (nameKey) seen.add(nameKey);
        }
      }

      if (toDelete.length === 0) {
        toast({ title: "Aucun doublon trouvé", description: "Votre base est déjà propre ! ✨" });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.from("prospects").delete().in("id", toDelete);

      if (error) throw error;

      toast({
        title: "Nettoyage réussi ! 🧹",
        description: `${toDelete.length} prospect(s) en double ont été supprimés.`
      });
      loadProspects(true);
    } catch (error: any) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProspects = useMemo(() => {
    const filtered = prospects.filter(p => {
      const matchesSearch = (p.name || "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (p.company || "").toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesSource = filterSource ? formatSource(p.source || "").toLowerCase() === filterSource.toLowerCase() : true;
      const matchesEmail = filterEmail ? !!p.email : true;
      const matchesPhone = filterPhone ? !!p.phone : true;
      const matchesLinkedin = filterLinkedin ? !!(p.socialLinks?.linkedin || p.social_links?.linkedin) : true;
      const matchesWebsite = filterWebsite ? !!p.website_url : true;
      const matchesType = activeTypeTab === "all" ? true : p.prospect_type === activeTypeTab;
      return matchesSearch && matchesSource && matchesEmail && matchesPhone && matchesLinkedin && matchesWebsite && matchesType;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "source":
          comparison = (a.source || "").localeCompare(b.source || "");
          break;
        case "score":
          comparison = (a.score || 0) - (b.score || 0);
          break;
        case "date":
        default:
          comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [prospects, debouncedSearch, filterSource, filterEmail, filterPhone, filterLinkedin, filterWebsite, activeTypeTab, sortBy, sortOrder]);

  return (
    <div className="min-h-screen bg-secondary">
      <Header />
      <main className="pt-24 pb-12 px-4 sm:px-6 max-w-7xl mx-auto">

        <div
          className={`rounded-lg border bg-card/80 backdrop-blur-md p-4 shadow-sm mb-6 sticky z-30 transition-all duration-300 ${isVisible ? "top-16 opacity-100 translate-y-0" : "-top-20 opacity-0 -translate-y-4"
            }`}
        >
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("filterProspects")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 h-10 min-w-[120px]">
                  <Filter size={16} />
                  <span className="hidden md:inline">{t("sortBy")}: {t(`sortBy${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}`)}</span>
                  <span className="md:hidden">{t(`sortBy${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}`)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t("sortBy")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setSortBy("date"); setSortOrder("desc"); }}>
                  {t("sortByDate")} ({t("orderDesc")})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("name"); setSortOrder("asc"); }}>
                  {t("sortByName")} (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("source"); setSortOrder("asc"); }}>
                  {t("sortBySource")} (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("score"); setSortOrder("desc"); }}>
                  {t("sortByScore")} ({t("orderDesc")})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={sortOrder === "asc"} onCheckedChange={() => setSortOrder("asc")}>
                  {t("orderAsc")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={sortOrder === "desc"} onCheckedChange={() => setSortOrder("desc")}>
                  {t("orderDesc")}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 h-10">
                  <Filter size={16} />
                  <span className="hidden md:inline">{t("filters")}</span>
                  {(filterEmail || filterPhone || filterLinkedin || filterWebsite || filterSource) && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                      {[filterEmail, filterPhone, filterLinkedin, filterWebsite, filterSource].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("filters")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={filterEmail} onCheckedChange={setFilterEmail}>
                  {t("hasEmail")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filterPhone} onCheckedChange={setFilterPhone}>
                  {t("hasPhone")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filterLinkedin} onCheckedChange={setFilterLinkedin}>
                  {t("hasLinkedin")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={filterWebsite} onCheckedChange={setFilterWebsite}>
                  {t("hasWebsite")}
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Globe size={14} className="mr-2" />
                    {t("source")} {filterSource ? `(${filterSource})` : ""}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setFilterSource(null)}>
                        {t("allSources")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {["LinkedIn", "Google Maps", "Facebook", "Instagram", "Pappers", "Societe.com", "Infogreffe"].map(s => (
                        <DropdownMenuItem key={s} onClick={() => setFilterSource(s)}>
                          {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>

                {(filterEmail || filterPhone || filterLinkedin || filterWebsite || filterSource) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive justify-center"
                      onClick={() => {
                        setFilterEmail(false);
                        setFilterPhone(false);
                        setFilterLinkedin(false);
                        setFilterWebsite(false);
                        setFilterSource(null);
                      }}
                    >
                      {t("clearFilters")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 text-muted-foreground hover:text-accent h-10" title="Exporter les prospects">
                  <Download size={16} />
                  <span className="hidden md:inline">Exporter</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Format d'export</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportProspects(filteredProspects, "csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportProspects(filteredProspects, "xlsx")}>Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportProspects(filteredProspects, "json")}>JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportProspects(filteredProspects, "pdf")}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              onClick={() => setIsCleanConfirmOpen(true)}
              className="flex items-center gap-2 text-muted-foreground hover:text-accent h-10"
              title="Nettoyer les doublons"
            >
              <Zap size={16} />
              <span className="hidden md:inline">Nettoyer doublons</span>
            </Button>

            <div className="flex items-center bg-background/50 border rounded-lg p-1 ml-auto">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className={`h-8 w-8 ${viewMode === "list" ? "shadow-sm" : ""}`}
                title="Vue Liste"
              >
                <List size={16} />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className={`h-8 w-8 ${viewMode === "grid" ? "shadow-sm" : ""}`}
                title="Vue Grille"
              >
                <LayoutGrid size={16} />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-4 border-t pt-4">
            <button
              onClick={() => setActiveTypeTab("all")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTypeTab === "all"
                ? "bg-accent text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent/10"
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setActiveTypeTab("person")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                activeTypeTab === "person"
                ? "bg-accent text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent/10"
              }`}
            >
              <User size={14} />
              Personnes
            </button>
            <button
              onClick={() => setActiveTypeTab("company")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                activeTypeTab === "company"
                ? "bg-accent text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent/10"
              }`}
            >
              <Building2 size={14} />
              Entreprises
            </button>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-4 bg-card border rounded-xl shadow-sm">
              <Loader2 className="h-10 w-10 animate-spin text-accent" />
              <p className="text-sm text-slate-500 font-medium">{t("cloudSync")}</p>
            </div>
          ) : filteredProspects.length === 0 ? (
            <div className="p-20 text-center text-muted-foreground bg-card border rounded-xl shadow-sm">{t("noProspectsFound")}</div>
          ) : viewMode === "list" ? (
            <div className="border bg-card shadow-sm rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === filteredProspects.length && filteredProspects.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>{t("nameAndEntity")}</TableHead>
                    <TableHead>{t("source")}</TableHead>
                    <TableHead>{t("score")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProspects.map((p) => (
                    <TableRow key={p.id} className={`hover:bg-accent/5 cursor-pointer group ${selectedIds.has(p.id) ? 'bg-accent/5' : ''}`} onClick={() => { setSelectedViewProspect(p); setIsDetailViewOpen(true); }}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                        />
                      </TableCell>
                      <TableCell><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center font-bold text-accent">{p.initials}</div><div><div className="font-bold flex items-center gap-2">{getTypeIcon(p.prospect_type)} {p.name}</div><div className="text-xs text-muted-foreground">{p.company}</div></div></div></TableCell>
                      <TableCell><Badge variant="outline" className="font-normal">{getSourceIcon(p.source)} {formatSource(p.source)}</Badge></TableCell>
                      <TableCell><Badge variant={getScoreVariant(p.score)}>{p.score}%</Badge></TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
              {filteredProspects.map((p) => (
                <div 
                  key={p.id} 
                  className={`relative group bg-card p-6 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer overflow-hidden ${selectedIds.has(p.id) ? 'border-accent ring-1 ring-accent/20 bg-accent/5' : 'border-slate-200 dark:border-slate-800'}`}
                  onClick={() => { setSelectedViewProspect(p); setIsDetailViewOpen(true); }}
                >
                  {/* Selection Checkbox */}
                  <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                      className="h-5 w-5 rounded-full border-accent/30 data-[state=checked]:bg-accent"
                    />
                  </div>

                  {/* Score Badge */}
                  <div className="absolute top-4 right-4 text-center">
                    <div className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border shadow-sm ${
                      p.score >= 80 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 
                      p.score >= 50 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 
                      'bg-slate-500/10 text-slate-500 border-slate-500/20'
                    }`}>
                      {p.score}% Score
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col items-center text-center mt-4">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center font-black text-2xl text-accent mb-4 shadow-inner ring-4 ring-white dark:ring-slate-900 group-hover:scale-110 transition-transform duration-300">
                      {p.initials}
                    </div>
                    
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 line-clamp-1 mb-1">
                      {p.name}
                    </h3>
                    
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
                      {getTypeIcon(p.prospect_type)}
                      <span className="truncate max-w-[150px]">{p.company || "Entreprise inconnue"}</span>
                    </div>

                    <div className="w-full flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] font-medium py-0 px-2 h-5 border-slate-200 bg-slate-50 text-slate-500 rounded-full flex items-center gap-1">
                           {getSourceIcon(p.source)} {formatSource(p.source)}
                        </Badge>
                      </div>

                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-accent rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                {selectedIds.size}
              </div>
              <span className="text-sm text-slate-300 font-medium">Sélectionnés</span>
            </div>

            <div className="h-6 w-px bg-slate-800" />

            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsCampaignDialogOpen(true)}
                className="bg-accent hover:bg-accent/90 text-white rounded-full h-9 px-6 text-xs font-bold transition-all active:scale-95"
              >
                <Plus size={14} className="mr-2" />
                Ajouter à une campagne
              </Button>

              <Button
                onClick={() => handleBulkEnrich()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-9 px-6 text-xs font-bold transition-all active:scale-95"
              >
                <Zap size={14} className="mr-2" />
                Enrichir
              </Button>

              <Button
                variant="destructive"
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className="rounded-full h-9 px-6 text-xs font-bold transition-all active:scale-95"
              >
                <Trash2 size={14} className="mr-2" />
                {t("delete")}
              </Button>

              <Button
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full h-9 px-4 text-xs font-medium"
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("newProspect")}</DialogTitle></DialogHeader>
          <form onSubmit={handleAddProspect} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("fullName")}</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>{t("company")}</Label><Input value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} required /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("email")}</Label><Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>{t("phone")}</Label><Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("website")}</Label><Input value={formData.website_url} onChange={e => setFormData({ ...formData, website_url: e.target.value })} placeholder="https://..." /></div>
              <div className="space-y-2"><Label>{t("linkedin")}</Label><Input value={formData.linkedin_url} onChange={e => setFormData({ ...formData, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." /></div>
            </div>
            <div className="space-y-2"><Label>{t("address")}</Label><Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>{t("summary")}</Label><Input value={formData.summary} onChange={e => setFormData({ ...formData, summary: e.target.value })} placeholder={t("notes") || "Notes..."} /></div>
            <div className="space-y-2">
              <Label>{t("prospectType") || "Type de prospect"}</Label>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  variant={(formData as any).prospect_type === "person" ? "default" : "outline"}
                  className="flex-1 h-9 text-xs font-bold"
                  onClick={() => setFormData({ ...formData, prospect_type: "person" } as any)}
                >
                  Personne
                </Button>
                <Button 
                  type="button"
                  variant={(formData as any).prospect_type === "company" ? "default" : "outline"}
                  className="flex-1 h-9 text-xs font-bold"
                  onClick={() => setFormData({ ...formData, prospect_type: "company" } as any)}
                >
                  Entreprise
                </Button>
              </div>
            </div>
            <DialogFooter><Button type="submit" className="w-full bg-accent">{t("save")}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ProspectDetailView
        prospect={selectedViewProspect}
        isOpen={isDetailViewOpen}
        onOpenChange={setIsDetailViewOpen}
      />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("irreversibleDeletion")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProspect} className="bg-destructive">{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("irreversibleDeletion")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmBulkDelete", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCleanConfirmOpen} onOpenChange={setIsCleanConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nettoyer les doublons ? 🧹</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va rechercher et supprimer automatiquement les prospects en double (basé sur l'email ou le nom/entreprise). 
              Le doublon le plus récent sera conservé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setIsCleanConfirmOpen(false); handleCleanDuplicates(); }} className="bg-accent">
              Démarrer le nettoyage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CampaignSelectionDialog
        isOpen={isCampaignDialogOpen}
        onOpenChange={setIsCampaignDialogOpen}
        prospectIds={Array.from(selectedIds)}
        onSuccess={() => setSelectedIds(new Set())}
      />
    </div>
  );
};

export default Prospects;
