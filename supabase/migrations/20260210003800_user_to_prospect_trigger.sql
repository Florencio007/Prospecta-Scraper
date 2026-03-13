-- Update handle_new_user function to also create a prospect
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initial_name TEXT;
  initial_initials TEXT;
BEGIN
  initial_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  initial_initials := COALESCE(NEW.raw_user_meta_data->>'initials', SUBSTRING(initial_name FROM 1 FOR 2));

  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, initials)
  VALUES (NEW.id, initial_name, initial_initials);

  -- Create prospect (Self or system-wide)
  -- For now, we assign it to the user themselves, but mark it as "Platform User" 
  -- In a real admin scenario, we would assign this to an admin_id
  INSERT INTO public.prospects (user_id, name, initials, source, score, email)
  VALUES (
    NEW.id, 
    initial_name, 
    initial_initials, 
    'Platform User', 
    100, 
    NEW.email
  );

  RETURN NEW;
END;
$$;
