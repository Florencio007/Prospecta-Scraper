-- Migration to add business_activity field to public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS business_activity TEXT;
