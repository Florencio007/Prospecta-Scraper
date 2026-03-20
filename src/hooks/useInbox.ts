import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InboxThread {
  id: string;
  prospect_id: string;
  campaign_id: string | null;
  prospect_email: string;
  subject: string;
  last_message_at: string;
  last_direction: "sent" | "received";
  unread_count: number;
  message_count: number;
  is_archived: boolean;
  is_starred: boolean;
  // Champs dénormalisés depuis inbox_threads_view
  prospect_name: string;
  prospect_company: string | null;
  prospect_position: string | null;
  campaign_name: string | null;
  last_received_preview: string | null;
  has_pending_ai_draft: boolean;
  category: "primary" | "social" | "promotions" | "notifications";
}

export interface InboxMessage {
  id: string;
  thread_id: string;
  direction: "sent" | "received";
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string;
  body_text: string;
  is_read: boolean;
  read_at: string | null;
  ai_status: "none" | "detected" | "draft_ready" | "used" | "dismissed";
  ai_detected_intent: string | null;
  ai_draft_body: string | null;
  received_at: string;
  category: "primary" | "social" | "promotions" | "notifications";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInbox() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [threads, setThreads]               = useState<InboxThread[]>([]);
  const [messages, setMessages]             = useState<InboxMessage[]>([]);
  const [selectedThread, setSelectedThread] = useState<InboxThread | null>(null);
  const [loading, setLoading]               = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending]               = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);

  const realtimeRef = useRef<any>(null);

  // ── Chargement des fils ─────────────────────────────────────────────────────

  const fetchThreads = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      console.log("[useInbox] Fetching threads for user:", user.id);
      const { data, error } = await supabase
        .from("inbox_threads_view")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("[useInbox] Error fetching threads:", error);
        throw error;
      }
      console.log("[useInbox] Threads fetched:", data?.length || 0);
      setThreads(data || []);
    } catch (err: any) {
      toast({ title: "Erreur", description: "Impossible de charger les conversations.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // ── Chargement des messages d'un fil ───────────────────────────────────────

  const openThread = useCallback(async (thread: InboxThread) => {
    setSelectedThread(thread);
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("email_messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("received_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Marque tous les messages reçus non lus comme lus
      const unreadIds = (data || [])
        .filter((m: InboxMessage) => m.direction === "received" && !m.is_read)
        .map((m: InboxMessage) => m.id);

      if (unreadIds.length > 0) {
        await (supabase
          .from("email_messages") as any)
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in("id", unreadIds);

        // Met à jour le compteur localement sans refetch
        setThreads(prev => prev.map(t =>
          t.id === thread.id ? { ...t, unread_count: 0 } : t
        ));
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: "Impossible de charger les messages.", variant: "destructive" });
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ── Envoi d'un message ─────────────────────────────────────────────────────

  const sendReply = useCallback(async (
    threadId: string,
    body: string,
    aiDraftUsed?: string | null
  ) => {
    if (!user || !body.trim()) return false;
    setSending(true);
    try {
      // 1. Enregistre dans Supabase (le serveur Express va envoyer via SMTP)
      const thread = threads.find(t => t.id === threadId);
      if (!thread) throw new Error("Fil introuvable");

      const { data: message, error } = await (supabase
        .from("email_messages") as any)
        .insert({
          thread_id:    threadId,
          user_id:      user.id,
          direction:    "sent",
          from_email:   "",             // rempli côté serveur depuis smtp_settings
          to_email:     thread.prospect_email,
          subject:      "Re: " + thread.subject,
          body_text:    body,
          is_read:      true,
          ai_status:    aiDraftUsed ? "used" : "none",
          received_at:  new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Déclenche l'envoi SMTP via le backend Express
      await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: (message as any)?.id,
          threadId,
          body,
          userId: user.id,
        }),
      });

      // 3. Met à jour l'affichage local
      setMessages(prev => [...prev, message]);
      setThreads(prev => prev.map(t =>
        t.id === threadId
          ? { ...t, last_message_at: new Date().toISOString(), last_direction: "sent" }
          : t
      ));

      toast({ title: "Message envoyé", description: `Réponse envoyée à ${thread.prospect_name}` });
      return true;
    } catch (err: any) {
      toast({ title: "Erreur d'envoi", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setSending(false);
    }
  }, [user, threads]);

  // ── Génération d'un draft IA ───────────────────────────────────────────────

  const generateAIDraft = useCallback(async (
    messageId: string,
    threadId: string
  ): Promise<string | null> => {
    if (!user) return null;
    setGeneratingDraft(true);
    try {
      const response = await fetch("/api/inbox/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, threadId, userId: user.id }),
      });

      if (!response.ok) throw new Error("Erreur serveur");

      const { draft } = await response.json();

      // Met à jour le statut IA du message
      await (supabase
        .from("email_messages") as any)
        .update({ ai_status: "draft_ready", ai_draft_body: draft })
        .eq("id", messageId);

      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, ai_status: "draft_ready", ai_draft_body: draft }
          : m
      ));

      return draft;
    } catch (err: any) {
      toast({ title: "Erreur IA", description: "Impossible de générer le draft.", variant: "destructive" });
      return null;
    } finally {
      setGeneratingDraft(false);
    }
  }, [user]);

  // ── Rejeter un draft IA ────────────────────────────────────────────────────

  const dismissAIDraft = useCallback(async (messageId: string) => {
    await (supabase
      .from("email_messages") as any)
      .update({ ai_status: "dismissed" })
      .eq("id", messageId);

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, ai_status: "dismissed" } : m
    ));
  }, []);

  // ── Archiver un fil ────────────────────────────────────────────────────────

  const archiveThread = useCallback(async (threadId: string) => {
    await (supabase
      .from("email_threads") as any)
      .update({ is_archived: true })
      .eq("id", threadId);

    setThreads(prev => prev.filter(t => t.id !== threadId));
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
      setMessages([]);
    }
    toast({ title: "Conversation archivée" });
  }, [selectedThread]);

  const archiveThreads = useCallback(async (threadIds: string[]) => {
    try {
      const { error } = await (supabase
        .from("email_threads") as any)
        .update({ is_archived: true })
        .in("id", threadIds);

      if (error) throw error;
      setThreads(prev => prev.filter(t => !threadIds.includes(t.id)));
      if (selectedThread && threadIds.includes(selectedThread.id)) {
        setSelectedThread(null);
        setMessages([]);
      }
      toast({ title: `${threadIds.length} fil(s) archivé(s)` });
    } catch (err: any) {
      toast({ title: "Erreur", description: "Impossible d'archiver.", variant: "destructive" });
    }
  }, [selectedThread, toast]);

  const markThreadsAsRead = useCallback(async (threadIds: string[]) => {
    try {
      // Pour marquer lu, on cherche les messages non lus de ces fils (ou on met juste à jour un champ sur thread si on l'avait).
      // Dans Pprospecta, c'est relies on `unread_count` on messages
      const { error } = await (supabase
        .from("email_messages") as any)
        .update({ is_read: true })
        .in("thread_id", threadIds)
        .eq("direction", "received")
        .eq("is_read", false);

      if (error) throw error;
      setThreads(prev => prev.map(t => threadIds.includes(t.id) ? { ...t, unread_count: 0 } : t));
      toast({ title: `${threadIds.length} fil(s) marqué(s) comme lu(s)` });
    } catch (err: any) {
      toast({ title: "Erreur", description: "Impossible de marquer comme lu.", variant: "destructive" });
    }
  }, [toast]);

  // ── Mettre en favori ───────────────────────────────────────────────────────

  const toggleStar = useCallback(async (threadId: string, current: boolean) => {
    await (supabase
      .from("email_threads") as any)
      .update({ is_starred: !current })
      .eq("id", threadId);

    setThreads(prev => prev.map(t =>
      t.id === threadId ? { ...t, is_starred: !current } : t
    ));
  }, []);
  
  // ── Synchronisation manuelle ───────────────────────────────────────────────

  const syncNow = useCallback(async (days: number = 30) => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch("/api/email/sync-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, days }),
      });

      if (response.status === 202) {
        toast({ 
          title: "Sycnhronisation lancée", 
          description: "La recherche des nouveaux emails a commencé en arrière-plan. Vos messages apparaîtront dès qu'ils seront trouvés." 
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la synchronisation");
      }
    } catch (err: any) {
      toast({ 
        title: "Erreur", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
      // On rafraîchit quand même la liste au cas où certains messages seraient déjà là
      fetchThreads();
    }
  }, [user, toast, fetchThreads]);

  // ── Supabase Realtime ──────────────────────────────────────────────────────
  // Écoute les nouveaux messages reçus par le poller IMAP

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "email_messages",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as InboxMessage;

          // Ajoute le message si le fil est ouvert
          if (selectedThread?.id === newMsg.thread_id) {
            setMessages(prev => [...prev, newMsg]);
          }

          // Rafraîchit la liste des fils
          fetchThreads();

          // Notification toast pour les messages reçus
          if (newMsg.direction === "received") {
            toast({
              title: "Nouveau message",
              description: `Un prospect a répondu à votre email`,
            });
          }
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedThread?.id, fetchThreads]);

  // ── Chargement initial ─────────────────────────────────────────────────────

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // ── Compteur global non lus ────────────────────────────────────────────────

  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);

  return {
    threads,
    messages,
    selectedThread,
    loading,
    loadingMessages,
    sending,
    generatingDraft,
    totalUnread,
    openThread,
    sendReply,
    generateAIDraft,
    dismissAIDraft,
    archiveThread,
    archiveThreads,
    markThreadsAsRead,
    toggleStar,
    fetchThreads,
    syncNow,
  };
}
