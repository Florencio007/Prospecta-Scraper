-- Script pour promouvoir un utilisateur au rang d'administrateur dans Prospecta
-- À exécuter dans l'éditeur SQL de votre console Supabase

UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'yurihandria@gmail.com';

-- Pour vérifier que la modification a bien été prise en compte :
-- SELECT email, full_name, role FROM public.profiles WHERE email = 'yurihandria@gmail.com';
