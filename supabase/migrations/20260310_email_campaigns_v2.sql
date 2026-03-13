-- Table des campagnes email
CREATE TABLE public.email_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',        -- draft | active | paused | completed | failed
  from_name VARCHAR(100) NOT NULL,
  from_email VARCHAR(200) NOT NULL,
  reply_to VARCHAR(200),
  subject VARCHAR(500) NOT NULL,
  body_html TEXT,
  body_text TEXT,
  tags TEXT[] DEFAULT '{}',
  daily_limit INTEGER DEFAULT 200 CHECK (daily_limit <= 200),
  throttle_min_seconds INTEGER DEFAULT 3,
  throttle_max_seconds INTEGER DEFAULT 7,
  schedule_time TIME DEFAULT '08:00',
  enable_warmup BOOLEAN DEFAULT true,
  warmup_current_day INTEGER DEFAULT 1,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  sent_today INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  daily_reset_at TIMESTAMPTZ DEFAULT NOW(),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own campaigns"
  ON public.email_campaigns FOR ALL USING (auth.uid() = user_id);

-- Table des destinataires de campagne
CREATE TABLE public.campaign_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  email VARCHAR(200) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company VARCHAR(200),
  city VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',      -- pending | sent | opened | clicked | bounced | unsubscribed
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounce_reason TEXT,
  brevo_message_id VARCHAR(200),             -- ID de tracking Brevo
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own recipients"
  ON public.campaign_recipients FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id, status);
CREATE INDEX idx_campaign_recipients_email ON public.campaign_recipients(email);
