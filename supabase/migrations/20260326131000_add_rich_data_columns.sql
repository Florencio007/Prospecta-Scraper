-- Migration: Add rich data columns to prospect_data for Maj v2
ALTER TABLE public.prospect_data 
ADD COLUMN IF NOT EXISTS about_text TEXT,
ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS gps_lat FLOAT,
ADD COLUMN IF NOT EXISTS gps_lng FLOAT;

-- Update existing records if needed (optional)
-- COMMENT: This ensures the schema is ready for the new scraping engine outputs.
