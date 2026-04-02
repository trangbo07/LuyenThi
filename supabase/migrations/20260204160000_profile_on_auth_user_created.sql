-- Auto-create profile when a new auth.users row is inserted (no client session / RLS needed).
-- Name from raw_user_meta_data.full_name (signUp); if empty, use the part before @ in email.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  IF v_name IS NULL AND NEW.email IS NOT NULL THEN
    v_name := split_part(NEW.email, '@', 1);
  END IF;
  IF v_name IS NULL OR v_name = '' THEN
    v_name := 'User';
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, v_name, 'user')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Some Postgres versions use EXECUTE PROCEDURE vs EXECUTE FUNCTION — adjust if needed.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
