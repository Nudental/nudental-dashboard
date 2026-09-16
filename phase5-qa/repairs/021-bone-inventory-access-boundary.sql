-- PH5-AUTH-014: retain existing Bone/Tissue grants while enforcing account state
-- and making audit visibility follow the inventory record's office/role scope.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Bone inventory boundary requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

CREATE POLICY dashboard_bone_inventory_active_boundary
ON public.bone_tissue_inventory AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile());

CREATE POLICY dashboard_bone_audit_parent_boundary
ON public.bone_tissue_audit_log AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.bone_tissue_inventory i
  WHERE i.id=bone_tissue_audit_log.record_id
));
COMMIT;
