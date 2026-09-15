-- PH5-AUTH-010: enforce the Huddle Approvals page's existing reviewer roles.
-- Candidate for isolated Dashboard QA only; no production policy changes.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Huddle review guard requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE FUNCTION public.dashboard_guard_huddle_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  can_review boolean;
  review_fields text[] := ARRAY['approved_by', 'approved_at', 'rejection_reason'];
BEGIN
  -- Keep the trusted fixture/import path. Existing restrictive policies still
  -- enforce active accounts and both old/new office scope for authenticated users.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid()
    AND role::text IN ('super_admin','admin','regional_manager','regional_clinical_manager'))
    INTO can_review;
  IF NOT can_review THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status IN ('approved','rejected')
         OR EXISTS(SELECT 1 FROM unnest(review_fields) AS f(name)
                   WHERE COALESCE(to_jsonb(NEW)->>f.name, '') <> '') THEN
        RAISE EXCEPTION 'Huddle review requires a reviewer role' USING ERRCODE='42501';
      END IF;
    ELSE
      IF (NEW.status IS DISTINCT FROM OLD.status AND
          (NEW.status IN ('approved','rejected') OR OLD.status IN ('approved','rejected')))
         OR EXISTS(SELECT 1 FROM unnest(review_fields) AS f(name)
                   WHERE to_jsonb(NEW)->f.name IS DISTINCT FROM to_jsonb(OLD)->f.name) THEN
        RAISE EXCEPTION 'Huddle review requires a reviewer role' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.dashboard_guard_huddle_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_dashboard_huddle_review_guard BEFORE INSERT OR UPDATE
ON public.huddles FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_huddle_review();
COMMIT;
