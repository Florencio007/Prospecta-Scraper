-- Migration to add onboarding fields to public.profiles

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS company_type TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS company_size TEXT,
ADD COLUMN IF NOT EXISTS target_audience TEXT, -- B2B/B2C
ADD COLUMN IF NOT EXISTS target_city TEXT,
ADD COLUMN IF NOT EXISTS target_channel TEXT,
ADD COLUMN IF NOT EXISTS value_prop TEXT,
ADD COLUMN IF NOT EXISTS communication_tone TEXT;

-- Update RLS if necessary (it should already allow update by owner)
-- The existing update policy is: 
-- CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
