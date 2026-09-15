BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM dashboard_qa.schema_installation WHERE project_ref='hvtxjfayenqnwtaisoaw' AND applied_batch=26)
 OR EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM public.offices) THEN
 RAISE EXCEPTION 'Hosted probes require the completed, empty isolated QA project'; END IF;
END $guard$;
SET LOCAL qa.probe_results='[]';
INSERT INTO public.offices(id,name,is_active) VALUES('9219b493-5765-5da0-939f-221c7f9944d9','QA / Office A',true);
INSERT INTO public.offices(id,name,is_active) VALUES('873fd448-c507-5a1d-aebe-4b22278b3a28','QA / Office B',true);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000001','qa-staff@nudashboard.example.test','{"full_name":"QA / Staff","role":"staff"}'::jsonb);
UPDATE public.user_profiles SET role='staff',office_id='9219b493-5765-5da0-939f-221c7f9944d9',is_active=true,is_approved=true,status='Active' WHERE id='00000000-0000-4000-8000-000000000001';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000001','9219b493-5765-5da0-939f-221c7f9944d9',false);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000002','qa-admin@nudashboard.example.test','{"full_name":"QA / Admin","role":"admin"}'::jsonb);
UPDATE public.user_profiles SET role='admin',office_id='9219b493-5765-5da0-939f-221c7f9944d9',is_active=true,is_approved=true,status='Active' WHERE id='00000000-0000-4000-8000-000000000002';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000002','9219b493-5765-5da0-939f-221c7f9944d9',false);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000003','qa-super-admin@nudashboard.example.test','{"full_name":"QA / Super Admin","role":"super_admin"}'::jsonb);
UPDATE public.user_profiles SET role='super_admin',office_id='9219b493-5765-5da0-939f-221c7f9944d9',is_active=true,is_approved=true,status='Active' WHERE id='00000000-0000-4000-8000-000000000003';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000003','9219b493-5765-5da0-939f-221c7f9944d9',true);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000004','qa-office-manager@nudashboard.example.test','{"full_name":"QA / Office Manager","role":"office_manager"}'::jsonb);
UPDATE public.user_profiles SET role='office_manager',office_id='9219b493-5765-5da0-939f-221c7f9944d9',is_active=true,is_approved=true,status='Active' WHERE id='00000000-0000-4000-8000-000000000004';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000004','9219b493-5765-5da0-939f-221c7f9944d9',false);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000005','qa-regional-clinical-manager@nudashboard.example.test','{"full_name":"QA / Regional Clinical Manager","role":"regional_clinical_manager"}'::jsonb);
UPDATE public.user_profiles SET role='regional_clinical_manager',office_id='9219b493-5765-5da0-939f-221c7f9944d9',is_active=true,is_approved=true,status='Active' WHERE id='00000000-0000-4000-8000-000000000005';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000005','9219b493-5765-5da0-939f-221c7f9944d9',false);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000006','qa-regional-manager@nudashboard.example.test','{"full_name":"QA / Regional Manager","role":"regional_manager"}'::jsonb);
UPDATE public.user_profiles SET role='regional_manager',office_id='9219b493-5765-5da0-939f-221c7f9944d9',is_active=true,is_approved=true,status='Active' WHERE id='00000000-0000-4000-8000-000000000006';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000006','9219b493-5765-5da0-939f-221c7f9944d9',false);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000007','qa-insurance-verifier@nudashboard.example.test','{"full_name":"QA / Insurance Verifier","role":"insurance_verifier"}'::jsonb);
UPDATE public.user_profiles SET role='insurance_verifier',office_id='9219b493-5765-5da0-939f-221c7f9944d9',is_active=true,is_approved=true,status='Active' WHERE id='00000000-0000-4000-8000-000000000007';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000007','9219b493-5765-5da0-939f-221c7f9944d9',false);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000008','qa-marketing@nudashboard.example.test','{"full_name":"QA / Marketing","role":"marketing"}'::jsonb);
UPDATE public.user_profiles SET role='marketing',office_id='9219b493-5765-5da0-939f-221c7f9944d9',is_active=true,is_approved=true,status='Active' WHERE id='00000000-0000-4000-8000-000000000008';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000008','9219b493-5765-5da0-939f-221c7f9944d9',false);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000009','qa-office-manager-b@nudashboard.example.test','{"full_name":"QA / Office Manager B","role":"office_manager"}'::jsonb);
UPDATE public.user_profiles SET role='office_manager',office_id='873fd448-c507-5a1d-aebe-4b22278b3a28',is_active=true,is_approved=true,status='Active' WHERE id='00000000-0000-4000-8000-000000000009';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000009','873fd448-c507-5a1d-aebe-4b22278b3a28',false);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000010','qa-staff-b@nudashboard.example.test','{"full_name":"QA / Staff B","role":"staff"}'::jsonb);
UPDATE public.user_profiles SET role='staff',office_id='873fd448-c507-5a1d-aebe-4b22278b3a28',is_active=true,is_approved=true,status='Active' WHERE id='00000000-0000-4000-8000-000000000010';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000010','873fd448-c507-5a1d-aebe-4b22278b3a28',false);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000011','qa-inactive-staff@nudashboard.example.test','{"full_name":"QA / Inactive Staff","role":"staff"}'::jsonb);
UPDATE public.user_profiles SET role='staff',office_id='9219b493-5765-5da0-939f-221c7f9944d9',is_active=false,is_approved=true,status='Pending' WHERE id='00000000-0000-4000-8000-000000000011';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000011','9219b493-5765-5da0-939f-221c7f9944d9',false);
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('00000000-0000-4000-8000-000000000012','qa-unapproved-staff@nudashboard.example.test','{"full_name":"QA / Unapproved Staff","role":"staff"}'::jsonb);
UPDATE public.user_profiles SET role='staff',office_id='9219b493-5765-5da0-939f-221c7f9944d9',is_active=true,is_approved=false,status='Pending' WHERE id='00000000-0000-4000-8000-000000000012';
INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES('00000000-0000-4000-8000-000000000012','9219b493-5765-5da0-939f-221c7f9944d9',false);
INSERT INTO public.role_permissions(role,permission,enabled) VALUES('staff','dashboard:executive_overview',false);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'UPDATE public.user_profiles SET role=''super_admin'' WHERE id=''00000000-0000-4000-8000-000000000001'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','staff cannot promote own role','expected','DENY','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=false THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000012';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'UPDATE public.user_profiles SET is_approved=true,status=''Active'' WHERE id=''00000000-0000-4000-8000-000000000012'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','unapproved user cannot approve self','expected','DENY','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=false THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000011';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'UPDATE public.user_profiles SET is_active=true,status=''Active'' WHERE id=''00000000-0000-4000-8000-000000000011'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','inactive user cannot reactivate self','expected','DENY','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=false THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'UPDATE public.user_profiles SET office_id=''873fd448-c507-5a1d-aebe-4b22278b3a28'' WHERE id=''00000000-0000-4000-8000-000000000001'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','staff cannot grant self another office','expected','DENY','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=false THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'UPDATE public.user_profiles SET has_executive_view=true,"dashboard:executive_overview"=true WHERE id=''00000000-0000-4000-8000-000000000001'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','staff cannot grant executive access','expected','DENY','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=false THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'UPDATE public.user_profiles SET full_name=''QA / Renamed Staff'' WHERE id=''00000000-0000-4000-8000-000000000001'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','staff may edit own display name','expected','ALLOW','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=true THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'UPDATE public.user_profiles SET full_name=''QA / Unwanted Change'' WHERE id=''00000000-0000-4000-8000-000000000010'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','staff cannot edit another profile','expected','DENY','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=false THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'UPDATE public.role_permissions SET enabled=true WHERE role=''staff'' AND permission=''dashboard:executive_overview'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','staff cannot change role permission grants','expected','DENY','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=false THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'DELETE FROM public.user_profiles WHERE id=''00000000-0000-4000-8000-000000000001'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','staff cannot delete own profile to bypass update guard','expected','DENY','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=false THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'UPDATE public.user_profiles SET office_id=''873fd448-c507-5a1d-aebe-4b22278b3a28'' WHERE id=''00000000-0000-4000-8000-000000000001'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','active administrator may manage another user','expected','ALLOW','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=true THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE 'UPDATE public.user_profiles SET is_active=false WHERE id=''00000000-0000-4000-8000-000000000001'' RETURNING id';
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name','active super administrator may manage another user','expected','ALLOW','actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=true THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;
SELECT 'QA_PROFILE_PERMISSION_PROBES' AS checkpoint,case_name,expected,actual,sqlstate,result FROM jsonb_to_recordset(current_setting('qa.probe_results')::jsonb) AS x(case_name text,expected text,actual text,sqlstate text,result text) ORDER BY case_name;
ROLLBACK;
