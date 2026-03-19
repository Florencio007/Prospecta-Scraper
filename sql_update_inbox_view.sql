-- Mise à jour de la vue inbox_threads_view pour l'intégration des campagnes
-- 1. On s'assure que la jointure se fait sur email_campaigns
-- 2. On améliore le preview pour afficher le dernier message (envoyé ou reçu)

CREATE OR REPLACE VIEW public.inbox_threads_view AS
SELECT 
    t.id,
    t.user_id,
    t.prospect_id,
    t.campaign_id,
    t.prospect_email,
    t.subject,
    t.is_archived,
    t.is_starred,
    MAX(m.received_at) as last_message_at,
    (SELECT direction FROM public.email_messages WHERE thread_id = t.id ORDER BY received_at DESC LIMIT 1) as last_direction,
    COUNT(m.id) FILTER (WHERE m.direction = 'received' AND m.is_read = false) as unread_count,
    COUNT(m.id) as message_count,
    COALESCE(pd.name, t.prospect_email) as prospect_name, -- Fallback sur l'email si le nom est manquant
    pd.company as prospect_company,
    pd.position as prospect_position,
    c.name as campaign_name,
    (SELECT body_text FROM public.email_messages WHERE thread_id = t.id ORDER BY received_at DESC LIMIT 1) as last_received_preview, -- Renommé mentalement mais gardé pour compatibilité hook
    EXISTS(SELECT 1 FROM public.email_messages WHERE thread_id = t.id AND ai_status = 'draft_ready') as has_pending_ai_draft
FROM 
    public.email_threads t
JOIN 
    public.prospects p ON t.prospect_id = p.id
LEFT JOIN 
    public.prospect_data pd ON p.id = pd.prospect_id
LEFT JOIN 
    public.email_campaigns c ON t.campaign_id = c.id
LEFT JOIN 
    public.email_messages m ON t.id = m.thread_id
GROUP BY 
    t.id, p.id, pd.id, c.id;

-- Rafraîchir le cache PostgREST
NOTIFY pgrst, 'reload schema';
