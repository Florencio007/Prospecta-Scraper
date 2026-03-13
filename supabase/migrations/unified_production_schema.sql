-- SMTP Settings
create table if not exists public.smtp_settings (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  host text not null,
  port integer not null default 587,
  username text not null,
  password text not null,
  from_email text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint smtp_settings_user_id_key unique (user_id)
);

alter table public.smtp_settings enable row level security;

drop policy if exists "Users can view their own smtp settings" on public.smtp_settings;
create policy "Users can view their own smtp settings" on public.smtp_settings for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own smtp settings" on public.smtp_settings;
create policy "Users can insert their own smtp settings" on public.smtp_settings for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own smtp settings" on public.smtp_settings;
create policy "Users can update their own smtp settings" on public.smtp_settings for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own smtp settings" on public.smtp_settings;
create policy "Users can delete their own smtp settings" on public.smtp_settings for delete using (auth.uid() = user_id);

-- Trigger updated_at
create or replace function public.handle_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists handle_smtp_settings_updated_at on public.smtp_settings;
create trigger handle_smtp_settings_updated_at before update on public.smtp_settings for each row execute procedure public.handle_updated_at();

-- Activity Log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('prospect_added', 'prospect_converted', 'campaign_created', 'campaign_sent', 'export_generated', 'email_sent', 'login')),
  entity_type TEXT CHECK (entity_type IN ('prospect', 'campaign', 'export', 'email', 'auth')),
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

drop policy if exists "Users can view own activity" on public.activity_log;
CREATE POLICY "Users can view own activity" ON public.activity_log FOR SELECT USING (auth.uid() = user_id);

drop policy if exists "Users can insert own activity" on public.activity_log;
CREATE POLICY "Users can insert own activity" ON public.activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Normalized Schema
DO $$ BEGIN
    CREATE TYPE prospect_status AS ENUM ('new', 'contacted', 'interested', 'signed', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    status prospect_status NOT NULL DEFAULT 'new',
    score INTEGER DEFAULT 0,
    tags TEXT[],
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enrichment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    raw_data JSONB NOT NULL,
    enrichment_date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    template_body TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.local_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_payments ENABLE ROW LEVEL SECURITY;

drop policy if exists "Users can manage own prospects" on public.prospects;
CREATE POLICY "Users can manage own prospects" ON public.prospects FOR ALL USING (auth.uid() = user_id);

drop policy if exists "Users can manage own prospect details" on public.prospect_data;
CREATE POLICY "Users can manage own prospect details" ON public.prospect_data FOR ALL USING (EXISTS (SELECT 1 FROM public.prospects WHERE public.prospects.id = public.prospect_data.prospect_id AND public.prospects.user_id = auth.uid()));

drop policy if exists "Users can view own enrichment results" on public.enrichment_results;
CREATE POLICY "Users can view own enrichment results" ON public.enrichment_results FOR SELECT USING (EXISTS (SELECT 1 FROM public.prospects WHERE public.prospects.id = public.enrichment_results.prospect_id AND public.prospects.user_id = auth.uid()));

drop policy if exists "Users can manage own campaigns" on public.campaigns;
CREATE POLICY "Users can manage own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id);

drop policy if exists "Users can view own payments" on public.local_payments;
CREATE POLICY "Users can view own payments" ON public.local_payments FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

drop trigger if exists update_prospects_updated_at on public.prospects;
CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
