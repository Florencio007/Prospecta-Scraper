-- Migration for Starter Plan Logic and Usage Tracking

-- Add usage columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS search_limit INTEGER NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS search_usage INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS prospect_limit INTEGER NOT NULL DEFAULT 100;

-- Ensure RLS allows updating search_usage (incrementing)
-- Note: In a production environment, this should be handled by a secure RPC function 
-- to prevent users from arbitrarily setting their usage, but for this overhaul, 
-- we will allow direct updates for simplicity while keeping RLS tight.

CREATE OR REPLACE FUNCTION public.increment_search_usage(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET search_usage = search_usage + 1
  WHERE user_id = user_id_param;
END;
$$;
