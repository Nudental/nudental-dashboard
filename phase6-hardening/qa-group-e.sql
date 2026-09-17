-- Synthetic goal/insurance records only; caller rolls the entire test back.
INSERT INTO ph6_probe_ids VALUES ('request',gen_random_uuid()),('verification',gen_random_uuid());
INSERT INTO public.office_goals(office_id,month_year,monthly_target,production_goal) SELECT id,'2099-01',1000,1000 FROM ph6_probe_ids WHERE kind IN ('office','other_office');
INSERT INTO public.service_category_goals(office_id,month_year,service_category,net_production_goal) SELECT id,'2099-01','PH6 TEMP category',1000 FROM ph6_probe_ids WHERE kind IN ('office','other_office');
INSERT INTO public.insurance_verification_requests(id,office_id,submission_date,requesting_staff_name,appointment_date,appointment_time,patient_first_name,patient_last_name,patient_dob,patient_phone,insurance_company_name,insurance_phone,member_id)
SELECT (SELECT id FROM ph6_probe_ids WHERE kind='request'),(SELECT id FROM ph6_probe_ids WHERE kind='office'),'2099-01-05','PH6 SYNTHETIC STAFF','2099-01-06','09:00','PH6 SYNTHETIC','NOT A PATIENT','2000-01-01','0000000000','PH6 FAKE CARRIER','0000000000','PH6 FAKE MEMBER';
INSERT INTO public.insurance_verifications(id,request_id,status,notes) SELECT (SELECT id FROM ph6_probe_ids WHERE kind='verification'),(SELECT id FROM ph6_probe_ids WHERE kind='request'),'completed','PH6 TEMP completed form';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='office_manager'),true),set_config('request.jwt.claim.role','authenticated',true);
INSERT INTO ph6_probe_results SELECT 'Office Manager goals stay office scoped',count(*)=1 FROM public.office_goals WHERE month_year='2099-01' AND office_id IN (SELECT id FROM ph6_probe_ids WHERE kind IN ('office','other_office'));
INSERT INTO ph6_probe_results SELECT 'service goals stay office scoped',count(*)=1 FROM public.service_category_goals WHERE service_category='PH6 TEMP category' AND office_id IN (SELECT id FROM ph6_probe_ids WHERE kind IN ('office','other_office'));
INSERT INTO ph6_probe_results SELECT 'configured insurance page grant remains usable',count(*)=1 FROM public.insurance_verification_requests WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request');
DO $test$ BEGIN
 BEGIN
  UPDATE public.insurance_verifications SET notes='PH6 TEMP forbidden overwrite' WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='verification');
  RAISE EXCEPTION 'Completed form edit accepted';
 EXCEPTION WHEN check_violation THEN INSERT INTO ph6_probe_results VALUES('completed insurance form locked below UI',true); END;
END $test$;
UPDATE public.insurance_verifications SET updated_at=now(),manual_chart_upload_note='PH6 TEMP tracking only' WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='verification');
INSERT INTO ph6_probe_results SELECT 'permitted tracking metadata preserved',count(*)=1 FROM public.insurance_verifications WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='verification') AND notes='PH6 TEMP completed form' AND manual_chart_upload_note='PH6 TEMP tracking only';
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='staff'),true);
INSERT INTO ph6_probe_results SELECT 'disabled staff insurance grant denied',count(*)=0 FROM public.insurance_verification_requests WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='request');
INSERT INTO ph6_probe_results SELECT 'insurance child follows request access',count(*)=0 FROM public.insurance_verifications WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='verification');
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='admin'),true);
INSERT INTO ph6_probe_results SELECT 'Admin retains all-office goal visibility',count(*)=2 FROM public.office_goals WHERE month_year='2099-01' AND office_id IN (SELECT id FROM ph6_probe_ids WHERE kind IN ('office','other_office'));
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','',true);
INSERT INTO ph6_probe_results SELECT 'test goal values unchanged',count(*)=2 FROM public.office_goals WHERE month_year='2099-01' AND office_id IN (SELECT id FROM ph6_probe_ids WHERE kind IN ('office','other_office')) AND production_goal=1000;
SELECT check_name,pass FROM ph6_probe_results ORDER BY check_name;
