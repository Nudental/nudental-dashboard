-- All records are synthetic and the caller always rolls back.
INSERT INTO ph6_probe_ids VALUES ('implant_a',gen_random_uuid()),('implant_b',gen_random_uuid()),('bone',gen_random_uuid());
INSERT INTO public.implant_inventory(id,office_id,quantity_in_stock,item_status,notes)
SELECT i.id,o.id,5,'in_stock','PH6 TEMP isolated inventory' FROM ph6_probe_ids i JOIN ph6_probe_ids o ON o.kind=CASE WHEN i.kind='implant_a' THEN 'office' ELSE 'other_office' END WHERE i.kind IN ('implant_a','implant_b');
INSERT INTO public.bone_tissue_inventory(id,office_id,patient_name,procedure_date,product_name,identification_number,created_by,updated_by)
SELECT (SELECT id FROM ph6_probe_ids WHERE kind='bone'),(SELECT id FROM ph6_probe_ids WHERE kind='office'),'PH6 SYNTHETIC NOT A PATIENT','2099-01-05','PH6 TEMP material','PH6 TEMP identifier',(SELECT id FROM ph6_probe_ids WHERE kind='staff'),(SELECT id FROM ph6_probe_ids WHERE kind='staff');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='staff'),true),set_config('request.jwt.claim.role','authenticated',true);
INSERT INTO ph6_probe_results SELECT 'implant reads are scoped',count(*)=1 FROM public.implant_inventory WHERE id IN (SELECT id FROM ph6_probe_ids WHERE kind IN ('implant_a','implant_b'));
DO $test$ BEGIN
 BEGIN
  INSERT INTO public.implant_usage_logs(office_id,implant_inventory_id,procedure_notes,item_status,created_by) SELECT (SELECT id FROM ph6_probe_ids WHERE kind='office'),(SELECT id FROM ph6_probe_ids WHERE kind='implant_b'),'PH6 TEMP forbidden','used',auth.uid();
  RAISE EXCEPTION 'Cross-office linked stock accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('cross-office linked stock denied',true); END;
END $test$;
INSERT INTO public.implant_usage_logs(office_id,implant_inventory_id,procedure_notes,item_status,created_by) SELECT (SELECT id FROM ph6_probe_ids WHERE kind='office'),(SELECT id FROM ph6_probe_ids WHERE kind='implant_a'),'PH6 TEMP isolated usage','used',auth.uid();
INSERT INTO ph6_probe_results SELECT 'existing single stock deduction preserved',quantity_in_stock=4 FROM public.implant_inventory WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='implant_a');
WITH removed AS (DELETE FROM public.bone_tissue_inventory WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='bone') RETURNING id)
INSERT INTO ph6_probe_results SELECT 'ordinary staff cannot delete clinical record',count(*)=0 FROM removed;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='super_admin'),true);
DELETE FROM public.bone_tissue_inventory WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='bone');
INSERT INTO ph6_probe_results SELECT 'bone delete audit uses actor not original creator',count(*)=1 FROM public.bone_tissue_audit_log WHERE record_id=(SELECT id FROM ph6_probe_ids WHERE kind='bone') AND action='deleted' AND changed_by=auth.uid() AND old_values->>'patient_name'='PH6 SYNTHETIC NOT A PATIENT';
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='staff'),true);
INSERT INTO ph6_probe_results SELECT 'same-office historical audit remains readable',count(*)=2 FROM public.bone_tissue_audit_log WHERE record_id=(SELECT id FROM ph6_probe_ids WHERE kind='bone');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','',true);
UPDATE public.user_profiles SET is_active=false WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='staff');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='staff'),true),set_config('request.jwt.claim.role','authenticated',true);
INSERT INTO ph6_probe_results SELECT 'inactive clinical history access denied',count(*)=0 FROM public.bone_tissue_audit_log WHERE record_id=(SELECT id FROM ph6_probe_ids WHERE kind='bone');
INSERT INTO ph6_probe_results SELECT 'inactive implant access denied',count(*)=0 FROM public.implant_inventory WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='implant_a');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','',true);
INSERT INTO ph6_probe_results SELECT 'other-office stock unchanged',quantity_in_stock=5 FROM public.implant_inventory WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='implant_b');
SELECT check_name,pass FROM ph6_probe_results ORDER BY check_name;
