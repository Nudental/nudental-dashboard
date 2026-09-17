-- Synthetic hosted-QA contract. Caller wraps the migration and this probe in a
-- single transaction ending ROLLBACK. Never run this fixture in production.
CREATE TEMP TABLE ph6_probe_ids(kind text PRIMARY KEY,id uuid NOT NULL);
INSERT INTO ph6_probe_ids VALUES ('office',gen_random_uuid()),('other_office',gen_random_uuid()),
 ('super_admin',gen_random_uuid()),('admin',gen_random_uuid()),('office_manager',gen_random_uuid()),
 ('staff',gen_random_uuid()),('task',gen_random_uuid()),('notification',gen_random_uuid());
GRANT SELECT ON ph6_probe_ids TO authenticated;
CREATE TEMP TABLE ph6_probe_results(check_name text PRIMARY KEY,pass boolean NOT NULL CHECK(pass));
GRANT SELECT,INSERT ON ph6_probe_results TO authenticated;
INSERT INTO public.offices(id,name) SELECT id,'PH6 TEMP isolated '||id FROM ph6_probe_ids WHERE kind IN ('office','other_office');
INSERT INTO auth.users(id,email,raw_user_meta_data) SELECT id,'ph6-'||id||'@example.test','{"role":"super_admin"}'::jsonb FROM ph6_probe_ids WHERE kind IN ('super_admin','admin','office_manager','staff');
INSERT INTO ph6_probe_results SELECT 'signup cannot grant privilege',count(*)=4 FROM public.user_profiles p JOIN ph6_probe_ids i ON p.id=i.id WHERE p.role='staff';
UPDATE public.user_profiles p SET role=i.kind::public.user_role,office_id=(SELECT id FROM ph6_probe_ids WHERE kind='office'),is_active=true,is_approved=true,status='Active' FROM ph6_probe_ids i WHERE p.id=i.id;
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) SELECT id,(SELECT id FROM ph6_probe_ids WHERE kind='office'),false FROM ph6_probe_ids WHERE kind IN ('super_admin','admin','office_manager','staff');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='office_manager'),true),set_config('request.jwt.claim.role','authenticated',true);
DO $test$ BEGIN
 BEGIN
  UPDATE public.user_profiles SET role='super_admin' WHERE id=auth.uid();
  RAISE EXCEPTION 'Self escalation accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('self privilege escalation denied',true); END;
END $test$;
INSERT INTO public.action_items(id,office_id,assigned_owner_id,created_by,action_required,priority_level,task_status)
SELECT (SELECT id FROM ph6_probe_ids WHERE kind='task'),(SELECT id FROM ph6_probe_ids WHERE kind='office'),auth.uid(),auth.uid(),'PH6 TEMP hosted QA task','medium','submitted';
UPDATE public.action_items SET task_status='completed',completed_at=now(),completed_by=auth.uid() WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='task');
INSERT INTO ph6_probe_results SELECT 'manager task persists inside transaction',count(*)=1 FROM public.action_items WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='task') AND task_status='completed';
DO $test$ BEGIN
 BEGIN
  INSERT INTO public.action_items(office_id,created_by,action_required,priority_level,task_status) SELECT (SELECT id FROM ph6_probe_ids WHERE kind='other_office'),auth.uid(),'PH6 TEMP forbidden','medium','submitted';
  RAISE EXCEPTION 'Cross office accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('cross office denied',true); END;
 BEGIN
  UPDATE public.action_items SET completed_by=(SELECT id FROM ph6_probe_ids WHERE kind='admin') WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='task');
  RAISE EXCEPTION 'Forged actor accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('lifecycle actor forgery denied',true); END;
 BEGIN
  PERFORM public.dashboard_set_user_offices((SELECT id FROM ph6_probe_ids WHERE kind='staff'),ARRAY[(SELECT id FROM ph6_probe_ids WHERE kind='other_office')],false);
  RAISE EXCEPTION 'Nonadmin assignment accepted';
 EXCEPTION WHEN insufficient_privilege THEN INSERT INTO ph6_probe_results VALUES('nonadmin office assignment denied',true); END;
END $test$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='staff'),true);
INSERT INTO ph6_probe_results SELECT 'actual staff page grant remains denied',count(*)=0 FROM public.action_items WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='task');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','',true);
INSERT INTO ph6_probe_results SELECT 'task audit actor role office before after',count(*)=1 FROM public.audit_logs WHERE record_id=(SELECT id FROM ph6_probe_ids WHERE kind='task') AND action='UPDATE'
 AND user_id=(SELECT id FROM ph6_probe_ids WHERE kind='office_manager') AND old_values->>'task_status'='submitted' AND new_values->>'task_status'='completed'
 AND change_summary::jsonb->>'actor_role'='office_manager' AND change_summary::jsonb->>'record_office_id'=(SELECT id::text FROM ph6_probe_ids WHERE kind='office');
INSERT INTO public.notifications(id,user_id,title,message,notification_type) SELECT (SELECT id FROM ph6_probe_ids WHERE kind='notification'),(SELECT id FROM ph6_probe_ids WHERE kind='staff'),'PH6 TEMP notification','Harmless QA only','system';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='staff'),true),set_config('request.jwt.claim.role','authenticated',true);
UPDATE public.notifications SET is_read=true WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='notification');
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='office_manager'),true);
WITH changed AS (UPDATE public.notifications SET is_archived=true WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='notification') RETURNING id)
INSERT INTO ph6_probe_results SELECT 'notification ownership remains enforced',count(*)=0 FROM changed;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM ph6_probe_ids WHERE kind='admin'),true);
SELECT count(*) FROM public.dashboard_set_user_offices((SELECT id FROM ph6_probe_ids WHERE kind='staff'),ARRAY[(SELECT id FROM ph6_probe_ids WHERE kind='other_office'),(SELECT id FROM ph6_probe_ids WHERE kind='other_office')],false);
INSERT INTO ph6_probe_results SELECT 'primary office updated atomically',count(*)=1 FROM public.user_profiles WHERE id=(SELECT id FROM ph6_probe_ids WHERE kind='staff') AND office_id=(SELECT id FROM ph6_probe_ids WHERE kind='other_office');
INSERT INTO ph6_probe_results SELECT 'assignment duplicates prevented',count(*)=1 FROM public.user_office_assignments WHERE user_id=(SELECT id FROM ph6_probe_ids WHERE kind='staff');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','',true);
INSERT INTO ph6_probe_results SELECT 'notification state actor audited once',count(*)=1 FROM public.audit_logs WHERE record_id=(SELECT id FROM ph6_probe_ids WHERE kind='notification') AND action='UPDATE' AND new_values->>'is_read'='true' AND user_id=(SELECT id FROM ph6_probe_ids WHERE kind='staff');
SELECT check_name,pass FROM ph6_probe_results ORDER BY check_name;
