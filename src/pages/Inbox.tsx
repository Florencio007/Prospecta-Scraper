import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Star, Archive, Send, Sparkles, X, ChevronLeft,
  Inbox as InboxIcon, Mail, MailOpen, Building2, Clock,
  AlertCircle, CheckCheck, Loader2, RefreshCw,
  Users, Tag, Bell, Phone, Video, Info, MoreHorizontal, Edit, Image, StickyNote, Smile, ThumbsUp, MoreVertical, Hash, ExternalLink
} from "lucide-react";
import Header from "@/components/dashboard/Header";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Badge }    from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useInbox, InboxThread, InboxMessage } from "@/hooks/useInbox";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import ProspectDetailView from "@/components/dashboard/ProspectDetailView";
import { PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen, ChevronDown, ChevronRight } from "lucide-react";

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "À l'instant";
  if (m < 60) return `il y a ${m} min`;
  if (h < 24) return `il y a ${h}h`;
  if (d < 7)  return `il y a ${d}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  demo_request:    { label: "Demande de démo",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  price_objection: { label: "Objection prix",       color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  product_question:{ label: "Question produit",     color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

// ─── Composant : carte d'un fil dans la liste ─────────────────────────────────

function ThreadCard({
  thread,
  isSelected,
  isSelectionMode,
  isChecked,
  onClick,
  onStar,
  onArchive,
}: {
  thread: InboxThread;
  isSelected: boolean;
  isSelectionMode?: boolean;
  isChecked?: boolean;
  onClick: () => void;
  onStar: () => void;
  onArchive: () => void;
}) {
  const hasUnread = thread.unread_count > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/50",
        "hover:bg-accent/5",
        (isSelected || isChecked) && "bg-accent/10 border-l-2 border-l-accent"
      )}
    >
      {/* Selection Checkbox OR Avatar prospect */}
      {isSelectionMode ? (
        <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center">
          <div className={cn(
            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
            isChecked ? "bg-accent border-accent text-white" : "border-muted-foreground/30 bg-background"
          )}>
            {isChecked && <CheckCheck size={12} strokeWidth={3} />}
          </div>
        </div>
      ) : (
        <div className={cn(
          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold",
          hasUnread
            ? "bg-accent/20 text-accent"
            : "bg-muted text-muted-foreground"
        )}>
          {getInitials(thread.prospect_name)}
        </div>
      )}

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className={cn(
            "text-sm truncate",
            hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"
          )}>
            {thread.prospect_name}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {timeAgo(thread.last_message_at)}
          </span>
        </div>

        <div className="text-xs text-muted-foreground truncate mb-1">
          {thread.prospect_company && (
            <span className="mr-1">{thread.prospect_company} ·</span>
          )}
          {thread.subject}
        </div>

        {thread.last_received_preview && (
          <p className="text-xs text-muted-foreground/70 truncate">
            {thread.last_received_preview}
          </p>
        )}

        <div className="flex items-center gap-1.5 mt-1.5">
          {thread.campaign_name && (
            <span className="text-[10px] bg-accent/10 border border-accent/30 px-2 py-0.5 rounded text-accent font-bold uppercase tracking-wider">
              {thread.campaign_name}
            </span>
          )}
          {thread.has_pending_ai_draft && (
            <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium">
              <Sparkles size={9} /> Draft IA prêt
            </span>
          )}
        </div>
      </div>

      {/* Indicateurs droite */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {hasUnread && (
          <span className="bg-accent text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {thread.unread_count}
          </span>
        )}

        {/* Actions au survol */}
        <div className="hidden group-hover:flex items-center gap-1 mt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onStar(); }}
            className="p-0.5 rounded hover:bg-muted"
            title={thread.is_starred ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Star size={12} className={thread.is_starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            className="p-0.5 rounded hover:bg-muted"
            title="Archiver"
          >
            <Archive size={12} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant : bulle de message ────────────────────────────────────────────

function MessageBubble({
  message,
  onGenerateDraft,
  onDismissDraft,
  generatingDraft,
}: {
  message: InboxMessage;
  onGenerateDraft: (id: string) => void;
  onDismissDraft:  (id: string) => void;
  generatingDraft: boolean;
}) {
  const isSent = message.direction === "sent";
  const intent = message.ai_detected_intent
    ? INTENT_LABELS[message.ai_detected_intent]
    : null;

  return (
    <div className={cn("flex gap-2 mb-4", isSent ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      {!isSent && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground mt-1">
          P
        </div>
      )}

      <div className={cn("flex flex-col gap-1.5 max-w-[72%]", isSent && "items-end")}>
        {/* Bulle principale */}
        <div className={cn(
          "px-4 py-2.5 rounded-[1.25rem] text-sm leading-relaxed whitespace-pre-wrap break-words" + 
          (isSent ? " break-all" : " break-words"), // Apply break-all for long links to guarantee no overflow
          "shadow-sm transition-all max-w-full",
          isSent
            ? "bg-gradient-to-br from-accent to-accent/80 text-white rounded-tr-sm hover:translate-y-[-1px] hover:shadow-md"
            : "bg-muted/80 backdrop-blur-sm text-foreground rounded-tl-sm border border-border/50 hover:bg-muted"
        )} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          {message.body_text}
        </div>

        {/* Horodatage */}
        <span className="text-[11px] text-muted-foreground px-1">
          {new Date(message.received_at).toLocaleTimeString("fr-FR", {
            hour: "2-digit", minute: "2-digit"
          })}
          {isSent && (
            <CheckCheck size={11} className="inline ml-1 text-accent/70" />
          )}
        </span>

        {/* Bandeau IA (message reçu avec intention détectée) */}
        {!isSent && message.ai_status === "detected" && intent && (
          <div className="flex items-center gap-2 mt-1 bg-accent/5 border border-accent/20 rounded-xl px-3 py-2">
            <Sparkles size={13} className="text-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1.5", intent.color)}>
                {intent.label}
              </span>
              <span className="text-[11px] text-muted-foreground">
                L'IA peut générer une réponse adaptée
              </span>
            </div>
            <button
              className="h-6 text-[11px] px-2 border-accent/30 text-accent hover:bg-accent/10 border rounded-md"
              onClick={() => onGenerateDraft(message.id)}
              disabled={generatingDraft}
            >
              {generatingDraft
                ? <Loader2 size={10} className="animate-spin" />
                : "Suggérer ↗"
              }
            </button>
          </div>
        )}

        {/* Draft IA prêt (affiché sous le message reçu) */}
        {!isSent && message.ai_status === "draft_ready" && message.ai_draft_body && (
          <div className="mt-1 border border-accent/30 rounded-xl overflow-hidden bg-accent/5">
            <div className="flex items-center justify-between px-3 py-1.5 bg-accent/10 border-b border-accent/20">
              <span className="text-[11px] font-semibold text-accent flex items-center gap-1">
                <Sparkles size={11} /> Draft IA — à valider avant envoi
              </span>
              <button
                onClick={() => onDismissDraft(message.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            </div>
            <p className="px-3 py-2 text-xs text-muted-foreground italic leading-relaxed">
              {message.ai_draft_body}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Page principale : Inbox ──────────────────────────────────────────────────

const Inbox = ({ isStandalone = true }: { isStandalone?: boolean }) => {
  const {
    threads, messages, selectedThread, loading, loadingMessages,
    sending, generatingDraft, totalUnread,
    openThread, sendReply, generateAIDraft, dismissAIDraft,
    archiveThread, archiveThreads, markThreadsAsRead, toggleStar, fetchThreads, syncNow
  } = useInbox();

  const [search, setSearch]           = useState("");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("primary");

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [usedDraft, setUsedDraft] = useState<string | null>(null);
  const [isProspectDetailOpen, setIsProspectDetailOpen] = useState(false);

  // Draft IA en attente dans le fil sélectionné
  const pendingDraft = messages.find(
    m => m.direction === "received" &&
         m.ai_status === "draft_ready" &&
         m.ai_draft_body
  )?.ai_draft_body ?? null;

  // Scroll automatique vers le bas à chaque nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pré-remplit avec le draft IA si disponible et non encore utilisé
  useEffect(() => {
    if (pendingDraft && body === "") {
      setBody(pendingDraft);
      setUsedDraft(pendingDraft);
      textareaRef.current?.focus();
    }
  }, [pendingDraft]);

  // Filtre les fils selon la recherche et la catégorie
  const filteredThreads = threads.filter(t => {
    const matchSearch = !search
      || t.prospect_name.toLowerCase().includes(search.toLowerCase())
      || t.prospect_email.toLowerCase().includes(search.toLowerCase())
      || t.subject.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;

    if (selectedCategory === "unread") {
      return t.unread_count > 0;
    } else if (selectedCategory === "campaigns") {
      return !!t.campaign_name;
    } else {
      return true; // "primary" affiche tout (sauf si on veut masquer les non-lus, mais généralement on affiche tout)
    }
  });

  const groupedByCampaign = filteredThreads.reduce((acc, t) => {
    if (t.campaign_name) {
      if (!acc[t.campaign_name]) acc[t.campaign_name] = [];
      acc[t.campaign_name].push(t);
    }
    return acc;
  }, {} as Record<string, InboxThread[]>);

  const toggleCampaignExpand = (campaignName: string) => {
    setExpandedCampaigns(prev => ({ ...prev, [campaignName]: !prev[campaignName] }));
  };

  const handleSelectThread = (thread: InboxThread) => {
    if (isSelectionMode) {
      setSelectedThreadIds(prev => 
        prev.includes(thread.id) ? prev.filter(id => id !== thread.id) : [...prev, thread.id]
      );
      return;
    }
    openThread(thread);
    setMobilePanelOpen(true);
  };

  const handleBulkArchive = async () => {
    if (selectedThreadIds.length === 0) return;
    await archiveThreads(selectedThreadIds);
    setIsSelectionMode(false);
    setSelectedThreadIds([]);
  };

  const handleBulkMarkRead = async () => {
    if (selectedThreadIds.length === 0) return;
    await markThreadsAsRead(selectedThreadIds);
    setIsSelectionMode(false);
    setSelectedThreadIds([]);
  };

  const handleSend = async (bodyValue: string, draftUsed: string | null) => {
    if (!selectedThread || !bodyValue.trim() || sending) return;
    await sendReply(selectedThread.id, bodyValue.trim(), draftUsed);
    setBody("");
    setUsedDraft(null);
  };

  const handleGenerateDraft = async (messageId: string) => {
    if (!selectedThread) return;
    await generateAIDraft(messageId, selectedThread.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSend(body, usedDraft);
    }
  };

  return (
    <div className={cn("bg-background flex flex-col", isStandalone ? "min-h-screen" : "h-full w-full overflow-hidden")}>
      {isStandalone && <Header />}

      <div className="flex-1 flex overflow-hidden" 
           style={isStandalone ? { height: "calc(100vh - 64px)" } : { height: "100%" }}>

        {/* ── Colonne gauche : liste des fils (Discussions) ───────────────────────── */}
        <div className={cn(
          "flex-shrink-0 flex flex-col border-r border-border bg-background transition-all duration-300 ease-in-out",
          mobilePanelOpen ? "hidden md:flex" : "flex",
          isLeftSidebarOpen ? "w-full md:w-[320px] lg:w-[360px]" : "w-0 overflow-hidden border-none opacity-0"
        )}>
          <div className="min-w-[320px] lg:min-w-[360px] h-full flex flex-col">
            {/* En-tête Discussions */}
          <div className="px-4 py-4 pt-6 space-y-4">
            {isSelectionMode ? (
              <div className="flex items-center justify-between bg-accent/5 p-2 rounded-lg border border-accent/20">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { setIsSelectionMode(false); setSelectedThreadIds([]); }}
                    className="p-1.5 rounded-full hover:bg-accent/10 text-accent transition-colors"
                  >
                    <X size={18} />
                  </button>
                  <span className="font-semibold text-accent text-sm">
                    {selectedThreadIds.length} sélectionné(s)
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button 
                    onClick={handleBulkMarkRead}
                    disabled={selectedThreadIds.length === 0}
                    className="p-1.5 rounded-md hover:bg-accent/10 text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Marquer comme lu"
                  >
                    <CheckCheck size={18} />
                  </button>
                  <button 
                    onClick={handleBulkArchive}
                    disabled={selectedThreadIds.length === 0}
                    className="p-1.5 rounded-md hover:bg-accent/10 text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Archiver"
                  >
                    <Archive size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">Discussions</h1>
                  {loading && threads.length > 0 && <Loader2 size={16} className="animate-spin text-muted-foreground/50" />}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsSelectionMode(true)}
                    className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                    title="Sélection multiple"
                  >
                    <CheckCheck size={20} />
                  </button>
                  <button className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors">
                    <Edit size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* Barre de recherche style Messenger */}
            <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher dans Messenger"
                className="pl-10 h-10 rounded-full bg-muted/50 border-transparent focus:bg-background focus:ring-1 focus:ring-accent transition-all text-sm"
              />
            </div>

            {/* Filtres style Messenger */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {["primary", "unread", "campaigns"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedCategory(tab)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all",
                    selectedCategory === tab
                      ? "bg-accent/10 text-accent"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {tab === "primary" ? "Tout" : tab === "unread" ? "Non lu" : "Campagnes"}
                </button>
              ))}
            </div>
          </div>


          {/* Liste des fils */}
          <div className="flex-1 overflow-y-auto">
            {loading && threads.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 size={20} className="animate-spin mr-2" />
                Chargement…
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <Mail size={32} className="text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {search ? "Aucune conversation trouvée" : "Aucune réponse pour l'instant"}
                </p>
                {!search && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Les réponses de vos prospects apparaîtront ici
                  </p>
                )}
              </div>
            ) : selectedCategory === "campaigns" ? (
              // Affichage groupé par campagne
              Object.entries(groupedByCampaign).map(([campaignName, campaignThreads]) => (
                <div key={campaignName} className="border-b border-border/50">
                  <button 
                    onClick={() => toggleCampaignExpand(campaignName)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Hash size={16} className="text-muted-foreground" />
                      <span className="font-semibold text-sm text-foreground">{campaignName}</span>
                      <Badge variant="secondary" className="text-[10px] ml-2">{campaignThreads.length}</Badge>
                    </div>
                    {expandedCampaigns[campaignName] !== false ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                  </button>
                  {expandedCampaigns[campaignName] !== false && (
                    <div className="pl-2 bg-muted/5 pb-2">
                      {campaignThreads.map(thread => (
                        <ThreadCard
                          key={thread.id}
                          thread={thread}
                          isSelected={selectedThread?.id === thread.id}
                          isSelectionMode={isSelectionMode}
                          isChecked={selectedThreadIds.includes(thread.id)}
                          onClick={() => handleSelectThread(thread)}
                          onStar={() => toggleStar(thread.id, thread.is_starred)}
                          onArchive={() => archiveThread(thread.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              // Affichage normal (Tout ou Non Lu)
              filteredThreads.map(thread => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedThread?.id === thread.id}
                  isSelectionMode={isSelectionMode}
                  isChecked={selectedThreadIds.includes(thread.id)}
                  onClick={() => handleSelectThread(thread)}
                  onStar={() => toggleStar(thread.id, thread.is_starred)}
                  onArchive={() => archiveThread(thread.id)}
                />
              ))
            )}
          </div>
          </div>
        </div>

        {/* ── Colonne droite : fil de conversation ────────────────────────── */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          "md:flex",
          mobilePanelOpen ? "flex" : "hidden"
        )}>
          {!selectedThread ? (
            /* État vide */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <MailOpen size={48} className="text-muted-foreground/20 mb-4" />
              <p className="text-base font-medium text-muted-foreground/50">
                Sélectionne une conversation
              </p>
              <p className="text-sm text-muted-foreground/40 mt-1">
                Choisis un fil à gauche pour lire et répondre
              </p>
            </div>
          ) : (
            <>
              {/* En-tête du fil */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background flex-shrink-0">
                {/* Toggle Gauche (Desktop) */}
                <button
                  className="hidden md:flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                  title={isLeftSidebarOpen ? "Fermer la liste" : "Ouvrir la liste"}
                >
                  {isLeftSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                </button>

                {/* Bouton retour mobile */}
                <button
                  className="md:hidden p-1.5 rounded text-muted-foreground hover:bg-muted"
                  onClick={() => setMobilePanelOpen(false)}
                >
                  <ChevronLeft size={18} />
                </button>

                {/* Avatar + infos prospect */}
                <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent flex-shrink-0 ml-1">
                  {getInitials(selectedThread.prospect_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {selectedThread.prospect_name}
                    </p>
                    {loadingMessages && messages.length > 0 && <Loader2 size={12} className="animate-spin text-muted-foreground/50" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {selectedThread.prospect_company && (
                      <span className="flex items-center gap-1">
                        <Building2 size={10} />
                        {selectedThread.prospect_company}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Mail size={10} />
                      {selectedThread.prospect_email}
                    </span>
                    {selectedThread.campaign_name && (
                      <Badge variant="outline" className="ml-2 bg-accent/10 border-accent/30 text-accent text-[10px] py-0 px-2 h-5 uppercase font-bold tracking-wider">
                        {selectedThread.campaign_name}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Sujet + actions style Messenger */}
                <div className="flex items-center gap-1 pr-2 flex-shrink-0">
                  <button className="p-2 text-primary hover:bg-muted rounded-full transition-colors hidden sm:block">
                    <Phone size={18} className="text-secondary-foreground" />
                  </button>
                  <button className="p-2 text-primary hover:bg-muted rounded-full transition-colors hidden sm:block">
                    <Video size={18} className="text-secondary-foreground" />
                  </button>

                  <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

                  {/* Toggle Droite (Desktop) */}
                  <button
                    className="hidden xl:flex p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                    title={isRightSidebarOpen ? "Fermer les infos" : "Ouvrir les infos"}
                  >
                    {isRightSidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                  </button>
                </div>
              </div>

              {/* Corps des messages */}
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-thin scroll-smooth min-h-0">
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Chargement des messages…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                    <Clock size={24} className="mb-2" />
                    <p className="text-sm">En attente de réponse</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      onGenerateDraft={handleGenerateDraft}
                      onDismissDraft={dismissAIDraft}
                      generatingDraft={generatingDraft}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Zone de réponse style Messenger */}
              <div className={cn("px-4 py-3 flex items-center gap-2 border-t border-border bg-background", !isRightSidebarOpen && "pr-16")}>
                <div className="flex gap-1.5 px-1">
                  <button className="p-2 text-secondary-foreground hover:bg-muted rounded-full transition-colors lg:block hidden"><MoreHorizontal size={20} /></button>
                  <button className="p-2 text-secondary-foreground hover:bg-muted rounded-full transition-colors sm:block hidden"><Image size={20} /></button>
                  <button className="p-2 text-secondary-foreground hover:bg-muted rounded-full transition-colors sm:block hidden"><StickyNote size={20} /></button>
                </div>
                
                <div className="flex-1 relative group">
                  <Textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Aa"
                    className="min-h-[40px] max-h-[200px] resize-none text-sm bg-muted/60 border-transparent focus:bg-muted focus:ring-1 focus:ring-accent rounded-full py-2.5 px-4 shadow-none pr-10"
                    rows={1}
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-accent hover:scale-110 transition-transform">
                    <Smile size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {body.trim() ? (
                    <Button
                      onClick={() => handleSend(body, usedDraft)}
                      disabled={sending}
                      className="w-10 h-10 p-0 bg-transparent hover:bg-muted text-accent shadow-none rounded-full"
                    >
                      {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </Button>
                  ) : (
                    <button className="p-2 text-accent hover:bg-muted rounded-full transition-colors">
                      <ThumbsUp size={22} className="fill-accent text-accent" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Colonne droite : Détails du prospect [NOUVEAU] ────────────────── */}
        {selectedThread && (
          <div className={cn(
            "hidden xl:flex flex-shrink-0 flex-col border-l border-border bg-background overflow-y-auto scrollbar-hide transition-all duration-300 ease-in-out",
            isRightSidebarOpen ? "w-[300px]" : "w-0 overflow-hidden border-none opacity-0"
          )}>
            <div className="min-w-[300px] flex flex-col items-center pt-8 pb-6 px-4">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center text-2xl font-bold text-accent border-4 border-background shadow-lg">
                  {getInitials(selectedThread.prospect_name)}
                </div>
                <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-background rounded-full" />
              </div>
              <h2 className="text-xl font-bold text-center mb-1">{selectedThread.prospect_name}</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-6">
                <span className="w-2 h-2 rounded-full bg-green-500" /> En ligne
              </p>

              <div className="flex justify-evenly w-full mb-8">
                <div className="flex flex-col items-center gap-1">
                  <button className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"><Mail size={18} /></button>
                  <span className="text-[10px] text-muted-foreground">Profil</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"><Bell size={18} /></button>
                  <span className="text-[10px] text-muted-foreground">Sourdine</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"><Search size={18} /></button>
                  <span className="text-[10px] text-muted-foreground">Rechercher</span>
                </div>
              </div>

              <div className="w-full space-y-1">
                <button 
                  onClick={() => setIsProspectDetailOpen(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-sm font-semibold text-foreground/90">Informations sur le prospect</span>
                  <Info size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>

                {[
                  { label: "Campagne associée", icon: Hash },
                  { label: "Personnaliser la discussion", icon: Edit },
                  { label: "Fichiers et contenus", icon: Image },
                  { label: "Sécurité et confidentialité", icon: ExternalLink },
                ].map((item, idx) => (
                  <button key={idx} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                    <span className="text-sm font-semibold text-foreground/90">{item.label}</span>
                    <item.icon size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedThread && (
        <ProspectDetailView
          prospect={{
            id: selectedThread.prospect_id || selectedThread.id,
            name: selectedThread.prospect_name,
            email: selectedThread.prospect_email,
            company: selectedThread.prospect_company || 'Entreprise inconnue',
            status: 'contacted'
          } as any}
          isOpen={isProspectDetailOpen}
          onOpenChange={setIsProspectDetailOpen}
        />
      )}
    </div>
  );
};

export default Inbox;
