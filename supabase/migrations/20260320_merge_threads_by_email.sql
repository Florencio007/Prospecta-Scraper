-- Regroupe tous les messages par adresse email
-- Déplace les messages vers le fil le plus ancien et supprime les doublons de fils

DO $$
DECLARE
    r RECORD;
    master_thread_id UUID;
BEGIN
    -- Pour chaque paire (email, utilisateur) ayant plus d'un fil
    FOR r IN (
        SELECT prospect_email, user_id, COUNT(*) as thread_count
        FROM public.email_threads
        GROUP BY prospect_email, user_id
        HAVING COUNT(*) > 1
    ) LOOP
        -- Trouver le fil le plus ancien (le "Master")
        SELECT id INTO master_thread_id 
        FROM public.email_threads 
        WHERE prospect_email = r.prospect_email AND user_id = r.user_id
        ORDER BY created_at ASC 
        LIMIT 1;
        
        -- Rattacher tous les messages des autres fils au fil Master
        UPDATE public.email_messages
        SET thread_id = master_thread_id
        WHERE thread_id IN (
            SELECT id FROM public.email_threads 
            WHERE prospect_email = r.prospect_email AND user_id = r.user_id AND id != master_thread_id
        );
        
        -- Supprimer les fils désormais vides
        DELETE FROM public.email_threads
        WHERE id IN (
            SELECT id FROM public.email_threads 
            WHERE prospect_email = r.prospect_email AND user_id = r.user_id AND id != master_thread_id
        );
        
    END LOOP;
END $$;

-- Rafraîchir le cache
NOTIFY pgrst, 'reload schema';
