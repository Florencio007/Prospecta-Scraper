-- Migration: Remove Brevo references and clean up schema
-- This migration removes brevo_message_id column and related references
-- Campaign messages are now stored in email_messages table via email_threads

-- 1. Remove brevo_message_id column from campaign_recipients if it exists
ALTER TABLE IF EXISTS public.campaign_recipients 
DROP COLUMN IF EXISTS brevo_message_id;

-- 2. Update api provider check constraint if needed
-- The user_api_keys table no longer needs 'brevo' as a valid provider
-- This will be enforced by the application layer

-- 3. Verify indexes are in place for performance
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON public.email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_id ON public.email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON public.email_messages(received_at);
CREATE INDEX IF NOT EXISTS idx_email_threads_user_id ON public.email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_campaign_id ON public.email_threads(campaign_id);

-- 4. Ensure RLS policies are correct
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Re-create policies to be safe
DROP POLICY IF EXISTS "Users can manage their own threads" ON public.email_threads;
CREATE POLICY "Users can manage their own threads" 
  ON public.email_threads FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own messages" ON public.email_messages;
CREATE POLICY "Users can manage their own messages" 
  ON public.email_messages FOR ALL USING (auth.uid() = user_id);
