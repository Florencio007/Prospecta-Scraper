-- ==========================================
-- COMBO MIGRATION: CATEGORIES + BACKFILL
-- ==========================================

-- 1. Ajouter la colonne si elle n'existe pas
ALTER TABLE public.email_messages 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'primary';

-- 2. Mettre à jour la vue pour inclure la catégorie
DROP VIEW IF EXISTS public.inbox_threads_view;

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
    COALESCE(MAX(m.received_at), t.created_at) as last_message_at,
    (SELECT direction FROM public.email_messages WHERE thread_id = t.id ORDER BY received_at DESC LIMIT 1) as last_direction,
    (SELECT category FROM public.email_messages WHERE thread_id = t.id AND direction = 'received' ORDER BY received_at DESC LIMIT 1) as category,
    COUNT(m.id) FILTER (WHERE m.direction = 'received' AND m.is_read = false) as unread_count,
    COUNT(m.id) as message_count,
    COALESCE(pd.name, t.prospect_email) as prospect_name,
    pd.company as prospect_company,
    pd.position as prospect_position,
    c.name as campaign_name,
    (SELECT body_text FROM public.email_messages WHERE thread_id = t.id ORDER BY received_at DESC LIMIT 1) as last_received_preview,
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

-- 3. Remplissage (Backfill) des catégories pour les messages existants

-- Social
UPDATE public.email_messages
SET category = 'social'
WHERE (
    LOWER(from_email) LIKE '%facebook%' OR 
    LOWER(from_email) LIKE '%linkedin%' OR 
    LOWER(from_email) LIKE '%twitter%' OR 
    LOWER(from_email) LIKE '%instagram%' OR 
    LOWER(from_email) LIKE '%social%' OR 
    LOWER(from_email) LIKE '%groupupdates%' OR 
    LOWER(from_email) LIKE '%facebookmail.com%' OR
    LOWER(subject) LIKE '%nouveau message sur%' OR 
    LOWER(subject) LIKE '%invitation%' OR 
    LOWER(subject) LIKE '%tagged you%'
);

-- Promotions
UPDATE public.email_messages
SET category = 'promotions'
WHERE category = 'primary' AND (
    LOWER(from_email) LIKE '%newsletter%' OR 
    LOWER(from_email) LIKE '%promo%' OR 
    LOWER(from_email) LIKE '%offre%' OR 
    LOWER(from_email) LIKE '%marketing%' OR
    LOWER(from_email) LIKE '%vente%' OR 
    LOWER(from_email) LIKE '%shopping%' OR
    LOWER(subject) LIKE '%offre%' OR 
    LOWER(subject) LIKE '%remise%' OR 
    LOWER(subject) LIKE '%promotion%' OR 
    LOWER(subject) LIKE '%profitez%'
);

-- Notifications
UPDATE public.email_messages
SET category = 'notifications'
WHERE category = 'primary' AND (
    LOWER(from_email) LIKE '%no-reply%' OR 
    LOWER(from_email) LIKE '%noreply%' OR 
    LOWER(from_email) LIKE '%alert%' OR 
    LOWER(from_email) LIKE '%security%' OR 
    LOWER(from_email) LIKE '%notification%' OR 
    LOWER(from_email) LIKE '%accounts.google.com%' OR 
    LOWER(from_email) LIKE '%microsoft%' OR
    LOWER(subject) LIKE '%alerte%' OR 
    LOWER(subject) LIKE '%confirmation%' OR 
    LOWER(subject) LIKE '%votre compte%' OR 
    LOWER(subject) LIKE '%code de%'
);

-- Rafraîchir
NOTIFY pgrst, 'reload schema';
