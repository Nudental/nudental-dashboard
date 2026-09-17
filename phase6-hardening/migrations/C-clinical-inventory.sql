-- Phase 6 schema-only candidate, subject to QA and per-group release.
BEGIN;
SET LOCAL lock_timeout='5s';
-- Reviewed source repair 012-implant-office-boundary.sql
DROP POLICY IF EXISTS dashboard_implant_inventory_active_office_boundary ON public.implant_inventory;
CREATE POLICY dashboard_implant_inventory_active_office_boundary
ON public.implant_inventory AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id))
WITH CHECK (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));

DROP POLICY IF EXISTS dashboard_implant_usage_active_office_boundary ON public.implant_usage_logs;
CREATE POLICY dashboard_implant_usage_active_office_boundary
ON public.implant_usage_logs AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id))
WITH CHECK (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));

-- The recovered AFTER INSERT trigger deducts stock as its owner. The usage row's
-- office alone cannot authorize that related write. Check the linked inventory
-- office as well; authorized multi-office users retain their existing access.
CREATE OR REPLACE FUNCTION public.dashboard_guard_implant_usage_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR NEW.implant_inventory_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT public.dashboard_has_active_profile() OR NOT EXISTS(
    SELECT 1 FROM public.implant_inventory i WHERE i.id=NEW.implant_inventory_id
      AND public.user_can_access_office(i.office_id)
  ) THEN
    RAISE EXCEPTION 'Linked inventory office access denied' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.dashboard_guard_implant_usage_stock() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_dashboard_implant_usage_stock_guard ON public.implant_usage_logs;
CREATE TRIGGER trg_dashboard_implant_usage_stock_guard BEFORE INSERT OR UPDATE
ON public.implant_usage_logs FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_implant_usage_stock();

-- Reviewed source repair 015-implant-lookup-audit.sql
DROP TRIGGER IF EXISTS trg_audit_implant_companies ON public.implant_companies;
CREATE TRIGGER trg_audit_implant_companies
AFTER INSERT OR UPDATE OR DELETE ON public.implant_companies
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
DROP TRIGGER IF EXISTS trg_audit_implant_systems ON public.implant_systems;
CREATE TRIGGER trg_audit_implant_systems
AFTER INSERT OR UPDATE OR DELETE ON public.implant_systems
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
DROP TRIGGER IF EXISTS trg_audit_implant_platform_sizes ON public.implant_platform_sizes;
CREATE TRIGGER trg_audit_implant_platform_sizes
AFTER INSERT OR UPDATE OR DELETE ON public.implant_platform_sizes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
DROP TRIGGER IF EXISTS trg_audit_implant_lengths ON public.implant_lengths;
CREATE TRIGGER trg_audit_implant_lengths
AFTER INSERT OR UPDATE OR DELETE ON public.implant_lengths
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
DROP TRIGGER IF EXISTS trg_audit_implant_diameters ON public.implant_diameters;
CREATE TRIGGER trg_audit_implant_diameters
AFTER INSERT OR UPDATE OR DELETE ON public.implant_diameters
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- Reviewed source repair 017-implant-delete-audit.sql
DROP TRIGGER IF EXISTS trg_audit_implant_inventory_delete ON public.implant_inventory;
CREATE TRIGGER trg_audit_implant_inventory_delete
AFTER DELETE ON public.implant_inventory
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- Reviewed source repair 021-bone-inventory-access-boundary.sql
-- and making audit visibility follow the inventory record's office/role scope.
DROP POLICY IF EXISTS dashboard_bone_inventory_active_boundary ON public.bone_tissue_inventory;
CREATE POLICY dashboard_bone_inventory_active_boundary
ON public.bone_tissue_inventory AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile());

DROP POLICY IF EXISTS dashboard_bone_audit_parent_boundary ON public.bone_tissue_audit_log;
CREATE POLICY dashboard_bone_audit_parent_boundary
ON public.bone_tissue_audit_log AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.bone_tissue_inventory i
  WHERE i.id=bone_tissue_audit_log.record_id
));

-- Reviewed source repair 022-bone-role-active-profile.sql
-- unapproved identities for stock and other tables using that same helper.
CREATE OR REPLACE FUNCTION public.bti_get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT role::text FROM public.user_profiles
  WHERE id=auth.uid() AND public.dashboard_has_active_profile()
  LIMIT 1;
$function$;

-- Reviewed source repair 023-bone-delete-audit-history.sql
-- Keep its historical record ID and existing audits instead of enforcing a
-- live-parent foreign key whose cascade conflicts with that audit trigger.
ALTER TABLE public.bone_tissue_audit_log
  DROP CONSTRAINT IF EXISTS bone_tissue_audit_log_record_id_fkey;

-- Historical audit visibility follows the saved office and existing module roles.
DROP POLICY IF EXISTS dashboard_bone_audit_parent_boundary ON public.bone_tissue_audit_log;
CREATE POLICY dashboard_bone_audit_parent_boundary ON public.bone_tissue_audit_log AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile() AND (
 EXISTS(SELECT 1 FROM public.bone_tissue_inventory i WHERE i.id=bone_tissue_audit_log.record_id)
 OR (NOT EXISTS(SELECT 1 FROM public.bone_tissue_inventory i WHERE i.id=bone_tissue_audit_log.record_id)
   AND (public.bti_get_user_role()='super_admin'
     OR (public.bti_get_user_role() IN ('admin','staff','office_manager')
       AND (coalesce(new_values->>'office_id',old_values->>'office_id') IS NULL
         OR coalesce(new_values->>'office_id',old_values->>'office_id')::uuid=ANY(public.bti_user_office_ids())))))
));

-- Preserve the audit writer; authenticated actions record the actual actor.
CREATE OR REPLACE FUNCTION public.bti_audit_trigger_fn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_action TEXT;
  v_changed_by UUID;
  v_changed_by_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_changed_by := coalesce(auth.uid(),NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_changed_by := coalesce(auth.uid(),NEW.updated_by);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_changed_by := coalesce(auth.uid(),OLD.created_by);
  END IF;

  SELECT COALESCE(full_name, '') INTO v_changed_by_name
  FROM public.user_profiles
  WHERE id = v_changed_by
  LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.bone_tissue_audit_log (record_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (OLD.id, v_action, v_changed_by, COALESCE(v_changed_by_name, ''), to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.bone_tissue_audit_log (record_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (NEW.id, v_action, v_changed_by, COALESCE(v_changed_by_name, ''), NULL, to_jsonb(NEW));
  ELSE
    INSERT INTO public.bone_tissue_audit_log (record_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (NEW.id, v_action, v_changed_by, COALESCE(v_changed_by_name, ''), to_jsonb(OLD), to_jsonb(NEW));
  END IF;

  RETURN NEW;
END;
$function$
;

COMMIT;
