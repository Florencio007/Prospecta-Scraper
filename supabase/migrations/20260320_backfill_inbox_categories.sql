-- Backfill categories for existing messages based on sender and subject
-- 1. Social
UPDATE public.email_messages
SET category = 'social'
WHERE (
    LOWER(from_email) LIKE '%facebook%' OR 
    LOWER(from_email) LIKE '%linkedin%' OR 
    LOWER(from_email) LIKE '%twitter%' OR 
    LOWER(from_email) LIKE '%instagram%' OR 
    LOWER(from_email) LIKE '%social%' OR 
    LOWER(from_email) LIKE '%groupupdates%' OR 
    LOWER(from_email) LIKE '%facebookmail.com%' OR
    LOWER(subject) LIKE '%nouveau message sur%' OR 
    LOWER(subject) LIKE '%invitation%' OR 
    LOWER(subject) LIKE '%tagged you%'
);

-- 2. Promotions
UPDATE public.email_messages
SET category = 'promotions'
WHERE category = 'primary' AND (
    LOWER(from_email) LIKE '%newsletter%' OR 
    LOWER(from_email) LIKE '%promo%' OR 
    LOWER(from_email) LIKE '%offre%' OR 
    LOWER(from_email) LIKE '%marketing%' OR
    LOWER(from_email) LIKE '%vente%' OR 
    LOWER(from_email) LIKE '%shopping%' OR
    LOWER(subject) LIKE '%offre%' OR 
    LOWER(subject) LIKE '%remise%' OR 
    LOWER(subject) LIKE '%promotion%' OR 
    LOWER(subject) LIKE '%profitez%'
);

-- 3. Notifications
UPDATE public.email_messages
SET category = 'notifications'
WHERE category = 'primary' AND (
    LOWER(from_email) LIKE '%no-reply%' OR 
    LOWER(from_email) LIKE '%noreply%' OR 
    LOWER(from_email) LIKE '%alert%' OR 
    LOWER(from_email) LIKE '%security%' OR 
    LOWER(from_email) LIKE '%notification%' OR 
    LOWER(from_email) LIKE '%accounts.google.com%' OR 
    LOWER(from_email) LIKE '%microsoft%' OR
    LOWER(subject) LIKE '%alerte%' OR 
    LOWER(subject) LIKE '%confirmation%' OR 
    LOWER(subject) LIKE '%votre compte%' OR 
    LOWER(subject) LIKE '%code de%'
);

-- Refresh PostgREST schema cache just in case
NOTIFY pgrst, 'reload schema';
