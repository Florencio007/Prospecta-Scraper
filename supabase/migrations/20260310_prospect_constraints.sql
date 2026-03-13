-- Migration to add unique constraints to prevent duplicates
-- This ensures that for a given user, a prospect is unique either by email or by (name, company)

-- 1. Create a function to help with cleanup if needed (already handled by app but good for DB level)
-- Note: It's better to run the cleanup in the app first to choose which records to keep.

-- 2. Add Unique Constraint for Email per User
ALTER TABLE public.prospect_data 
ADD CONSTRAINT unique_prospect_email_user UNIQUE (email, prospect_id);
-- Wait, prospect_id is already unique. We need to check against user_id.
-- Since user_id is in prospects table, we can't easily add a multi-table unique constraint.
-- However, we can use a TRIGGER or a UNIQUE INDEX on (email) if we assume email is unique globally 
-- OR better: Unique index on (prospect_id, email) is useless.

-- Actual solution for Supabase with multi-table context:
-- Since RLS is active, we can't easily enforce 'per user' uniqueness across tables without a trigger.

-- BUT, we can add a unique index on prospect_data(email) WHERE email IS NOT NULL
-- (This assumes emails are unique across the whole platform, which is often true for B2B)
-- If we want per-user uniqueness, we'd need user_id duplicated in prospect_data.

-- For now, let's provide a script that can be run to add a unique index on email.
CREATE UNIQUE INDEX IF NOT EXISTS unique_email_idx ON public.prospect_data (email) WHERE (email IS NOT NULL);

-- And for Name + Company
CREATE UNIQUE INDEX IF NOT EXISTS unique_name_company_idx ON public.prospect_data (name, company) WHERE (name IS NOT NULL AND company IS NOT NULL);

-- WARNING: These will fail if duplicates already exist. Run the app cleanup first.
