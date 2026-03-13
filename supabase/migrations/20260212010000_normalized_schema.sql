-- Migration to implement the Normalized Schema (V3.2)
-- This migration refines the prospect management, enrichment, and adds support for campaigns and local payments.

-- 1. Create enum for prospect status
DO $$ BEGIN
    CREATE TYPE prospect_status AS ENUM ('new', 'contacted', 'interested', 'signed', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Rename old table if it exists
ALTER TABLE IF EXISTS public.prospects RENAME TO prospects_old;

-- 3. Create NEW prospects table (Metadata & Status)
CREATE TABLE public.prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'linkedin', 'google', 'facebook', 'website'
    status prospect_status NOT NULL DEFAULT 'new',
    score INTEGER DEFAULT 0,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Create prospect_data table (Details)
CREATE TABLE public.prospect_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE UNIQUE,
    name TEXT NOT NULL,
    initials TEXT,
    position TEXT,
    company TEXT,
    email TEXT,
    phone TEXT, -- Priority for WhatsApp detection
    whatsapp_status TEXT DEFAULT 'unknown', -- 'valid', 'invalid', 'unknown'
    website TEXT,
    address TEXT,
    social_links JSONB DEFAULT '{}'::jsonb, -- Store LinkedIn, FB, IG URLs
    summary TEXT, -- Extracted essence from deep scraping
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Create enrichment_results table (Cache for API costs)
CREATE TABLE public.enrichment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'hunter', 'clearbit', 'scrapingbee', 'apify'
    raw_data JSONB NOT NULL,
    enrichment_date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Create campaigns table
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel TEXT NOT NULL, -- 'whatsapp', 'facebook', 'email', 'linkedin'
    template_body TEXT,
    status TEXT DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Create local_payments table
CREATE TABLE IF NOT EXISTS public.local_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'mvola', 'orange_money', 'airtel_money'
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT UNIQUE, -- Payment reference from provider
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Enable RLS
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_payments ENABLE ROW LEVEL SECURITY;

-- 9. Policies
-- prospects
CREATE POLICY "Users can manage own prospects" ON public.prospects 
    FOR ALL USING (auth.uid() = user_id);

-- prospect_data (Inherited via prospect relationship)
CREATE POLICY "Users can manage own prospect details" ON public.prospect_data
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.prospects 
            WHERE public.prospects.id = public.prospect_data.prospect_id 
            AND public.prospects.user_id = auth.uid()
        )
    );

-- enrichment_results
CREATE POLICY "Users can view own enrichment results" ON public.enrichment_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.prospects 
            WHERE public.prospects.id = public.enrichment_results.prospect_id 
            AND public.prospects.user_id = auth.uid()
        )
    );

-- campaigns
CREATE POLICY "Users can manage own campaigns" ON public.campaigns
    FOR ALL USING (auth.uid() = user_id);

-- local_payments
CREATE POLICY "Users can view own payments" ON public.local_payments
    FOR SELECT USING (auth.uid() = user_id);

-- 10. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prospects_updated_at
    BEFORE UPDATE ON public.prospects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
