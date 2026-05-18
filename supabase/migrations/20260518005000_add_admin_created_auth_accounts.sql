BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  profile_name text;
BEGIN
  -- Anonymous users do not have emails and do not need profiles or roles.
  IF NEW.email IS NOT NULL THEN
    profile_name := NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), '');

    INSERT INTO public.profiles (id, email, name)
    VALUES (NEW.id, NEW.email, profile_name)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        updated_at = now();

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
