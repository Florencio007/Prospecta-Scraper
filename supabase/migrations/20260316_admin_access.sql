-- 1. Create simple_audit_log if it doesn't exist
CREATE TABLE IF NOT EXISTS public.simple_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add role column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 3. Enable RLS on simple_audit_log
ALTER TABLE public.simple_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. Policies for simple_audit_log
DROP POLICY IF EXISTS "Users can view own logs" ON public.simple_audit_log;
CREATE POLICY "Users can view own logs" ON public.simple_audit_log FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can insert logs" ON public.simple_audit_log;
CREATE POLICY "Anyone can insert logs" ON public.simple_audit_log FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.simple_audit_log;
CREATE POLICY "Admins can view all audit logs" ON public.simple_audit_log 
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
);

-- 5. Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles 
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
);

-- 6. POLICY FOR OTHER TABLES (Campaigns, Prospects) to allow Admin access
DROP POLICY IF EXISTS "Admins can view all campaigns" ON public.campaigns;
CREATE POLICY "Admins can view all campaigns" ON public.campaigns 
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can view all prospects" ON public.prospects;
CREATE POLICY "Admins can view all prospects" ON public.prospects 
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
);

-- 7. SET CURRENT USER AS ADMIN (REPLACE 'your-email@example.com' with your actual email)
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';
