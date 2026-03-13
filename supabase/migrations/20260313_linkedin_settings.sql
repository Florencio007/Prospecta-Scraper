-- Create a table to store per-user LinkedIn credentials for scraping
CREATE TABLE IF NOT EXISTS public.linkedin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT linkedin_settings_user_id_key UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.linkedin_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own linkedin settings"
  ON public.linkedin_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own linkedin settings"
  ON public.linkedin_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own linkedin settings"
  ON public.linkedin_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own linkedin settings"
  ON public.linkedin_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER handle_linkedin_settings_updated_at
  BEFORE UPDATE ON public.linkedin_settings
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
