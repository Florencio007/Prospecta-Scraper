
-- Add IMAP fields to smtp_settings
ALTER TABLE public.smtp_settings 
ADD COLUMN IF NOT EXISTS imap_host TEXT,
ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993,
ADD COLUMN IF NOT EXISTS imap_secure BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS imap_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_imap_sync TIMESTAMPTZ;

-- Refresh the view and schema cache
NOTIFY pgrst, 'reload schema';
