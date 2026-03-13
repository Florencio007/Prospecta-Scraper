-- Fix campaigns table schema to match frontend requirements
-- Drop channel constraint if it exists (make it nullable)
ALTER TABLE IF EXISTS public.campaigns ALTER COLUMN channel DROP NOT NULL;

-- Add missing columns
ALTER TABLE IF EXISTS public.campaigns 
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS contacts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;

-- Ensure RLS is enabled
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Re-apply RLS policies just in case
DROP POLICY IF EXISTS "Users can manage own campaigns" ON public.campaigns;
CREATE POLICY "Users can manage own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id);
