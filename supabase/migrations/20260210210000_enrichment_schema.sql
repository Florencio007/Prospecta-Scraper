-- Migration to create prospects_enriched table for N8N workflow

CREATE TABLE IF NOT EXISTS public.prospects_enriched (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Identification
    entreprise_nom TEXT NOT NULL,
    entreprise_nom_commercial TEXT,
    entreprise_effectif INTEGER,
    entreprise_date_creation DATE,
    
    -- Localisation
    adresse_complete TEXT,
    adresse_ville TEXT,
    adresse_pays TEXT,
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    
    -- Contact
    telephone_fixe TEXT,
    email_general TEXT,
    site_web TEXT,
    
    -- Social & Web
    url_linkedin TEXT,
    url_instagram TEXT,
    url_facebook TEXT,
    
    -- Google Maps Data
    google_rating DECIMAL(3, 2),
    google_reviews_count INTEGER,
    place_id TEXT UNIQUE, -- Pour éviter les doublons
    
    -- Métadonnées Entreprise
    horaires JSONB,
    categories JSONB,
    prix_fourchette TEXT,
    dirigeants JSONB, -- Liste des dirigeants
    
    -- Tech Stack
    tech_stack JSONB,
    tech_stack_count INTEGER,
    
    -- Business Info
    ca_annuel NUMERIC,
    industrie TEXT,
    
    -- Scoring & Qualité
    taux_completude INTEGER DEFAULT 0,
    champs_remplis INTEGER DEFAULT 0,
    statut_enrichissement TEXT DEFAULT 'nouveau', -- nouveau, incomplet, partiel, complet
    score_global INTEGER DEFAULT 0,
    
    -- Méta
    source_collecte TEXT DEFAULT 'google_maps',
    erreurs_collecte JSONB DEFAULT '{}',
    tentatives_enrichissement INTEGER DEFAULT 0,
    
    -- User link (optional, if we want to link to specific users later)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    date_collecte TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour la recherche rapide
CREATE INDEX IF NOT EXISTS idx_prospects_enriched_email ON public.prospects_enriched(email_general);
CREATE INDEX IF NOT EXISTS idx_prospects_enriched_ville ON public.prospects_enriched(adresse_ville);
CREATE INDEX IF NOT EXISTS idx_prospects_enriched_statut ON public.prospects_enriched(statut_enrichissement);

-- RLS Policies
ALTER TABLE public.prospects_enriched ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all prospects (or restrict to their own if user_id is used)
CREATE POLICY "Users can view prospects"
    ON public.prospects_enriched
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users (or service roles) to insert/update
CREATE POLICY "Service role can manage prospects"
    ON public.prospects_enriched
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
    
-- Allow authenticated users to insert (e.g. from frontend triggering workflow)
CREATE POLICY "Users can insert prospects"
    ON public.prospects_enriched
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
