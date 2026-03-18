import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Star, Archive, Send, Sparkles, X, ChevronLeft,
  Inbox as InboxIcon, Mail, MailOpen, Building2, Clock,
  AlertCircle, CheckCheck, Loader2, RefreshCw
} from "lucide-react";
import Header from "@/components/dashboard/Header";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Badge }    from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useInbox, InboxThread, InboxMessage } from "@/hooks/useInbox";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

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
  onClick,
  onStar,
  onArchive,
}: {
  thread: InboxThread;
  isSelected: boolean;
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
        isSelected && "bg-accent/10 border-l-2 border-l-accent"
      )}
    >
      {/* Avatar prospect */}
      <div className={cn(
        "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold",
        hasUnread
          ? "bg-accent/20 text-accent"
          : "bg-muted text-muted-foreground"
      )}>
        {getInitials(thread.prospect_name)}
      </div>

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
            <span className="text-[10px] bg-accent/5 border border-accent/20 px-1.5 py-0.5 rounded text-accent font-medium uppercase tracking-wider">
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
          "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
          isSent
            ? "bg-accent text-white rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        )}>
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

// ─── Composant : zone de réponse ──────────────────────────────────────────────

function ReplyBox({
  onSend,
  sending,
  pendingDraft,
}: {
  onSend: (body: string, draftUsed: string | null) => void;
  sending: boolean;
  pendingDraft: string | null;
}) {
  const [body, setBody] = useState("");
  const [usedDraft, setUsedDraft] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pré-remplit avec le draft IA si disponible et non encore utilisé
  useEffect(() => {
    if (pendingDraft && body === "") {
      setBody(pendingDraft);
      setUsedDraft(pendingDraft);
      textareaRef.current?.focus();
    }
  }, [pendingDraft]);

  const handleSend = () => {
    if (!body.trim() || sending) return;
    onSend(body.trim(), usedDraft);
    setBody("");
    setUsedDraft(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend();
  };

  return (
    <div className="border-t border-border bg-background p-3">
      {usedDraft && body === usedDraft && (
        <div className="flex items-center gap-1.5 text-[11px] text-accent mb-2 px-1">
          <Sparkles size={11} />
          Draft IA chargé — modifiez si besoin avant d'envoyer
          <button
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => { setBody(""); setUsedDraft(null); }}
          >
            <X size={11} />
          </button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Répondre au prospect… (Ctrl+Entrée pour envoyer)"
          className="min-h-[72px] max-h-[180px] resize-none text-sm bg-muted/30 border-border/50 focus:border-accent/50 rounded-xl"
          rows={3}
        />
        <Button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="h-10 px-4 bg-accent hover:bg-accent/90 text-white rounded-xl flex-shrink-0"
        >
          {sending
            ? <Loader2 size={16} className="animate-spin" />
            : <Send size={16} />
          }
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
        Ctrl+Entrée pour envoyer
      </p>
    </div>
  );
}

// ─── Page principale : Inbox ──────────────────────────────────────────────────

const Inbox = () => {
  const {
    threads, messages, selectedThread, loading, loadingMessages,
    sending, generatingDraft, totalUnread,
    openThread, sendReply, generateAIDraft, dismissAIDraft,
    archiveThread, toggleStar, fetchThreads,
  } = useInbox();

  const [search, setSearch]           = useState("");
  const [showStarred, setShowStarred] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll automatique vers le bas à chaque nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filtre les fils selon la recherche et le filtre favori
  const filteredThreads = threads.filter(t => {
    const matchSearch = !search
      || t.prospect_name.toLowerCase().includes(search.toLowerCase())
      || t.prospect_email.toLowerCase().includes(search.toLowerCase())
      || t.subject.toLowerCase().includes(search.toLowerCase());
    const matchStar = !showStarred || t.is_starred;
    return matchSearch && matchStar;
  });

  // Draft IA en attente dans le fil sélectionné
  const pendingDraft = messages.find(
    m => m.direction === "received" &&
         m.ai_status === "draft_ready" &&
         m.ai_draft_body
  )?.ai_draft_body ?? null;

  const handleSelectThread = (thread: InboxThread) => {
    openThread(thread);
    setMobilePanelOpen(true);
  };

  const handleSend = async (body: string, draftUsed: string | null) => {
    if (!selectedThread) return;
    await sendReply(selectedThread.id, body, draftUsed);
  };

  const handleGenerateDraft = async (messageId: string) => {
    if (!selectedThread) return;
    await generateAIDraft(messageId, selectedThread.id);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

        {/* ── Colonne gauche : liste des fils ─────────────────────────────── */}
        <div className={cn(
          "w-full md:w-[340px] lg:w-[380px] flex-shrink-0 flex flex-col border-r border-border",
          "md:flex",
          mobilePanelOpen ? "hidden" : "flex"
        )}>
          {/* En-tête liste */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <InboxIcon size={18} className="text-accent" />
                <h1 className="font-semibold text-base text-foreground">Inbox</h1>
                {totalUnread > 0 && (
                  <Badge className="bg-accent text-white text-[10px] h-4 px-1.5 rounded-full">
                    {totalUnread}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowStarred(!showStarred)}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    showStarred
                      ? "bg-amber-100 text-amber-500 dark:bg-amber-900/30"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  title="Favoris uniquement"
                >
                  <Star size={15} />
                </button>
                <button
                  onClick={fetchThreads}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                  title="Actualiser"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une conversation…"
                className="pl-8 h-8 text-sm bg-muted/40 border-border/50"
              />
            </div>
          </div>

          {/* Liste des fils */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
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
            ) : (
              filteredThreads.map(thread => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedThread?.id === thread.id}
                  onClick={() => handleSelectThread(thread)}
                  onStar={() => toggleStar(thread.id, thread.is_starred)}
                  onArchive={() => archiveThread(thread.id)}
                />
              ))
            )}
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
                {/* Bouton retour mobile */}
                <button
                  className="md:hidden p-1 rounded text-muted-foreground hover:bg-muted"
                  onClick={() => setMobilePanelOpen(false)}
                >
                  <ChevronLeft size={18} />
                </button>

                {/* Avatar + infos prospect */}
                <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent flex-shrink-0">
                  {getInitials(selectedThread.prospect_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {selectedThread.prospect_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  </div>
                </div>

                {/* Sujet + actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-muted-foreground hidden lg:block max-w-[200px] truncate">
                    {selectedThread.subject}
                  </span>
                  <button
                    onClick={() => toggleStar(selectedThread.id, selectedThread.is_starred)}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                  >
                    <Star size={15} className={
                      selectedThread.is_starred
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground"
                    } />
                  </button>
                  <button
                    onClick={() => archiveThread(selectedThread.id)}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                    title="Archiver"
                  >
                    <Archive size={15} />
                  </button>
                </div>
              </div>

              {/* Corps des messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {loadingMessages ? (
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

              {/* Zone de réponse */}
              <ReplyBox
                onSend={handleSend}
                sending={sending}
                pendingDraft={pendingDraft}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inbox;
