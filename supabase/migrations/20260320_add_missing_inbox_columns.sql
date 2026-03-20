
-- Migration to add missing columns for IMAP syncing
-- Added on 2026-03-20

ALTER TABLE public.email_messages 
ADD COLUMN IF NOT EXISTS message_id_header TEXT,
ADD COLUMN IF NOT EXISTS references_header TEXT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
