-- Runs after the shared synthetic QA bootstrap; caller always rolls back.
INSERT INTO ph6_probe_ids VALUES ('eod',gen_random_uuid()),('huddle',gen_random_uuid()),('regional_manager',gen_random_uuid());
INSERT INTO auth.users(id,email,raw_user_meta_data) SELECT id,'ph6-'||id||'@example.test','{}'::jsonb FROM ph6_probe_ids WHERE kind='regional_manager';
UPDATE public.user_profiles SET role='regional_manager',office_id=(SELECT id FROM ph6_probe_ids WHERE kind='office'),is_active=true,is_approved=true,status='Active' WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='regional_manager');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='office_manager'),true),set_config('request.jwt.claim.role','authenticated',true);
INSERT INTO public.daily_entries(id,office_id,entry_date,submitted_by,status,notes) SELECT (SELECT id FROM ph6_probe_ids WHERE kind='eod'),(SELECT id FROM ph6_probe_ids WHERE kind='office'),'2099-01-05',auth.uid(),'pending','PH6 TEMP QA ordinary entry';
INSERT INTO ph6_probe_results SELECT 'ordinary EOD entry permitted',count(*)=1 FROM public.daily_entries WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='eod');
DO $test$ BEGIN
 BEGIN
  UPDATE public.daily_entries SET status='approved',approved_by=auth.uid() WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='eod');
  RAISE EXCEPTION 'Office Manager approval accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('ordinary Office Manager cannot approve EOD',true); END;
 BEGIN
  INSERT INTO public.daily_entries(office_id,entry_date,submitted_by,status,notes) SELECT (SELECT id FROM ph6_probe_ids WHERE kind='other_office'),'2099-01-05',auth.uid(),'pending','PH6 TEMP forbidden';
  RAISE EXCEPTION 'Cross office entry accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('EOD cross office denied',true); END;
 BEGIN
  INSERT INTO public.daily_entries(office_id,entry_date,submitted_by,status,notes) SELECT (SELECT id FROM ph6_probe_ids WHERE kind='office'),'2099-01-06',(SELECT id FROM ph6_probe_ids WHERE kind='staff'),'pending','PH6 TEMP forged';
  RAISE EXCEPTION 'Forged submitter accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('EOD forged submitter denied',true); END;
END $test$;
INSERT INTO public.huddles(id,office_id,huddle_date,status,created_by,notes_addendum) SELECT (SELECT id FROM ph6_probe_ids WHERE kind='huddle'),(SELECT id FROM ph6_probe_ids WHERE kind='office'),'2099-01-05','submitted',auth.uid(),'PH6 TEMP QA Huddle';
DO $test$ BEGIN
 BEGIN
  UPDATE public.huddles SET status='approved',approved_by=auth.uid() WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='huddle');
  RAISE EXCEPTION 'Office Manager huddle review accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('ordinary Office Manager cannot review Huddle',true); END;
END $test$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='regional_manager'),true);
UPDATE public.daily_entries SET status='approved',approved_by=auth.uid(),approved_at=now() WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='eod');
INSERT INTO ph6_probe_results SELECT 'Regional Manager EOD review permitted',count(*)=1 FROM public.daily_entries WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='eod') AND status='approved';
UPDATE public.huddles SET status='approved',approved_by=auth.uid(),approved_at=now() WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='huddle');
INSERT INTO ph6_probe_results SELECT 'Regional Manager Huddle review permitted',count(*)=1 FROM public.huddles WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='huddle') AND status='approved';
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='office_manager'),true);
DO $test$ BEGIN
 BEGIN
  UPDATE public.daily_entries SET notes='PH6 TEMP forbidden edit' WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='eod');
  RAISE EXCEPTION 'Approved EOD ordinary edit accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('approved EOD protected from ordinary edit',true); END;
END $test$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','',true);
INSERT INTO ph6_probe_results SELECT 'EOD review actor role old new audit',count(*)=1 FROM public.audit_logs WHERE record_id=(SELECT id FROM ph6_probe_ids WHERE kind='eod') AND action='UPDATE' AND old_values->>'status'='pending' AND new_values->>'status'='approved' AND user_id=(SELECT id FROM ph6_probe_ids WHERE kind='regional_manager') AND change_summary::jsonb->>'actor_role'='regional_manager';
INSERT INTO ph6_probe_results SELECT 'unrelated analytics stays disabled',tgenabled='D' FROM pg_trigger WHERE tgname='trg_eod_approval_sync_analytics';
SELECT check_name,pass FROM ph6_probe_results ORDER BY check_name;
