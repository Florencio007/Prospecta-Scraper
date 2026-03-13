-- Migration to add Deep Data fields to prospect_data V3.2
-- This allows persistent storage of federal contracts and AI web intelligence

ALTER TABLE public.prospect_data 
ADD COLUMN IF NOT EXISTS contract_details JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS web_intelligence JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.prospect_data.contract_details IS 'Stores Sam.gov / GovCon specific metadata';
COMMENT ON COLUMN public.prospect_data.web_intelligence IS 'Stores AI-extracted services, values, and tone analysis';
