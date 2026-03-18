-- Consolidated and robust trigger to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_full_name TEXT;
  meta_avatar_url TEXT;
BEGIN
  -- Extract info from raw_user_meta_data safely
  meta_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'name', 
    ''
  );
  meta_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url', 
    NEW.raw_user_meta_data->>'picture', 
    ''
  );

  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    avatar_url,
    initials
  )
  VALUES (
    NEW.id,
    meta_full_name,
    meta_avatar_url,
    -- Simple initials extraction: first 2 characters if present
    CASE 
      WHEN meta_full_name <> '' THEN substring(meta_full_name from 1 for 2)
      ELSE COALESCE(NEW.raw_user_meta_data->>'initials', '')
    END
  );

  RETURN NEW;
END;
$$;
