-- Add new contact fields to prospects table
ALTER TABLE public.prospects 
ADD COLUMN profile_url TEXT,
ADD COLUMN website_url TEXT,
ADD COLUMN phone TEXT,
ADD COLUMN email TEXT;

-- Update RLS policies is not needed as they apply to the whole row
