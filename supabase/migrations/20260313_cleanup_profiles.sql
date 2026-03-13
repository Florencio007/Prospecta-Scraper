-- Clean up duplicate profiles, enforce uniqueness and add missing columns
-- This script keeps only the most recent profile for each user_id and adds plan/limit fields

-- 1. Add missing columns first to avoid data loss during cleanup if they were somehow partially there
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS search_limit INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS search_usage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS prospect_limit INTEGER DEFAULT 100;

-- 2. Identify and delete duplicates
DELETE FROM public.profiles p1
USING public.profiles p2
WHERE p1.user_id = p2.user_id 
  AND p1.created_at < p2.created_at;

-- 3. Add unique constraint if not exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

-- 4. Ensure RLS policies are correct
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
