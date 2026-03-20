-- Migration to create Inbox schema
-- Tables for email conversations

-- 1. Create email_threads table
CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  subject TEXT,
  prospect_email TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create email_messages table
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.email_threads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  direction TEXT CHECK (direction IN ('sent', 'received')) NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  ai_status TEXT DEFAULT 'none', -- none, detected, draft_ready, used, dismissed
  ai_detected_intent TEXT,
  ai_draft_body TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create a view for the inbox list (denormalized)
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
    pd.name as prospect_name,
    pd.company as prospect_company,
    pd.position as prospect_position,
    c.name as campaign_name,
    (SELECT body_text FROM public.email_messages WHERE thread_id = t.id AND direction = 'received' ORDER BY received_at DESC LIMIT 1) as last_received_preview,
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

-- 4. Enable RLS
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Users can manage their own threads" 
  ON public.email_threads FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own messages" 
  ON public.email_messages FOR ALL USING (auth.uid() = user_id);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
