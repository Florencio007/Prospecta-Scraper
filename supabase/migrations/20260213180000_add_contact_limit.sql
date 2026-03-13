-- Add contact_limit to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS contact_limit INTEGER DEFAULT 100;

-- Update existing campaigns to have a default limit if null
UPDATE public.campaigns SET contact_limit = 100 WHERE contact_limit IS NULL;
