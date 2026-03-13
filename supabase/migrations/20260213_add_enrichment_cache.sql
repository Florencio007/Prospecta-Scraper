-- Add cached_enrichments table to store AI results by domain
CREATE TABLE IF NOT EXISTS public.cached_enrichments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cached_enrichments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write for now (adjust as needed for multi-tenant)
CREATE POLICY "Allow all authenticated users to manage cached_enrichments"
ON public.cached_enrichments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add index on domain for fast lookup
CREATE INDEX IF NOT EXISTS idx_cached_enrichments_domain ON public.cached_enrichments(domain);
