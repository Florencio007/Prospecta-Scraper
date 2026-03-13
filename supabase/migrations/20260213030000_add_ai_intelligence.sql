-- Migration to add AI Intelligence column to prospect_data
-- This column will store the structured JSON from the deep crawler

ALTER TABLE public.prospect_data 
ADD COLUMN IF NOT EXISTS ai_intelligence JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.prospect_data.ai_intelligence IS 'Stores structured AI crawler results (contact_info, key_people, opportunities, etc.)';
