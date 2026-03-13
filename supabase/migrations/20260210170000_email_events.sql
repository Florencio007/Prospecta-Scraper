-- Migration to create email_events table for tracking email campaign performance

CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_prospect ON public.email_events(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_events_user ON public.email_events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON public.email_events(event_type);

-- Enable RLS
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own email events"
  ON public.email_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email events"
  ON public.email_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies - events are immutable for audit trail
