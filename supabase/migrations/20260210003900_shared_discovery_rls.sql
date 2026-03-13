-- Update RLS policies to allow discovery of platform users
-- Allow authenticated users to view prospects marked as 'Platform User'
CREATE POLICY "Users can view platform prospects" 
ON public.prospects 
FOR SELECT 
USING (auth.role() = 'authenticated' AND source = 'Platform User');

-- Note: Existing "Users can view own prospects" still allows users to see their private ones.
