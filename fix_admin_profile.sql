-- Script CORRECTIF pour forcer la création du profil Admin
-- À exécuter dans l'éditeur SQL de Supabase

INSERT INTO public.profiles (
  user_id, 
  email, 
  role, 
  onboarding_completed, 
  plan_type, 
  search_limit, 
  search_usage, 
  prospect_limit
)
VALUES (
  '7631b6b0-e6fd-4259-9033-7dd44852cd94', 
  'yurihandria@gmail.com', 
  'admin', 
  true, 
  'premium', 
  1000, 
  0, 
  1000
)
ON CONFLICT (user_id) DO UPDATE 
SET role = 'admin', email = 'yurihandria@gmail.com';

-- Vérification immédiate
SELECT * FROM public.profiles WHERE user_id = '7631b6b0-e6fd-4259-9033-7dd44852cd94';
