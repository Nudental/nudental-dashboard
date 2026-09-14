-- QA-only candidate PH5-AUTH-002. Production has not been changed.
-- Caller must explicitly set nudashboard.environment=qa in the isolated DB.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Profile boundary candidate requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

-- Signup metadata is caller-controlled. Administrative role assignment belongs
-- in the existing authorized profile-write flow after the auth identity exists.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  INSERT INTO public.user_profiles(id,email,full_name,role)
  VALUES(NEW.id,NEW.email,
         COALESCE(NEW.raw_user_meta_data->>'full_name',split_part(NEW.email,'@',1)),
         'staff'::public.user_role)
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_profile_access_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean := false;
  v_access_changed boolean := false;
BEGIN
  -- Auth provisioning and a service-role/SQL administrator retain their existing
  -- trusted setup path. Browser requests remain governed by existing row policies.
  IF v_actor IS NULL OR auth.role() = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id=v_actor AND role IN ('admin','super_admin')
      AND is_active=true AND is_approved=true AND status='Active'
  ) INTO v_admin;

  IF TG_OP = 'DELETE' THEN
    IF NOT v_admin THEN
      RAISE EXCEPTION 'Only an active administrator can remove a user profile'
        USING ERRCODE='42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_access_changed := NEW.role IS DISTINCT FROM 'staff'::public.user_role
      OR NEW.office_id IS NOT NULL
      OR NEW.is_active IS DISTINCT FROM true
      OR NEW.is_approved IS DISTINCT FROM false
      OR NEW.status IS DISTINCT FROM 'Pending'
      OR COALESCE(NEW.has_executive_view,false)
      OR COALESCE(NEW."dashboard:executive_overview",false);
  ELSE
    v_access_changed := ROW(NEW.role,NEW.office_id,NEW.is_active,NEW.is_approved,
                            NEW.status,NEW.has_executive_view,NEW."dashboard:executive_overview")
        IS DISTINCT FROM ROW(OLD.role,OLD.office_id,OLD.is_active,OLD.is_approved,
                            OLD.status,OLD.has_executive_view,OLD."dashboard:executive_overview");
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'A user profile cannot be rebound to another identity'
        USING ERRCODE='42501';
    END IF;
  END IF;
  IF v_access_changed AND NOT v_admin THEN
    RAISE EXCEPTION 'Only an active administrator can change profile access'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_profile_access_fields() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_guard_profile_access_fields ON public.user_profiles;
CREATE TRIGGER trg_guard_profile_access_fields
BEFORE INSERT OR UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_access_fields();
COMMIT;
