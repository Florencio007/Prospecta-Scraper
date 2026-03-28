-- Migration: add_maj_v2_fields
-- Description: Adds rich data fields for the new scraping engine (v5/Maj)

ALTER TABLE public.prospect_data 
ADD COLUMN IF NOT EXISTS about_text TEXT,
ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS email_all JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS phones_all JSONB DEFAULT '[]'::jsonb;

-- Update RLS if needed (already broad on prospect_data usually)
COMMENT ON COLUMN public.prospect_data.about_text IS 'Full "About" text extracted from Maps or Website';
COMMENT ON COLUMN public.prospect_data.services IS 'List of services/amenities found';
COMMENT ON COLUMN public.prospect_data.email_all IS 'Array of all unique emails found during deep crawl';
COMMENT ON COLUMN public.prospect_data.phones_all IS 'Array of all unique phones found during deep crawl';
