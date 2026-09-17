-- Existing QA office names satisfy QA schema checks; no production rows copied.
INSERT INTO ph6_probe_ids VALUES ('regional_manager',gen_random_uuid()),('request',gen_random_uuid()),('admin_own',gen_random_uuid()),('super_own',gen_random_uuid()),('receipt',gen_random_uuid());
INSERT INTO auth.users(id,email,raw_user_meta_data) SELECT id,'ph6-'||id||'@example.test','{}'::jsonb FROM ph6_probe_ids WHERE kind='regional_manager';
UPDATE public.user_profiles SET role='regional_manager',office_id=(SELECT id FROM ph6_probe_ids WHERE kind='office'),is_active=true,is_approved=true,status='Active' WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='regional_manager');
INSERT INTO public.supply_request_batches(id,office_id,request_month,department_category,requested_by,batch_status)
SELECT i.id,(SELECT name FROM public.offices WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='office')),CASE WHEN i.kind='admin_own' THEN '2099-01-01'::date ELSE '2099-03-01'::date END,'Front Desk',(SELECT id FROM ph6_probe_ids WHERE kind=CASE i.kind WHEN 'admin_own' THEN 'admin' ELSE 'super_admin' END),'submitted' FROM ph6_probe_ids i WHERE i.kind IN ('admin_own','super_own');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='office_manager'),true),set_config('request.jwt.claim.role','authenticated',true);
UPDATE ph6_probe_ids SET id=(public.save_supply_request_draft(jsonb_build_object('office_id',(SELECT name FROM public.offices WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='office')),'request_month','2099-02-01','department_category','Front Desk'), '[{"custom_item_name":"PH6 TEMP harmless supply","requested_qty":1}]'::jsonb)->>'id')::uuid WHERE kind='request';
INSERT INTO ph6_probe_results SELECT 'Office Manager draft and item persist',count(*)=1 FROM public.supply_request_items WHERE batch_id=(SELECT id FROM ph6_probe_ids WHERE kind='request') AND custom_item_name='PH6 TEMP harmless supply';
UPDATE public.supply_request_batches SET batch_status='submitted' WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request');
DO $test$ BEGIN
 BEGIN
  UPDATE public.supply_request_batches SET batch_status='approved',reviewer_id=auth.uid() WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request');
  RAISE EXCEPTION 'Requester self approval accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('Office Manager requester cannot self approve',true); END;
END $test$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='regional_manager'),true);
INSERT INTO ph6_probe_results SELECT 'Regional Manager sees review without catalog grant',count(*)=1 FROM public.supply_request_batches WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request');
DO $test$ BEGIN
 BEGIN
  UPDATE public.supply_request_batches SET request_month='2099-05-01' WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request');
  RAISE EXCEPTION 'Review-only role edited request without a review transition';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('review-only role cannot edit request outside review transition',true); END;
END $test$;
DO $test$ BEGIN
 BEGIN
  INSERT INTO public.supply_request_batches(office_id,request_month,department_category,requested_by,batch_status) SELECT (SELECT name FROM public.offices WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='office')),'2099-03-01','Front Desk',auth.uid(),'draft';
  RAISE EXCEPTION 'Review visibility granted creation';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('review permission does not grant request creation',true); END;
 BEGIN
  UPDATE public.supply_request_batches SET batch_status='approved',reviewer_id=auth.uid(),request_month='2099-04-01' WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request');
  RAISE EXCEPTION 'Review altered request contents';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('review cannot rewrite request contents',true); END;
END $test$;
UPDATE public.supply_request_batches SET batch_status='approved',reviewer_id=auth.uid() WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request');
INSERT INTO ph6_probe_results SELECT 'eligible Regional Manager approval persists',count(*)=1 FROM public.supply_request_batches WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request') AND batch_status='approved' AND reviewer_id=auth.uid();
DO $test$ BEGIN
 BEGIN
  UPDATE public.supply_request_batches SET batch_status='fulfilled' WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request');
  RAISE EXCEPTION 'Review-only role gained fulfillment';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('review-only role cannot fulfill approved request',true); END;
END $test$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='admin'),true);
DO $test$ BEGIN
 BEGIN
  UPDATE public.supply_request_batches SET batch_status='approved',reviewer_id=auth.uid() WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='admin_own');
  RAISE EXCEPTION 'Admin self approval accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('Admin cannot self approve',true); END;
END $test$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='super_admin'),true);
DO $test$ BEGIN
 BEGIN
  UPDATE public.supply_request_batches SET batch_status='approved',reviewer_id=auth.uid() WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='super_own');
  RAISE EXCEPTION 'Super Admin self approval accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('Super Admin cannot self approve',true); END;
END $test$;
UPDATE public.supply_request_batches SET batch_status='approved',reviewer_id=auth.uid() WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='admin_own');
INSERT INTO ph6_probe_results SELECT 'Super Admin can review another requester',count(*)=1 FROM public.supply_request_batches WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='admin_own') AND batch_status='approved';
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='staff'),true);
INSERT INTO ph6_probe_results SELECT 'ordinary Staff cannot access requests with false page grant',count(*)=0 FROM public.supply_request_batches WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','',true);
INSERT INTO ph6_probe_results SELECT 'confirmed production office aliases match directory',public.dashboard_supply_office_name('Nu Dental of Eatontown')='Eatontown' AND public.dashboard_supply_office_name('Nu Dental of Brick')='Brick' AND public.dashboard_supply_office_name('Nu Dental of Barnegat')='Barnegat' AND public.dashboard_supply_office_name('Nu Dental of Staten Island')='Staten Island' AND public.dashboard_supply_office_name('Unrecognized office')='Unrecognized office';
INSERT INTO ph6_probe_results SELECT 'one authoritative review audit',count(*)=1 FROM public.supply_audit_logs WHERE record_id=(SELECT id FROM ph6_probe_ids WHERE kind='request') AND action='status_approved' AND changed_by=(SELECT id FROM ph6_probe_ids WHERE kind='regional_manager') AND old_values->>'batch_status'='submitted' AND new_values->>'batch_status'='approved';
SELECT check_name,pass FROM ph6_probe_results ORDER BY check_name;
