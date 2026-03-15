-- 1. Table email_campaigns
CREATE TABLE IF NOT EXISTS public.email_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'failed')),
    from_name TEXT NOT NULL,
    from_email TEXT NOT NULL,
    reply_to TEXT,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_text TEXT,
    tags TEXT[] DEFAULT '{}',
    daily_limit INTEGER NOT NULL DEFAULT 100,
    throttle_min_seconds INTEGER NOT NULL DEFAULT 30,
    throttle_max_seconds INTEGER NOT NULL DEFAULT 120,
    schedule_time TEXT,
    enable_warmup BOOLEAN NOT NULL DEFAULT false,
    warmup_current_day INTEGER NOT NULL DEFAULT 1,
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    sent_today INTEGER NOT NULL DEFAULT 0,
    opened_count INTEGER NOT NULL DEFAULT 0,
    clicked_count INTEGER NOT NULL DEFAULT 0,
    bounced_count INTEGER NOT NULL DEFAULT 0,
    unsubscribed_count INTEGER NOT NULL DEFAULT 0,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for email_campaigns
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own campaigns
DROP POLICY IF EXISTS "Users can view their own email campaigns" ON public.email_campaigns;
CREATE POLICY "Users can view their own email campaigns" 
ON public.email_campaigns FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own campaigns
DROP POLICY IF EXISTS "Users can create their own email campaigns" ON public.email_campaigns;
CREATE POLICY "Users can create their own email campaigns" 
ON public.email_campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own campaigns
DROP POLICY IF EXISTS "Users can update their own email campaigns" ON public.email_campaigns;
CREATE POLICY "Users can update their own email campaigns" 
ON public.email_campaigns FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own campaigns
DROP POLICY IF EXISTS "Users can delete their own email campaigns" ON public.email_campaigns;
CREATE POLICY "Users can delete their own email campaigns" 
ON public.email_campaigns FOR DELETE USING (auth.uid() = user_id);


-- 2. Table campaign_recipients
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prospect_id TEXT,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'replied', 'bounced', 'failed', 'unsubscribed')),
    bounce_reason TEXT,
    brevo_message_id TEXT,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for campaign_recipients
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own recipients
DROP POLICY IF EXISTS "Users can view their own campaign recipients" ON public.campaign_recipients;
CREATE POLICY "Users can view their own campaign recipients" 
ON public.campaign_recipients FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own recipients
DROP POLICY IF EXISTS "Users can add their own campaign recipients" ON public.campaign_recipients;
CREATE POLICY "Users can add their own campaign recipients" 
ON public.campaign_recipients FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own recipients
DROP POLICY IF EXISTS "Users can update their own campaign recipients" ON public.campaign_recipients;
CREATE POLICY "Users can update their own campaign recipients" 
ON public.campaign_recipients FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own recipients
DROP POLICY IF EXISTS "Users can delete their own campaign recipients" ON public.campaign_recipients;
CREATE POLICY "Users can delete their own campaign recipients" 
ON public.campaign_recipients FOR DELETE USING (auth.uid() = user_id);


-- Try to create ai_chat_messages (AIAssistant uses this)
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their ai_chat_messages" ON public.ai_chat_messages;
CREATE POLICY "Users can manage their ai_chat_messages" 
ON public.ai_chat_messages FOR ALL USING (auth.uid() = user_id);


-- 3. Table cached_searches
CREATE TABLE IF NOT EXISTS public.cached_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cached_searches ENABLE ROW LEVEL SECURITY;
-- App-level cache, readable by all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read cached_searches" ON public.cached_searches;
CREATE POLICY "Authenticated users can read cached_searches" 
ON public.cached_searches FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can insert cached_searches" ON public.cached_searches;
CREATE POLICY "Authenticated users can insert cached_searches" 
ON public.cached_searches FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- 4. Table cached_results
CREATE TABLE IF NOT EXISTS public.cached_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_id UUID NOT NULL REFERENCES public.cached_searches(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cached_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read cached_results" ON public.cached_results;
CREATE POLICY "Authenticated users can read cached_results" 
ON public.cached_results FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can insert cached_results" ON public.cached_results;
CREATE POLICY "Authenticated users can insert cached_results" 
ON public.cached_results FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- 5. Table contact_preferences
CREATE TABLE IF NOT EXISTS public.contact_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    unsubscribe_token TEXT NOT NULL UNIQUE,
    can_contact_email BOOLEAN NOT NULL DEFAULT true,
    can_contact_sms BOOLEAN NOT NULL DEFAULT true,
    can_contact_phone BOOLEAN NOT NULL DEFAULT true,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contact_preferences ENABLE ROW LEVEL SECURITY;
-- Public can update/read via token, authenticated users can read all
DROP POLICY IF EXISTS "Authenticated users can read contact_preferences" ON public.contact_preferences;
CREATE POLICY "Authenticated users can read contact_preferences" 
ON public.contact_preferences FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Public can read contact_preferences by token" ON public.contact_preferences;
CREATE POLICY "Public can read contact_preferences by token" 
ON public.contact_preferences FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can update contact_preferences by token" ON public.contact_preferences;
CREATE POLICY "Public can update contact_preferences by token" 
ON public.contact_preferences FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert contact_preferences" ON public.contact_preferences;
CREATE POLICY "Authenticated users can insert contact_preferences" 
ON public.contact_preferences FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- 6. Table simple_audit_log
CREATE TABLE IF NOT EXISTS public.simple_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.simple_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.simple_audit_log;
CREATE POLICY "Users can insert audit logs" 
ON public.simple_audit_log FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);
DROP POLICY IF EXISTS "Users can view their audit logs" ON public.simple_audit_log;
CREATE POLICY "Users can view their audit logs" 
ON public.simple_audit_log FOR SELECT USING (auth.uid() = user_id);

-- 7. Missing Functions
CREATE OR REPLACE FUNCTION public.increment_search_usage(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET search_usage = COALESCE(search_usage, 0) + 1
  WHERE id = user_id_param AND search_usage < search_limit;
END;
$$;


