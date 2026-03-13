-- Add user_service_description field to profiles table for AI email generation
-- This field stores the description of the service the user offers to their clients

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_service_description TEXT;

COMMENT ON COLUMN public.profiles.user_service_description IS 'Description of the service the user offers to their clients, used for AI email generation';
