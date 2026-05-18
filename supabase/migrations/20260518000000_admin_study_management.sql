BEGIN;

ALTER TABLE public.study_versions
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS supersedes_version_id uuid REFERENCES public.study_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_note text;

CREATE TABLE IF NOT EXISTS public.admin_role_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL CHECK (action IN ('grant_admin', 'revoke_admin')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_role_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view role events" ON public.admin_role_events;
CREATE POLICY "Admins view role events"
  ON public.admin_role_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins insert role events" ON public.admin_role_events;
CREATE POLICY "Admins insert role events"
  ON public.admin_role_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins grant roles" ON public.user_roles;
CREATE POLICY "Admins grant roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins revoke roles" ON public.user_roles;
CREATE POLICY "Admins revoke roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin'::public.app_role THEN
    IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin'::public.app_role) <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the final admin role';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_admin_delete ON public.user_roles;
CREATE TRIGGER prevent_last_admin_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_admin_removal();

CREATE OR REPLACE FUNCTION public.prevent_published_study_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_published THEN
    IF NEW.config IS DISTINCT FROM OLD.config
      OR NEW.study_id IS DISTINCT FROM OLD.study_id
      OR NEW.version_number IS DISTINCT FROM OLD.version_number
      OR NEW.is_published IS DISTINCT FROM OLD.is_published THEN
      RAISE EXCEPTION 'Published study versions are immutable; create a new draft version instead';
    END IF;
  END IF;

  IF NOT OLD.is_published AND NEW.is_published AND NEW.published_at IS NULL THEN
    NEW.published_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_published_study_version_mutation ON public.study_versions;
CREATE TRIGGER prevent_published_study_version_mutation
  BEFORE UPDATE ON public.study_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_published_study_version_mutation();

COMMIT;
