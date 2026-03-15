import { useState, useEffect, useRef } from "react";
import { Search, MapPin, Globe, Loader2, Sparkles, Filter, Database, Plus, ChevronRight, CheckCircle2, AlertCircle, X, SlidersHorizontal, Square, XCircle, Info, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Header from "@/components/dashboard/Header";
import ProspectsSubNav from "@/components/dashboard/ProspectsSubNav";
import ProspectDetailView from "@/components/dashboard/ProspectDetailView";
import CampaignSelectionDialog from "@/components/dashboard/CampaignSelectionDialog";
import { Logo } from "@/components/Logo";
import { LoadingLogo } from "@/components/LoadingLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Checkbox
} from "@/components/ui/checkbox";
import {
  ToggleGroup,
  ToggleGroupItem
} from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { triggerN8nWorkflow, type Channel } from "@/integrations/n8n";
import { logProspectAdded } from "@/lib/activityLogger";
import { useApiKeys } from "@/hooks/useApiKeys";
declare global {
  interface Window {
    __PROSPECTA_EXTENSION__?: any;
  }
}

const industryOptions = [
  { key: "software", label: "Logiciels & SaaS" },
  { key: "marketing", label: "Marketing & Publicité" },
  { key: "health", label: "Santé & Bien-être" },
  { key: "finance", label: "Finance & Fintech" },
  { key: "real_estate", label: "Immobilier" },
  { key: "education", label: "Éducation" },
  { key: "retail", label: "Commerce de détail" },
  { key: "manufacturing", label: "Industrie & Manufacturier" },
  { key: "others", label: "Autres" },
];

const ProspectFinder = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { saveKey, getKeys } = useApiKeys();
  const sb = supabase as any;

  // ── ÉTATS DE LA RECHERCHE ──────────────────────────────────────────────────
  const [isSearching, setIsSearching] = useState(false);
  const [pendingProspects, setPendingProspects] = useState<any[]>([]);
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set());
  
  // ── ÉTATS DES VUES ET DIALOGUES ─────────────────────────────────────────────
  const [selectedViewProspect, setSelectedViewProspect] = useState<any | null>(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [prospectIdsForCampaign, setProspectIdsForCampaign] = useState<string[]>([]);
  const [isSavingForCampaign, setIsSavingForCampaign] = useState(false);

  // ── ÉTATS DE PROGRESSION ET LOGS ────────────────────────────────────────────
  const [loadingStep, setLoadingStep] = useState(0);
  const [channelProgress, setChannelProgress] = useState<Record<string, number>>({});
  const [scrapeProgress, setScrapeProgress] = useState({ percentage: 0, message: "" });
  const [terminalLogs, setTerminalLogs] = useState<{ id: string, message: string, type: 'info' | 'success' | 'warn' | 'error' | 'process' | 'system', time: string }[]>([]);

  // ── IDENTIFIANTS DE COMPTES (RÉSEAUX SOCIAUX) ───────────────────────────────
  const [linkedinCredentials, setLinkedinCredentials] = useState({ email: "", password: "" });
  const [showLinkedInPassword, setShowLinkedInPassword] = useState(false);
  const [linkedinOptions, setLinkedinOptions] = useState({ maxPosts: 30, activityType: 'all' });
  const [facebookOptions, setFacebookOptions] = useState({ maxPosts: 10, activityType: 'all' });
  const [facebookCredentials, setFacebookCredentials] = useState({ email: "", password: "" });
  const [showFacebookPassword, setShowFacebookPassword] = useState(false);

  /**
   * Ajoute un log dans la console "rétro" de l'interface
   */
  const addLog = (message: string, type: 'info' | 'success' | 'warn' | 'error' | 'process' | 'system' = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTerminalLogs(prev => [...prev.slice(-15), { id: Math.random().toString(36).substring(2, 9), message, type, time }]);
  };

  const loadingMessages = [
    t("searchInProgress") || "Recherche en cours...",
    "Scan des réseaux sociaux...",
    "Identification des décideurs...",
    "Extraction des contacts...",
    "Analyse de l'intelligence web...",
    "Finalisation des résultats..."
  ];

  useEffect(() => {
    let interval: any;
    if (isSearching) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 3000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isSearching, loadingMessages.length]);

  // ── FILTRES ET CONFIGURATION DES CANAUX ────────────────────────────────────
  const [filters, setFilters] = useState({
    keyword: "",
    type: "tous",
    domain: "",
    country: "",
    city: "",
    industry: "",
    customIndustry: "",
    company_size: "",
    // Canaux actifs par défaut
    channels: ["google_maps", "linkedin", "pages_jaunes", "pappers", "societe", "infogreffe"] as string[],
    // Limites par canal pour éviter les blocages/lenteurs
    channelLimits: {
      google_maps: 50,
      linkedin: 10,
      pages_jaunes: 20,
      pappers: 50,
      govcon: 10,
      facebook: 5,
      societe: 10,
      infogreffe: 10
    } as Record<string, number>
  });





  const channelOptions = [
    { label: t("linkedin"), value: "linkedin" },
    { label: t("googleMaps"), value: "google_maps" },
    { label: t("pagesJaunes") || "Pages Jaunes France", value: "pages_jaunes" },
    { label: t("pappers") || "Pappers France", value: "pappers" },
    { label: t("societe") || "Societe.com", value: "societe" },
    { label: t("infogreffe") || "Infogreffe", value: "infogreffe" },
    { label: t("facebook"), value: "facebook" },
  ];

  const handleChannelToggle = (channel: string) => {
    setFilters((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProspects = pendingProspects.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(pendingProspects.length / itemsPerPage);

  // Stream management refs
  // ── GESTION DES FLUX SSE (Server-Sent Events) ──────────────────────────────
  const activeEventSources = useRef<EventSource[]>([]);
  const searchAbortController = useRef<AbortController | null>(null);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  /**
   * CHARGEMENT DES IDENTIFIANTS : Récupère les credentials LinkedIn/Facebook depuis localStorage ou Supabase
   */
  useEffect(() => {
    const loadCredentials = async () => {
      // 1. D'abord essayer le localStorage pour la rapidité
      const localLinkedin = localStorage.getItem('prospecta_linkedin_creds');
      const localFacebook = localStorage.getItem('prospecta_facebook_creds');

      if (localLinkedin) {
        try { setLinkedinCredentials(JSON.parse(localLinkedin)); } catch(e) {}
      }
      if (localFacebook) {
        try { setFacebookCredentials(JSON.parse(localFacebook)); } catch(e) {}
      }

      // 2. Ensuite synchroniser avec Supabase
      if (user) {
        const keys = await getKeys();
        const liKey = keys.find(k => k.provider === 'linkedin' && k.is_active);
        const fbKey = keys.find(k => k.provider === 'facebook' && k.is_active);

        if (liKey) {
          const creds = { email: liKey.api_key, password: liKey.api_secret || "" };
          setLinkedinCredentials(creds);
          localStorage.setItem('prospecta_linkedin_creds', JSON.stringify(creds));
        }
        if (fbKey) {
          const creds = { email: fbKey.api_key, password: fbKey.api_secret || "" };
          setFacebookCredentials(creds);
          localStorage.setItem('prospecta_facebook_creds', JSON.stringify(creds));
        }
      }
    };

    loadCredentials();
  }, [user, getKeys]);

  /**
   * SAUVEGARDE LOCALE : Persiste les entrées utilisateur au fur et à mesure
   */
  useEffect(() => {
    if (linkedinCredentials.email || linkedinCredentials.password) {
      localStorage.setItem('prospecta_linkedin_creds', JSON.stringify(linkedinCredentials));
    }
  }, [linkedinCredentials]);

  useEffect(() => {
    if (facebookCredentials.email || facebookCredentials.password) {
      localStorage.setItem('prospecta_facebook_creds', JSON.stringify(facebookCredentials));
    }
  }, [facebookCredentials]);

  /**
   * RESTAURATION DE SESSION : Recharge les résultats et logs depuis le localStorage au montage
   */
  useEffect(() => {
    const saved = localStorage.getItem('prospecta_search_session');
    if (saved) {
      try {
        const { prospects, logs, progress, filters: savedFilters } = JSON.parse(saved);
        if (prospects) setPendingProspects(prospects);
        if (logs) setTerminalLogs(logs);
        if (progress) setScrapeProgress(progress);
        if (savedFilters) {
          setFilters(prev => ({
            ...prev,
            ...savedFilters,
            channelLimits: savedFilters.channelLimits || prev.channelLimits
          }));
        }
      } catch (e) {
        console.error("Échec de la restauration de la session:", e);
      }
    }
  }, []);

  /**
   * PERSISTENCE : Sauvegarde l'état actuel de la recherche en local
   */
  useEffect(() => {
    if (pendingProspects.length > 0 || terminalLogs.length > 0 || isSearching) {
      localStorage.setItem('prospecta_search_session', JSON.stringify({
        prospects: pendingProspects,
        logs: terminalLogs,
        progress: scrapeProgress,
        filters: filters,
        timestamp: Date.now()
      }));
    }
  }, [pendingProspects, terminalLogs, scrapeProgress, filters, isSearching]);

  const handleReset = () => {
    setFilters({
      keyword: "",
      type: "tous",
      domain: "",
      country: "",
      city: "",
      industry: "",
      customIndustry: "",
      company_size: "",
      channels: ["google_maps", "linkedin", "pages_jaunes", "pappers", "societe", "infogreffe"],
      channelLimits: {
        google_maps: 50,
        linkedin: 10,
        pages_jaunes: 20,
        pappers: 50,
        govcon: 10,
        facebook: 5,
        societe: 10,
        infogreffe: 10
      }
    });
    setPendingProspects([]);
    setTerminalLogs([]);
    setScrapeProgress({ percentage: 0, message: "" });
    localStorage.removeItem('prospecta_search_session');
  };

  /**
   * Calcule un score de qualité initial basé sur la complétude des données
   */
  const calculateInitialScore = (item: any) => {
    let score = 20; // Score de base
    if (item.website || item.url) score += 15;
    if (item.email || (item.emails && item.emails.length > 0)) score += 20;
    if (item.phone || item.phoneUnformatted) score += 15;
    if (item.industry || item.categoryName || item.category) score += 10;
    if (item.totalScore && item.totalScore >= 4.5) score += 20;
    else if (item.totalScore) score += 10;

    return Math.min(95, score); // Maximum de 95 avant enrichissement IA
  };

  /**
   * LANCEUR DE RECHERCHE PRINCIPAL
   * Gère les requêtes vers les différents scrapers via SSE pour un affichage en temps réel
   */
  const handleSearch = async () => {
    // Validation des critères minimum
    if (!filters.keyword && !filters.domain && !filters.country && !filters.city) {
      toast({
        title: t("error"),
        description: t("enterAtLeastOneCriteria"),
        variant: "destructive",
      });
      return;
    }

    if (filters.channels.length === 0) {
      toast({
        title: t("error"),
        description: t("searchChannels") + " (Veuillez sélectionner au moins un canal)",
        variant: "destructive",
      });
      return;
    }

    // Sauvegarde des identifiants dans Supabase si utilisés
    if (filters.channels.includes("linkedin") && linkedinCredentials.email) {
      saveKey('linkedin', linkedinCredentials.email, 'LinkedIn Account', linkedinCredentials.password);
    }
    if (filters.channels.includes("facebook") && facebookCredentials.email) {
      saveKey('facebook', facebookCredentials.email, 'Facebook Account', facebookCredentials.password);
    }

    setIsSearching(true);
    setPendingProspects([]); 
    setScrapeProgress({ percentage: 0, message: "" });
    
    setTerminalLogs([{ id: 'init', message: "🚀 Initialisation du moteur Prospecta AI...", type: 'system', time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
    setCurrentPage(1);
    
    // Fermeture des anciens flux et initialisation du contrôleur d'abandon
    activeEventSources.current.forEach(es => es.close());
    activeEventSources.current = [];
    searchAbortController.current = new AbortController();

    // Demande de permission pour les notifications bureau
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    try {
      // Préparation de la requête globale
      let industryTerm = filters.industry;
      if (filters.industry === "others" && filters.customIndustry) {
        industryTerm = filters.customIndustry;
      } else if (filters.industry && filters.industry !== "others") {
        const selectedOption = industryOptions.find(opt => opt.key === filters.industry);
        if (selectedOption) industryTerm = selectedOption.label;
      }

      const locationParts = [filters.city, filters.country].filter(Boolean);
      const locationQuery = locationParts.join(", ") || "";
      const searchParts = [filters.keyword, industryTerm, filters.domain, filters.company_size].filter(Boolean);
      const searchQueryString = searchParts.join(" ");

      const commonPayload = {
        ...filters,
        industry: industryTerm,
        locationQuery,
        searchQuery: searchQueryString,
        userId: user?.id
      };

      // --- EXÉCUTION PARALLÈLE PAR CANAL (Temps Réel) ---
      // Initialiser la progression de chaque canal à 0
      const initialProgress: Record<string, number> = {};
      filters.channels.forEach(c => initialProgress[c] = 0);
      setChannelProgress(initialProgress);

      const channelPromises = filters.channels.map(async (channel) => {
        if (searchAbortController.current?.signal.aborted) return;

        return new Promise<void>(async (resolveChannel) => {
          // Helper local pour mettre à jour la progression d'un canal spécifique
          const updateChannelPct = (pct: number, msg: string) => {
            setChannelProgress(prev => {
              const next = { ...prev, [channel]: pct };
              const values = Object.values(next);
              const avg = Math.round(values.reduce((a, b) => a + b, 0) / filters.channels.length);
              setScrapeProgress({ percentage: avg, message: `[${(channel || 'N/A').toUpperCase()}] ${msg}` });
              return next;
            });
          };

          // --- MODE AGENT LOCAL (Playwright Serveur) ---
          // On n'utilise plus l'extension Chrome, mais les scripts locaux du serveur.
          const localPlaywrightChannels = ["linkedin", "facebook"];
          const extensionChannels = ["google_maps", "pages_jaunes", "pappers", "societe", "infogreffe"];
          
          if (window.__PROSPECTA_EXTENSION__ && extensionChannels.includes(channel) && !localPlaywrightChannels.includes(channel)) {
            addLog(`🚀 Agent Extension: Lancement du canal ${channel}...`, "system");
            
            const unsubscribe = window.__PROSPECTA_EXTENSION__.onProgress((msg: any) => {
              if (msg.type === "SCRAPE_PROGRESS") {
                updateChannelPct(msg.progress, msg.message);
                addLog(msg.message, msg.status || 'process');
              } else if (msg.type === "PROSPECT_FOUND") {
                setPendingProspects(prev => {
                  const exists = prev.some(p => 
                    (p.id === msg.prospect.id) || 
                    (p.name === msg.prospect.name && p.company === msg.prospect.company)
                  );
                  if (exists) return prev;
                  return [...prev, msg.prospect];
                });
                setSelectedProspectIds(prev => new Set(prev).add(msg.prospect.id));
                addLog(`👤 Trouvé (${channel}): ${msg.prospect.name}`, 'success');
              }
            });

            try {
              const res = await window.__PROSPECTA_EXTENSION__.startSearch({
                keyword: filters.keyword,
                location: locationQuery,
                type: filters.type,
                channel: channel,
                maxLimit: filters.channelLimits[channel as keyof typeof filters.channelLimits] || 10
              });
              updateChannelPct(100, "Terminé");
              unsubscribe();
              resolveChannel();
              return; // On stoppe ici si l'extension a géré le canal
            } catch (err: any) {
              addLog(`⚠️ Repli Serveur [${channel}]: ${err.message}`, 'process');
              unsubscribe();
              // On continue vers la logique EventSource ci-dessous
            }
          }

          if (channel === "govcon") {
            try {
              addLog("🔎 Recherche d'opportunités fédérales (GovCon)...", "system");
              const queryToHash = `govcon|${searchQueryString}|${locationQuery}`;
              const queryHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(queryToHash.toLowerCase()))
                .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

              let govData = null;
              const { data: cachedSearch } = await sb.from('cached_searches').select('id').eq('query_hash', queryHash).single();
              if (cachedSearch) {
                const { data: cachedResults } = await sb.from('cached_results').select('data').eq('search_id', cachedSearch.id).single();
                if (cachedResults) { govData = cachedResults.data; addLog("⚡ GovCon (Cache).", "success"); }
              }

              if (!govData) {
                const n8nRes = await triggerN8nWorkflow("GOVCON", commonPayload);
                if (n8nRes.success && n8nRes.data?.data) govData = n8nRes.data.data;
              }

              if (govData && govData.length > 0) {
                const mappedResults = govData.map((item: any) => ({
                  id: item.notice_id, name: item.contact_name || item.agency,
                  initials: (item.agency?.[0] || "G").toUpperCase(),
                  position: item.title, company: item.agency, source: "govcon",
                  score: calculateInitialScore(item), email: item.contact_email,
                  website: item.sam_url, city: item.performance_city_name,
                  tags: [item.naics].flat(), contractDetails: item
                }));
                
                setPendingProspects(prev => [...prev, ...mappedResults]);
                setSelectedProspectIds(prev => {
                  const newSet = new Set(prev);
                  mappedResults.forEach((p: any) => newSet.add(p.id));
                  return newSet;
                });
                addLog(`🏛️ ${govData.length} opportunités GovCon identifiées.`, "success");
              }
              updateChannelPct(100, "Scan GovCon terminé");
            } catch (err) { addLog("❌ GovCon Error.", "error"); }
            resolveChannel();
          } 
          else if (channel === "google_maps") {
            addLog("🛰️ Scan Google Maps en cours...", "system");
            const url = `/api/scrape/gmaps?q=${encodeURIComponent(filters.keyword)}&l=${encodeURIComponent(filters.city || filters.country || 'Antananarivo')}&limit=${filters.channelLimits.google_maps}&userId=${user?.id || ""}&type=${filters.type}`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(e.data, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(d.message, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(`❌ Erreur: ${d.error}`, 'error');
              if (d.result) {
                const mapped = {
                  id: `gmap_${Math.random().toString(36).substr(2, 9)}`,
                  name: d.result.name, initials: (d.result.name?.[0] || "G").toUpperCase(),
                  position: d.result.category, company: d.result.name, source: "google_maps",
                  score: calculateInitialScore(d.result), email: d.result.phone ? "Extraction..." : "",
                  phone: d.result.phone || "", website: d.result.website || "",
                  city: filters.city || "", tags: [d.result.category].filter(Boolean),
                  contractDetails: d.result
                };
                setPendingProspects(prev => {
                   if (prev.some(p => p.name === mapped.name && p.company === mapped.company)) return prev;
                   return [...prev, mapped];
                });
                setSelectedProspectIds(prev => new Set(prev).add(mapped.id));
                addLog(`📍 Maps: ${mapped.name}`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "linkedin") {
            addLog("🛡️ Protocoles LinkedIn (Local)...", "system");
            const url = `/api/scrape/linkedin?q=${encodeURIComponent(filters.keyword)}&email=${encodeURIComponent(linkedinCredentials.email)}&password=${encodeURIComponent(linkedinCredentials.password)}&maxProfiles=${filters.channelLimits.linkedin}&maxPosts=${linkedinOptions.maxPosts}&type=${filters.type}&activityType=${linkedinOptions.activityType}`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(e.data, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(d.message, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(`❌ Erreur: ${d.error}`, 'error');
              if (d.result) {
                const mapped = {
                  ...d.result,
                  id: d.result.id || `li_${Math.random().toString(36).substr(2, 9)}`,
                  source: "linkedin"
                };
                setPendingProspects(prev => {
                   if (prev.some(p => p.profileUrl === mapped.profileUrl)) return prev;
                   return [...prev, mapped];
                });
                setSelectedProspectIds(prev => new Set(prev).add(mapped.id));
                addLog(`👤 LinkedIn: ${mapped.name}`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "facebook") {
            addLog("👥 Protocoles Facebook (Local)...", "system");
            const url = `/api/scrape/facebook?q=${encodeURIComponent(filters.keyword)}&email=${encodeURIComponent(facebookCredentials.email)}&password=${encodeURIComponent(facebookCredentials.password)}&limit=${filters.channelLimits.facebook}&maxPosts=${facebookOptions.maxPosts}&type=${filters.type}&activityType=${facebookOptions.activityType}`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(e.data, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(d.message, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(`❌ Erreur: ${d.error}`, 'error');
              if (d.result) {
                const mapped = {
                  ...d.result,
                  id: d.result.id || `fb_${Math.random().toString(36).substr(2, 9)}`,
                  source: "facebook"
                };
                setPendingProspects(prev => {
                   if (prev.some(p => p.profileUrl === mapped.profileUrl)) return prev;
                   return [...prev, mapped];
                });
                setSelectedProspectIds(prev => new Set(prev).add(mapped.id));
                addLog(`👥 Facebook: ${mapped.name}`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "pages_jaunes") {
             addLog("📖 Pages Jaunes France...", "system");
             const url = `/api/scrape/pj?q=${encodeURIComponent(filters.keyword)}&l=${encodeURIComponent(filters.city || filters.country || '')}&limit=${filters.channelLimits.pages_jaunes}&userId=${user?.id || ""}&type=${filters.type}`;
             const es = new EventSource(url);
             activeEventSources.current.push(es);
             es.onmessage = (e) => {
               let d;
               try { d = JSON.parse(e.data); } catch(err) { addLog(e.data, 'process'); return; }
               if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(d.message, 'process'); }
               if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
               if (d.error && typeof d.error === 'string') addLog(`❌ Erreur: ${d.error}`, 'error');
               if (d.result) {
                 setPendingProspects(prev => {
                   if (prev.some(p => p.name === d.result.name && p.company === d.result.company)) return prev;
                   return [...prev, d.result];
                 });
                 setSelectedProspectIds(prev => new Set(prev).add(d.result.id));
                 addLog(`📖 PJ: ${d.result.name}`, 'success');
               }
               if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
             };
             es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "pappers") {
            addLog("📥 Pappers.fr...", "system");
            const url = `/api/scrape/pappers?q=${encodeURIComponent(filters.keyword)}&l=${encodeURIComponent(filters.city || filters.country || '')}&limit=${filters.channelLimits.pappers}&userId=${user?.id || ""}&type=${filters.type}`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(e.data, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(d.message, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(`❌ Erreur: ${d.error}`, 'error');
              if (d.result) {
                setPendingProspects(prev => {
                  if (prev.some(p => p.contractDetails?.siren === d.result.contractDetails?.siren)) return prev;
                  return [...prev, d.result];
                });
                setSelectedProspectIds(prev => new Set(prev).add(d.result.id));
                addLog(`🏢 Pappers: ${d.result.name}`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "societe") {
            addLog("💼 Societe.com...", "system");
            const url = `/api/scrape/societe?q=${encodeURIComponent(filters.keyword)}&limit=${filters.channelLimits.societe}&type=${filters.type}`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(e.data, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(d.message, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(`❌ Erreur: ${d.error}`, 'error');
              if (d.result) {
                setPendingProspects(prev => {
                  if (prev.some(p => p.contractDetails?.siren === d.result.contractDetails?.siren)) return prev;
                  return [...prev, d.result];
                });
                setSelectedProspectIds(prev => new Set(prev).add(d.result.id));
                addLog(`💼 Societe: ${d.result.name}`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "infogreffe") {
            addLog("📜 Infogreffe...", "system");
            const url = `/api/scrape/infogreffe?q=${encodeURIComponent(filters.keyword)}&limit=${filters.channelLimits.infogreffe}&type=${filters.type}`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(e.data, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(d.message, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(`❌ Erreur: ${d.error}`, 'error');
              if (d.result) {
                setPendingProspects(prev => {
                  if (prev.some(p => p.contractDetails?.siren === d.result.contractDetails?.siren)) return prev;
                  return [...prev, d.result];
                });
                setSelectedProspectIds(prev => new Set(prev).add(d.result.id));
                addLog(`📜 Infogreffe: ${d.result.name}`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "facebook") {
            if (!facebookCredentials.email || !facebookCredentials.password) {
              addLog("⚠️ Credentials Facebook manquants — canal ignoré.", "warn");
              resolveChannel();
            } else {
              addLog("📘 Scan Facebook en cours...", "system");
              const url = `/api/scrape/facebook?email=${encodeURIComponent(facebookCredentials.email)}&password=${encodeURIComponent(facebookCredentials.password)}&q=${encodeURIComponent(searchQueryString)}&limit=${filters.channelLimits.facebook}&maxPosts=${facebookOptions.maxPosts}&activityType=${facebookOptions.activityType}&type=${filters.type}`;
              const es = new EventSource(url);
              activeEventSources.current.push(es);
              es.onmessage = (e) => {
                let d;
                try { d = JSON.parse(e.data); } catch(err) { addLog(e.data, 'process'); return; }
                if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(d.message, 'process'); }
                if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
                if (d.error && typeof d.error === 'string') addLog(`❌ Erreur: ${d.error}`, 'error');
                if (d.result) {
                  const r = d.result;
                  setPendingProspects(prev => {
                    if (prev.some(p => p.socialLinks?.facebook && p.socialLinks.facebook === r.socialLinks?.facebook)) return prev;
                    return [...prev, r];
                  });
                  setSelectedProspectIds(prev => new Set(prev).add(r.id));
                  addLog(`📘 Facebook: ${r.name}`, 'success');
                }
                if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
              };
              es.onerror = () => { es.close(); resolveChannel(); };
            }
          }
        });
      });

      await Promise.all(channelPromises);

      // --- FINALISATION ---
      addLog("🏁 Scan terminé. Tous les prospects sont affichés.", "system");
      setScrapeProgress({ percentage: 100, message: "Opération terminée" });

      // Notification
      if (typeof window !== "undefined" && "Notification" in window && document.hidden && Notification.permission === "granted") {
        new Notification("Prospecta : Scan terminé !", {
          body: `Le scan est terminé. Consultez les nouveaux prospects identifiés.`,
          icon: "/favicon.ico"
        });
      }

    } catch (error) {
      toast({ title: t("error"), description: t("searchError"), variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleStopSearch = async () => {
    try {
      // 1. Send stop signal to backend (lock file)
      const res = await fetch('/api/scrape/stop');
      const data = await res.json();
      
      // 2. Client-side termination: Abort all fetch and close EventSources
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      activeEventSources.current.forEach(es => es.close());
      activeEventSources.current = [];

      if (data.success) {
        addLog("🛑 Signal d'arrêt global envoyé. Fermeture des flux...", "system");
        toast({
          title: t("success"),
          description: "Recherche interrompue. Les flux sont en cours de fermeture.",
        });
      }
    } catch (error: any) {
      // Ignorer les erreurs "AbortError"
      if (error.name !== 'AbortError') {
        toast({
          title: t("error"),
          description: `Erreur lors de l'arrêt: ${error.message}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsSearching(false);
      setScrapeProgress({ percentage: 0, message: "" });
    }
  };

  const handleViewProspect = (p: any) => {
    setSelectedViewProspect(p);
    setIsDetailViewOpen(true);
  };

  const toggleProspectSelection = (id: string) => {
    const newSelected = new Set(selectedProspectIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedProspectIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProspectIds.size === pendingProspects.length) {
      setSelectedProspectIds(new Set());
    } else {
      setSelectedProspectIds(new Set(pendingProspects.map(p => p.id)));
    }
  };

  /**
   * Sauvegarde les prospects sélectionnés dans Supabase
   * Gère les doublons automatiquement.
   */
  const handleSaveSelected = async () => {
    if (!user) return;
    const toSave = pendingProspects.filter(p => selectedProspectIds.has(p.id));

    if (toSave.length === 0) return;

    try {
      const savedIds = await saveProspectsSequentially(toSave);
      toast({ title: t("success"), description: `${savedIds.length} ${t("prospectsImported")}` });
      setPendingProspects([]); // Nettoie la zone tampon après import
      setSelectedProspectIds(new Set());
    } catch (error: any) {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    }
  };

  const saveProspectsSequentially = async (prospectsToSave: any[]): Promise<string[]> => {
    if (!user) return [];
    const savedIds: string[] = [];

    for (const p of prospectsToSave) {
      // 0. Database duplicate check
      let existingId = null;

      // If we have an email, check by email first
      if (p.email) {
        const { data: existingByEmail } = await sb
          .from("prospect_data")
          .select("prospect_id, prospects!inner(user_id)")
          .eq("email", p.email)
          .eq("prospects.user_id", user.id)
          .maybeSingle();

        if (existingByEmail) existingId = existingByEmail.prospect_id;
      }

      // If no email or not found by email, check by name and company
      if (!existingId && p.name && p.company) {
        const { data: existingByName } = await sb
          .from("prospect_data")
          .select("prospect_id, prospects!inner(user_id)")
          .eq("name", p.name)
          .eq("company", p.company)
          .eq("prospects.user_id", user.id)
          .maybeSingle();

        if (existingByName) existingId = existingByName.prospect_id;
      }

      if (existingId) {
        console.log(`Prospect ${p.name} already exists with ID ${existingId}. Skipping insertion.`);
        savedIds.push(existingId);
        continue;
      }

      // Check if already saved (is UUID) - legacy check for front-end IDs
      if (isUUID(p.id)) {
        savedIds.push(p.id);
        continue;
      }

      // 1. Insert into prospects
      const { data: newP, error: pErr } = await sb.from("prospects").insert([{
        source: p.source,
        score: p.score,
        user_id: user.id,
        status: 'new'
      }]).select().single();

      if (pErr) throw pErr;

      if (newP) {
        // 2. Insert into prospect_data
        const { error: pdErr } = await sb.from("prospect_data").insert([{
          prospect_id: newP.id,
          name: p.name,
          company: p.company,
          position: p.position,
          email: p.email || null,
          phone: p.phone || null,
          initials: p.initials,
          website: p.website,
          address: p.address || null,
          social_links: p.socialLinks || null,
          contract_details: {
            ...(p.contractDetails || {}),
            photo: p.photo || null,
          },
          web_intelligence: p.aiIntelligence || p.webIntelligence || null
        }]);

        if (pdErr) throw pdErr;

        await logProspectAdded(user.id, newP.id, p.name);
        savedIds.push(newP.id);
      }
    }
    return savedIds;
  };

  const isUUID = (id: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const handleAddToCampaign = async () => {
    if (!user) return;
    const selected = pendingProspects.filter(p => selectedProspectIds.has(p.id));
    if (selected.length === 0) return;

    setIsSavingForCampaign(true);
    try {
      const savedIds = await saveProspectsSequentially(selected);
      if (savedIds.length > 0) {
        setProspectIdsForCampaign(savedIds);
        setIsCampaignDialogOpen(true);
      }
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message || "Error saving prospects before campaign assignment",
        variant: "destructive"
      });
    } finally {
      setIsSavingForCampaign(false);
    }
  };



  return (
    <div className="min-h-screen bg-secondary">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("myProspects")}</h1>
            <p className="text-muted-foreground font-light mt-2">
              {t("manageProspects")}
            </p>
          </div>
          <ProspectsSubNav />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">{t("filters")}</CardTitle>
              <CardDescription>{t("refineSearch")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="keyword">{t("keywords")}</Label>
                <div className="relative">
                  <Input
                    id="keyword"
                    placeholder={t("namePositionPlaceholder")}
                    value={filters.keyword}
                    onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                    className={isSearching ? "pr-10" : ""}
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <LoadingLogo size="xs" compact />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("prospectType") || "Type de prospect"}</Label>
                <ToggleGroup 
                  type="single" 
                  value={filters.type} 
                  onValueChange={(v) => v && setFilters({ ...filters, type: v })}
                  className="justify-start gap-2"
                >
                  <ToggleGroupItem value="person" className="px-3 border text-xs font-semibold data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                    Personne
                  </ToggleGroupItem>
                  <ToggleGroupItem value="company" className="px-3 border text-xs font-semibold data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                    Entreprise
                  </ToggleGroupItem>
                  <ToggleGroupItem value="tous" className="px-3 border text-xs font-semibold data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                    Tous
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">{t("city")}</Label>
                <Input
                  id="city"
                  placeholder="ex: Antananarivo"
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">{t("country")}</Label>
                <Input
                  id="country"
                  placeholder="ex: Madagascar"
                  value={filters.country}
                  onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                />
              </div>




              <div className="space-y-3">
                <Label>{t("searchChannels")}</Label>
                <div className="space-y-2">
                  {channelOptions.map((channel) => (
                    <div key={channel.value} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={channel.value}
                          checked={filters.channels.includes(channel.value)}
                          onCheckedChange={() => handleChannelToggle(channel.value)}
                        />
                        <label htmlFor={channel.value} className="text-sm font-medium cursor-pointer">
                          {channel.label}
                        </label>
                      </div>
                      
                      {filters.channels.includes(channel.value) && (
                        <div className="pl-6 flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                          <Label htmlFor={`limit-${channel.value}`} className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">
                            Limite :
                          </Label>
                          <Input
                            id={`limit-${channel.value}`}
                            type="number"
                            min="0"
                            max="500"
                            className="h-7 w-20 text-xs bg-muted/30 border-muted-foreground/20 focus:border-primary/50"
                            value={filters.channelLimits[channel.value] !== undefined ? filters.channelLimits[channel.value] : 10}
                            onChange={(e) => {
                              const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                              if (isNaN(val)) return;
                              setFilters(prev => ({
                                ...prev,
                                channelLimits: {
                                  ...prev.channelLimits,
                                  [channel.value]: val
                                }
                              }));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* LinkedIn Credentials — shown only when LinkedIn is selected */}
              {filters.channels.includes("linkedin") && (
                <div className="space-y-3 rounded-xl border border-orange-500/40 bg-orange-500/5 p-4">
                  {/* Security Warning */}
                  <div className="flex items-start gap-2 rounded-lg bg-orange-500/10 border border-orange-500/30 p-3">
                    <ShieldAlert className="text-orange-400 mt-0.5 shrink-0" size={16} />
                    <p className="text-xs text-orange-300 leading-snug">
                      <span className="font-semibold block mb-1">⚠️ Recommandation de sécurité</span>
                      N'utilisez <strong>pas</strong> votre compte LinkedIn habituel. Créez un compte dédié pour éviter tout risque de bannissement par LinkedIn.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="li-email" className="text-xs font-semibold text-orange-300">
                      Email LinkedIn <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="li-email"
                      type="email"
                      placeholder="compte.dedie@email.com"
                      value={linkedinCredentials.email}
                      onChange={(e) => setLinkedinCredentials(prev => ({ ...prev, email: e.target.value }))}
                      className="border-orange-500/30 focus:border-orange-500/60 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="li-password" className="text-xs font-semibold text-orange-300">
                      Mot de passe LinkedIn <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="li-password"
                        type={showLinkedInPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={linkedinCredentials.password}
                        onChange={(e) => setLinkedinCredentials(prev => ({ ...prev, password: e.target.value }))}
                        className="border-orange-500/30 focus:border-orange-500/60 text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLinkedInPassword(p => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showLinkedInPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* ── Options avancées d'activité ── */}
                  <div className="space-y-3 pt-1 border-t border-orange-500/20">
                    <p className="text-xs font-semibold text-orange-300">⚙️ Options d'activité</p>

                    {/* Nombre d'activités */}
                    <div className="space-y-1">
                      <Label htmlFor="li-max-posts" className="text-xs text-orange-200/80">
                        Nombre d'activités à extraire
                        <span className="ml-1 text-orange-400/60 font-normal">(1–100)</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="li-max-posts"
                          type="number"
                          min="0"
                          max="100"
                          className="h-8 bg-muted/20 border-orange-500/20"
                          value={linkedinOptions.maxPosts}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                            setLinkedinOptions(prev => ({ ...prev, maxPosts: isNaN(val) ? 0 : Math.min(100, val) }));
                          }}
                        />
                        <span className="text-xs text-muted-foreground">activités max par profil</span>
                      </div>
                    </div>

                    {/* Type d'activité */}
                    <div className="space-y-1">
                      <Label className="text-xs text-orange-200/80">Type d'activité</Label>
                      <div className="flex gap-1.5">
                        {([
                          { value: 'all', label: '📋 Tout', title: 'Posts et commentaires' },
                          { value: 'posts', label: '✍️ Posts', title: 'Posts seulement' },
                          { value: 'comments', label: '💬 Commentaires', title: 'Commentaires seulement' },
                        ] as const).map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            title={opt.title}
                            onClick={() => setLinkedinOptions(prev => ({ ...prev, activityType: opt.value }))}
                            className={[
                              'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                              linkedinOptions.activityType === opt.value
                                ? 'bg-orange-500/30 border-orange-500/70 text-orange-200'
                                : 'bg-transparent border-orange-500/20 text-orange-300/60 hover:border-orange-500/40 hover:text-orange-300/90',
                            ].join(' ')}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Facebook Credentials — shown only when Facebook is selected */}
              {filters.channels.includes("facebook") && (
                <div className="space-y-3 rounded-xl border border-blue-500/40 bg-blue-500/5 p-4">
                  <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
                    <ShieldAlert className="text-blue-400 mt-0.5 shrink-0" size={16} />
                    <p className="text-xs text-blue-300 leading-snug">
                      <span className="font-semibold block mb-1">⚠️ Compte Facebook dédié</span>
                      Utilisez un compte secondaire pour éviter tout risque de bannissement.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fb-email" className="text-xs font-semibold text-blue-300">
                      Email Facebook <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fb-email"
                      type="email"
                      placeholder="compte.dedie@email.com"
                      value={facebookCredentials.email}
                      onChange={(e) => setFacebookCredentials(prev => ({ ...prev, email: e.target.value }))}
                      className="border-blue-500/30 focus:border-blue-500/60 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fb-password" className="text-xs font-semibold text-blue-300">
                      Mot de passe <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="fb-password"
                        type={showFacebookPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={facebookCredentials.password}
                        onChange={(e) => setFacebookCredentials(prev => ({ ...prev, password: e.target.value }))}
                        className="border-blue-500/30 focus:border-blue-500/60 text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFacebookPassword(p => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showFacebookPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* ── Options avancées d'activité Facebook ── */}
                  <div className="space-y-3 pt-1 border-t border-blue-500/20">
                    <p className="text-xs font-semibold text-blue-300">⚙️ Options d'activité</p>

                    {/* Nombre d'activités */}
                    <div className="space-y-1">
                      <Label htmlFor="fb-max-posts" className="text-xs text-blue-200/80">
                        Nombre d'activités à extraire
                        <span className="ml-1 text-blue-400/60 font-normal">(1–100)</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="fb-max-posts"
                          type="number"
                          min="0"
                          max="100"
                          className="h-8 bg-muted/20 border-blue-500/20"
                          value={facebookOptions.maxPosts}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                            setFacebookOptions(prev => ({ ...prev, maxPosts: isNaN(val) ? 0 : Math.min(100, val) }));
                          }}
                        />
                        <span className="text-xs text-muted-foreground">activités max par profil</span>
                      </div>
                    </div>

                    {/* Type d'activité */}
                    <div className="space-y-1">
                      <Label className="text-xs text-blue-200/80">Type d'activité</Label>
                      <div className="flex gap-1.5">
                        {([
                          { value: 'all', label: '📋 Tout', title: 'Posts et commentaires' },
                          { value: 'posts', label: '✍️ Posts', title: 'Posts seulement' },
                          { value: 'comments', label: '💬 Commentaires', title: 'Commentaires seulement' },
                        ] as const).map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            title={opt.title}
                            onClick={() => setFacebookOptions(prev => ({ ...prev, activityType: opt.value }))}
                            className={[
                              'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                              facebookOptions.activityType === opt.value
                                ? 'bg-blue-500/30 border-blue-500/70 text-blue-200'
                                : 'bg-transparent border-blue-500/20 text-blue-300/60 hover:border-blue-500/40 hover:text-blue-300/90',
                            ].join(' ')}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              <div className="space-y-2 pt-4">
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={handleSearch}
                    disabled={isSearching}
                  >
                    {isSearching ? <LoadingLogo size="xs" compact className="mr-2" /> : <Search size={18} className="mr-2" />}
                    {isSearching ? t("loading") : t("rechercher")}
                  </Button>

                  {isSearching && (
                    <Button
                      variant="outline"
                      className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10 font-semibold py-6 rounded-xl transition-all duration-300"
                      onClick={handleStopSearch}
                    >
                      <Square size={18} className="mr-2" />
                      Arrêter la recherche
                    </Button>
                  )}
                </div>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full"
                >
                  <Filter size={18} className="mr-2" />
                  {t("reset")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Area */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Terminal View */}
            {(isSearching || terminalLogs.length > 0) && (
              <div className="bg-[#050505] rounded shadow-lg overflow-hidden font-mono border border-green-500/20 max-w-4xl mx-auto w-full">
                {/* Retro Terminal Header */}
                <div className="bg-zinc-950 px-4 py-2 border-b border-green-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-green-500 font-bold tracking-widest">
                      PROSPECTA // LEAD SCANNER
                    </span>
                    <span className="text-[10px] text-green-500/50">|</span>
                    <span className="text-[10px] text-zinc-500">
                      {isSearching ? "SCAN_EN_COURS" : "EN_VEILLE"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 ${isSearching ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`}></div>
                     <span className={`text-[9px] font-bold uppercase ${isSearching ? 'text-green-500' : 'text-zinc-500'}`}>
                       {isSearching ? 'SCAN ACTIF' : 'SCAN PAUSÉ'}
                     </span>
                  </div>
                </div>
                
                {/* Terminal Body */}
                <div className="p-4 space-y-4">
                  {/* Progress Section */}
                  <div className="flex flex-col gap-1 border-b border-green-500/10 pb-3">
                     <div className="flex justify-between items-center text-[10px] text-green-500">
                       <span className="uppercase tracking-widest">
                         {isSearching
                           ? (scrapeProgress.message || loadingMessages[loadingStep] || "Scan des prospects en cours…")
                           : "Scan terminé — résultats prêts"}
                       </span>
                       <span>
                         Progression : {scrapeProgress.percentage}% • Prospects détectés : {pendingProspects.length}
                       </span>
                     </div>
                     <div className="h-1 bg-zinc-900 w-full">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-300 transition-all duration-300" 
                          style={{ width: `${scrapeProgress.percentage}%` }} 
                        />
                     </div>
                  </div>

                  {/* Logs View */}
                  <div className="h-[350px] overflow-y-auto space-y-1 text-[12px] leading-relaxed scrollbar-none pb-4 font-mono text-green-400/90">
                    {terminalLogs.map((log) => (
                      <div key={log.id} className="flex gap-3 animate-in fade-in duration-200 whitespace-pre-wrap">
                        <span className="opacity-50 shrink-0 w-20">[{log.time}]</span>
                        <span className={
                          log.type === 'error' ? 'text-red-500' :
                          log.type === 'warn' ? 'text-yellow-500' :
                          log.type === 'success' ? 'text-green-400 font-bold' :
                          'text-green-500'
                        }>
                          <span className="mr-2 opacity-50">❯</span>
                          {log.message}
                        </span>
                      </div>
                    ))}
                    {isSearching && (
                      <div className="flex gap-3 py-1">
                        <span className="opacity-50 w-20">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                        <span className="text-green-500">
                          ❯ <span className="animate-[pulse_1s_infinite] inline-block w-2 h-3 bg-green-500 ml-1 mb-[-1px]"></span>
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Control Panel */}
                  <div className="flex justify-start pt-2 border-t border-green-500/10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                         if (isSearching) handleStopSearch();
                         else {
                           setTerminalLogs([]);
                           setPendingProspects([]);
                           setScrapeProgress({ percentage: 0, message: "" });
                           localStorage.removeItem('prospecta_search_session');
                         }
                      }}
                      className={`text-[10px] uppercase font-bold h-8 rounded-none border ${isSearching ? 'text-red-500 border-red-500/30 hover:bg-red-500/10' : 'text-zinc-500 border-zinc-500/30 hover:text-white hover:bg-zinc-800'}`}
                    >
                      {isSearching ? <Square size={10} className="mr-2 fill-current" /> : <X size={10} className="mr-2" />}
                      {isSearching ? "Arrêter le scan" : "Vider la console"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Results Table */}
            {pendingProspects.length > 0 && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <CheckCircle2 className="text-accent" /> {t("validateResults")} ({pendingProspects.length})
                  </h2>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPendingProspects([])}>
                      <XCircle className="mr-2" size={16} /> {t("ignore")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddToCampaign}
                      className="border-accent text-accent hover:bg-accent/10"
                      disabled={selectedProspectIds.size === 0 || isSavingForCampaign}
                    >
                      {isSavingForCampaign ? <LoadingLogo size="xs" compact className="mr-2" /> : <Plus className="mr-2" size={16} />}
                      {t("addToCampaign")} ({selectedProspectIds.size})
                    </Button>
                    <Button size="sm" onClick={handleSaveSelected} className="bg-accent" disabled={selectedProspectIds.size === 0}>
                      <Plus className="mr-2" size={16} /> {t("import")} ({selectedProspectIds.size})
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedProspectIds.size === pendingProspects.length && pendingProspects.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>{t("name")}</TableHead>
                        <TableHead>{t("company")}</TableHead>
                        <TableHead>{t("source")}</TableHead>
                        <TableHead>{t("score")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentProspects.map(p => (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-accent/5 group" onClick={() => handleViewProspect(p)}>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedProspectIds.has(p.id)} onCheckedChange={() => toggleProspectSelection(p.id)} />
                          </TableCell>
                          <TableCell className="font-bold">{p.name}</TableCell>
                          <TableCell>{p.company}</TableCell>
                          <TableCell><Badge variant="outline">{p.source}</Badge></TableCell>
                          <TableCell><Badge variant="secondary">{p.score}%</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between bg-card p-4 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{t("show")}:</span>
                    <Select
                      value={String(itemsPerPage)}
                      onValueChange={(v) => {
                        setItemsPerPage(Number(v));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[80px] h-8">
                        <SelectValue placeholder="15" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t("pageOf", { current: currentPage, total: totalPages || 1 })}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        {t("previous")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                      >
                        {t("next")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {isSearching && pendingProspects.length === 0 && (
              <div className="flex flex-col items-center justify-center p-20 w-full min-h-[400px]">
                <LoadingLogo 
                  size="lg" 
                  message="Moteurs de recherche en cours d'analyse..." 
                />
              </div>
            )}

            {/* Empty State View */}
            {!isSearching && terminalLogs.length === 0 && pendingProspects.length === 0 && (
              <Card className="border border-dashed bg-card/40 backdrop-blur-sm rounded-2xl overflow-hidden hover:border-accent/40 hover:bg-card/60 transition-all duration-500 group shadow-sm relative h-[600px] flex items-center justify-center w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none opacity-30"></div>
                <CardContent className="flex flex-col items-center justify-center p-8 relative z-10 w-full max-w-md mx-auto">
                  
                  <div className="relative mb-8 flex items-center justify-center">
                    <div className="absolute inset-0 bg-accent/20 rounded-full blur-[40px] group-hover:bg-accent/30 transition-all duration-700"></div>
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border/50 shadow-lg flex items-center justify-center group-hover:scale-105 group-hover:-rotate-3 transition-transform duration-500 relative z-10 text-accent">
                      <Search size={32} className="opacity-80" />
                      <Sparkles size={16} className="absolute -top-2 -right-2 text-primary animate-pulse" />
                    </div>
                  </div>

                  <div className="text-center space-y-3">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground transition-all duration-500">
                      {t("findProspects")}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-[300px] mx-auto">
                      {t("findProspectsDesc")}
                    </p>
                  </div>

                  <div className="mt-8 flex items-center justify-center gap-1.5 opacity-30 group-hover:opacity-60 transition-opacity duration-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <ProspectDetailView
        prospect={selectedViewProspect}
        isOpen={isDetailViewOpen}
        onOpenChange={setIsDetailViewOpen}
      />

      <CampaignSelectionDialog
        isOpen={isCampaignDialogOpen}
        onOpenChange={setIsCampaignDialogOpen}
        prospectIds={prospectIdsForCampaign}
        onSuccess={() => {
          // Clear selecting state after successful addition
          setSelectedProspectIds(new Set());
          setPendingProspects([]);
        }}
      />
    </div>
  );
};

export default ProspectFinder;
