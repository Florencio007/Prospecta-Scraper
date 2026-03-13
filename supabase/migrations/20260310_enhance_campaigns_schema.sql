-- Migration to add premium metrics and configuration to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS opened_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicked_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bounced_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unsubscribed_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS sent_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS warmup_day INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS from_name TEXT,
ADD COLUMN IF NOT EXISTS from_email TEXT,
ADD COLUMN IF NOT EXISTS subject TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS schedule TEXT,
ADD COLUMN IF NOT EXISTS throttle_min INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS throttle_max INTEGER DEFAULT 7;

-- Comment on columns for clarity
COMMENT ON COLUMN public.campaigns.sent_count IS 'Total number of emails sent for this campaign';
COMMENT ON COLUMN public.campaigns.opened_count IS 'Total number of times emails were opened';
COMMENT ON COLUMN public.campaigns.clicked_count IS 'Total number of times links in emails were clicked';
COMMENT ON COLUMN public.campaigns.bounced_count IS 'Total number of emails that bounced';
COMMENT ON COLUMN public.campaigns.unsubscribed_count IS 'Total number of recipients who unsubscribed';
COMMENT ON COLUMN public.campaigns.daily_limit IS 'Maximum number of emails to send per day (max 200)';
COMMENT ON COLUMN public.campaigns.sent_today IS 'Number of emails sent today';
COMMENT ON COLUMN public.campaigns.spam_score IS 'Calculated anti-spam score for the campaign content';
COMMENT ON COLUMN public.campaigns.warmup_day IS 'Current day in the 7-day warmup cycle';
COMMENT ON COLUMN public.campaigns.throttle_min IS 'Minimum delay between email sends in seconds';
COMMENT ON COLUMN public.campaigns.throttle_max IS 'Maximum delay between email sends in seconds';
