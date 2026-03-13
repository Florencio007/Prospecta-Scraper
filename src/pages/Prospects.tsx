import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Search, Filter, Mail, Linkedin, Facebook, MessageCircle, Globe, Instagram, Music, Zap, Loader2, CheckCircle2, XCircle, MoreVertical, Trash2, Phone, ExternalLink } from "lucide-react";
import Header from "@/components/dashboard/Header";
import ProspectsSubNav from "@/components/dashboard/ProspectsSubNav";
import ProspectDetailView from "@/components/dashboard/ProspectDetailView";
import CampaignSelectionDialog from "@/components/dashboard/CampaignSelectionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
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
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";

const Prospects = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
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
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    company: "",
    source: "LinkedIn",
    score: 75,
    email: "",
    phone: "",
    website_url: "",
    linkedin_url: "",
    address: "",
    summary: "",
  });

  const getSourceIcon = (source: string) => {
    const iconProps = { size: 16, className: "inline-block mr-1" };
    switch (source?.toLowerCase()) {
      case "google": return <Globe {...iconProps} />;
      case "email": return <Mail {...iconProps} />;
      case "linkedin": return <Linkedin {...iconProps} />;
      case "facebook": return <Facebook {...iconProps} />;
      case "whatsapp": return <MessageCircle {...iconProps} />;
      case "instagram": return <Instagram {...iconProps} />;
      case "tiktok": return <Music {...iconProps} />;
      default: return <Globe {...iconProps} />;
    }
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
        // En fonction de si c'est un tableau (relation to-many temporaire) ou un objet (to-one)
        const pd = Array.isArray(p.prospect_data) ? (p.prospect_data[0] || {}) : (p.prospect_data || {});

        return {
          ...p,
          ...pd,
          id: p.id,
          // Support both snake_case from DB and camelCase from Search
          contractDetails: pd.contract_details || p.contractDetails || {},
          webIntelligence: pd.web_intelligence || p.webIntelligence || {},
          aiIntelligence: pd.ai_intelligence || p.aiIntelligence || {},
          socialLinks: pd.social_links || p.socialLinks || {},
          name: pd.name || p.name || 'Nom inconnu',
          company: pd.company || p.company || 'Entreprise inconnue',
          position: pd.position || p.position || '',
          email: pd.email || p.email || '',
          phone: pd.phone || p.phone || '',
          initials: pd.initials || p.initials || (pd.name || p.name || 'N').substring(0, 2).toUpperCase()
        };
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
    // Auto-open modal if URL says so
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

    // Anti-duplicate check
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

    // Database check (more robust)
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

      const { data: newProspect, error: pError } = await supabase.from("prospects").insert([{
        source: formData.source,
        score: formData.score,
        user_id: user.id,
        status: 'new'
      }]).select().single();

      if (pError) throw pError;

      const { error: pdError } = await supabase.from("prospect_data").insert([{
        prospect_id: newProspect.id,
        name: formData.name,
        company: formData.company,
        position: formData.position,
        email: formData.email || null,
        initials,
        website: formData.website_url || null,
        address: formData.address || null,
        summary: formData.summary || null,
        social_links: formData.linkedin_url ? { linkedin: formData.linkedin_url } : null
      }]);

      if (pdError) throw pdError;

      toast({ title: t("success"), description: t("profileUpdatedDesc") });
      setIsDialogOpen(false);
      setFormData({
        name: "",
        position: "",
        company: "",
        source: "LinkedIn",
        score: 75,
        email: "",
        phone: "",
        website_url: "",
        linkedin_url: "",
        address: "",
        summary: "",
      });
      loadProspects(true);
    } catch (error: any) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    }
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

  const handleCleanDuplicates = async () => {
    if (!user || prospects.length === 0) return;

    setIsLoading(true);
    try {
      const seen = new Set<string>();
      const toDelete: string[] = [];

      // Sort by created_at descending to keep the most recent ones (optional)
      const sorted = [...prospects].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      for (const p of sorted) {
        // Create unique keys for comparison
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

      // Perform deletion
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

  const filteredProspects = useMemo(() => prospects.filter(p => {
    const matchesSearch = (p.name || "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (p.company || "").toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesSource = filterSource ? p.source?.toLowerCase() === filterSource.toLowerCase() : true;
    const matchesEmail = filterEmail ? !!p.email : true;
    const matchesPhone = filterPhone ? !!p.phone : true;
    const matchesLinkedin = filterLinkedin ? !!(p.socialLinks?.linkedin || p.social_links?.linkedin) : true;
    const matchesWebsite = filterWebsite ? !!(p.website_url || p.websiteUrl) : true;
    return matchesSearch && matchesSource && matchesEmail && matchesPhone && matchesLinkedin && matchesWebsite;
  }), [prospects, debouncedSearch, filterSource, filterEmail, filterPhone, filterLinkedin, filterWebsite]);

  return (
    <div className="min-h-screen bg-secondary">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("myProspects")}</h1>
            <p className="text-muted-foreground font-light">{t("manageProspects")}</p>
          </div>
          <ProspectsSubNav onNewManual={() => setIsDialogOpen(true)} />
        </div>

        <div 
          className={`rounded-lg border bg-card/80 backdrop-blur-md p-4 shadow-sm mb-6 sticky z-30 transition-all duration-300 ${
            isVisible ? "top-16 opacity-100 translate-y-0" : "-top-20 opacity-0 -translate-y-4"
          }`}
        >
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("filterProspects")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 h-10">
                  <Filter size={16} />
                  <span className="hidden md:inline">{t("filters")}</span>
                  {(filterEmail || filterPhone || filterLinkedin || filterWebsite) && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                      {[filterEmail, filterPhone, filterLinkedin, filterWebsite].filter(Boolean).length}
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
                {(filterEmail || filterPhone || filterLinkedin || filterWebsite) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive justify-center" 
                      onClick={() => {
                        setFilterEmail(false);
                        setFilterPhone(false);
                        setFilterLinkedin(false);
                        setFilterWebsite(false);
                      }}
                    >
                      {t("clearFilters")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              onClick={handleCleanDuplicates}
              className="flex items-center gap-2 text-muted-foreground hover:text-accent h-10"
              title="Nettoyer les doublons"
            >
              <Zap size={16} />
              <span className="hidden md:inline">Nettoyer doublons</span>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto h-10 w-10 text-accent" /><p className="mt-2 text-muted-foreground">{t("cloudSync")}</p></div>
          ) : filteredProspects.length === 0 ? (
            <div className="p-20 text-center text-muted-foreground">{t("noProspectsFound")}</div>
          ) : (
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
                  <TableHead>{t("position")}</TableHead>
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
                    <TableCell><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center font-bold text-accent">{p.initials}</div><div><div className="font-bold">{p.name}</div><div className="text-xs text-muted-foreground">{p.company}</div></div></div></TableCell>
                    <TableCell className="text-sm">{p.position}</TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{getSourceIcon(p.source)} {p.source}</Badge></TableCell>
                    <TableCell><Badge variant={getScoreVariant(p.score)}>{p.score}%</Badge></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical size={16} /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedViewProspect(p); setIsDetailViewOpen(true); }}>{t("view")}</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="mr-2 h-4 w-4" /> {t("delete")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <div className="space-y-2"><Label>{t("position")}</Label><Input value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} /></div>
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
