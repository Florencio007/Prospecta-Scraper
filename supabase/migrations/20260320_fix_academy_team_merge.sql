-- Fix incorrectly merged threads that were all assigned to "Academy Team"
-- Version ultra-robuste qui évite les conflits d'index partiels (name, company)

DO $$
DECLARE
    r RECORD;
    new_prospect_id UUID;
    academy_team_id UUID := '19559cfc-a637-4bdb-974d-330761472428';
    current_user_id UUID;
    target_name TEXT;
    conflict_exists BOOLEAN;
BEGIN
    -- 1. Identifier tous les emails uniques qui sont indûment liés à Academy Team
    FOR r IN (
        SELECT DISTINCT prospect_email 
        FROM public.email_threads 
        WHERE prospect_id = academy_team_id 
        AND prospect_email != 'academy-team@semrush.com'
    ) LOOP
        -- Récapituler le user_id
        SELECT user_id INTO current_user_id FROM public.email_threads WHERE prospect_email = r.prospect_email LIMIT 1;
        
        -- A. Vérifier si un prospect existe déjà pour cet EMAIL exact
        SELECT prospect_id INTO new_prospect_id 
        FROM public.prospect_data 
        WHERE email = r.prospect_email 
        LIMIT 1;
        
        -- B. Si pas de prospect pour cet email, on en crée un
        IF new_prospect_id IS NULL THEN
            
            -- Définir le nom cible (par défaut le début de l'email)
            target_name := split_part(r.prospect_email, '@', 1);
            
            -- Vérifier manuellement le conflit d'index (name, company)
            SELECT EXISTS (
                SELECT 1 FROM public.prospect_data 
                WHERE name = target_name AND company = 'Unknown (From Inbox)'
            ) INTO conflict_exists;
            
            -- Si conflit, on rend le nom unique en ajoutant l'email
            IF conflict_exists THEN
                target_name := target_name || ' (' || r.prospect_email || ')';
            END IF;

            -- Création du prospect
            INSERT INTO public.prospects (user_id, source, status, score)
            VALUES (current_user_id, 'imap', 'new', 0)
            RETURNING id INTO new_prospect_id;
            
            -- Création des données associées
            INSERT INTO public.prospect_data (prospect_id, email, name, company)
            VALUES (new_prospect_id, r.prospect_email, target_name, 'Unknown (From Inbox)');
            
        END IF;
        
        -- C. Mettre à jour tous les fils de cet email pour pointer vers le bon prospect
        UPDATE public.email_threads
        SET prospect_id = new_prospect_id
        WHERE prospect_id = academy_team_id 
        AND prospect_email = r.prospect_email;
        
    END LOOP;
END $$;

-- Refresh cache
NOTIFY pgrst, 'reload schema';
