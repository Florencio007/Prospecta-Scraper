-- Consolidated script to restore core Prospecta tables on a new project
-- This script safely creates all necessary tables and policies for Profiles, Prospects, and Settings.

-- 1. Profiles Table (with all fields from useAuth and Settings)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  initials TEXT NOT NULL DEFAULT '',
  onboarding_completed BOOLEAN DEFAULT false,
  company_type TEXT,
  industry TEXT,
  company_size TEXT,
  target_audience TEXT,
  target_city TEXT,
  target_channel TEXT,
  value_prop TEXT,
  communication_tone TEXT,
  user_service_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- 2. SMTP Settings
CREATE TABLE IF NOT EXISTS public.smtp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  from_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own smtp settings" ON public.smtp_settings;
CREATE POLICY "Users manage their own smtp settings" ON public.smtp_settings FOR ALL USING (auth.uid() = user_id);

-- 3. Prospects & Data (Normalized)
DO $$ BEGIN
    CREATE TYPE prospect_status AS ENUM ('new', 'contacted', 'interested', 'signed', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'manual',
    status prospect_status NOT NULL DEFAULT 'new',
    score INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospect_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE UNIQUE,
    name TEXT NOT NULL,
    initials TEXT,
    position TEXT,
    company TEXT,
    email TEXT,
    phone TEXT,
    whatsapp_status TEXT DEFAULT 'unknown',
    website TEXT,
    address TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    summary TEXT,
    contract_details JSONB DEFAULT NULL,
    web_intelligence JSONB DEFAULT NULL,
    ai_intelligence JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own prospects" ON public.prospects;
CREATE POLICY "Users manage own prospects" ON public.prospects FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own prospect details" ON public.prospect_data;
CREATE POLICY "Users manage own prospect details" ON public.prospect_data FOR ALL USING (EXISTS (SELECT 1 FROM public.prospects WHERE public.prospects.id = public.prospect_data.prospect_id AND public.prospects.user_id = auth.uid()));

-- 4. Cached Enrichments (Intelligence lookup)
CREATE TABLE IF NOT EXISTS public.cached_enrichments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.cached_enrichments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to manage cached_enrichments" ON public.cached_enrichments;
CREATE POLICY "Allow all authenticated users to manage cached_enrichments" ON public.cached_enrichments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. User API Keys
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider VARCHAR(50) NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own api keys" ON public.user_api_keys;
CREATE POLICY "Users manage their own api keys" ON public.user_api_keys FOR ALL USING (auth.uid() = user_id);

-- 6. Trigger for auto-profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, initials)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'initials', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Reload everything
NOTIFY pgrst, 'reload schema';
