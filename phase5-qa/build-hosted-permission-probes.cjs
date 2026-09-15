// Reuse the reviewed offline cases against hosted QA, without committing fixtures.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));
const ids=Object.fromEntries(fixtures.actors.map((a,i)=>[a.fixture_key,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]));
const q=v=>v===null?'NULL':typeof v==='boolean'?String(v):"'"+String(v).replaceAll("'","''")+"'";
function sourceCases(file,context){
 const text=fs.readFileSync(path.join(__dirname,file),'utf8');
 const from=text.indexOf('const cases=['),to=text.indexOf('\n  const results=[];',from);
 if(from<0||to<0)throw Error('Reviewed case block not found');
 return vm.runInNewContext(text.slice(from,to)+'\ncases;',context,{timeout:1000});
}
const a=fixtures.offices[0].id,b=fixtures.offices[1].id;
const huddleA='00000000-0000-4000-8000-000000001001',huddleB='00000000-0000-4000-8000-000000001002';
const taskA='00000000-0000-4000-8000-000000002001',taskB='00000000-0000-4000-8000-000000002002',inactiveTask='00000000-0000-4000-8000-000000002003';
const checkA='00000000-0000-4000-8000-000000003001',checkB='00000000-0000-4000-8000-000000003002';
const groups={profile:sourceCases('test-profile-boundary.cjs',{actorIds:ids,fixtures}),office:sourceCases('test-office-workflows.cjs',{actors:ids,fixtures,a,b,huddleA,huddleB,taskA,taskB,inactiveTask,checkA,checkB}).map(([name,actor,sql,params,allow])=>({name,actor,sql,params,allow}))};
for(const [group,cases] of Object.entries(groups)){
 const sql=[`BEGIN;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM dashboard_qa.schema_installation WHERE project_ref='hvtxjfayenqnwtaisoaw' AND applied_batch=26)
 OR EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM public.offices) THEN
 RAISE EXCEPTION 'Hosted probes require the completed, empty isolated QA project'; END IF;
END $guard$;
SET LOCAL qa.probe_results='[]';`];
 for(const office of fixtures.offices)sql.push(`INSERT INTO public.offices(id,name,is_active) VALUES(${q(office.id)},${q(office.name)},true);`);
 for(const actor of fixtures.actors){
  sql.push(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(${q(ids[actor.fixture_key])},${q(actor.email)},${q(JSON.stringify({full_name:actor.full_name,role:actor.role}))}::jsonb);`);
  sql.push(`UPDATE public.user_profiles SET role=${q(actor.role)},office_id=${q(actor.office_id)},is_active=${q(actor.is_active)},is_approved=${q(actor.is_approved)},status=${q(actor.status)} WHERE id=${q(ids[actor.fixture_key])};`);
  sql.push(`INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES(${q(ids[actor.fixture_key])},${q(actor.office_id)},${q(actor.all_offices)});`);
 }
 const permission=fixtures.role_permissions.find(p=>p.role==='staff'&&p.permission==='dashboard:executive_overview');
 if(!permission)throw Error('Expected source permission not found');
 sql.push(`INSERT INTO public.role_permissions(role,permission,enabled) VALUES('staff','dashboard:executive_overview',${q(permission.enabled)});`);
 if(group==='office'){
  for(const [id,office,date,label] of [[huddleA,a,'2026-09-14','A'],[huddleB,b,'2026-09-15','B']])sql.push(`INSERT INTO public.huddles(id,office_id,huddle_date,status,notes_addendum) VALUES(${q(id)},${q(office)},${q(date)},'draft',${q('QA / Huddle '+label)});`);
  for(const [id,huddle,label] of [[checkA,huddleA,'A'],[checkB,huddleB,'B']])sql.push(`INSERT INTO public.huddle_checklist_items(id,huddle_id,section,item_number) VALUES(${q(id)},${q(huddle)},${q('QA / Checklist '+label)},1);`);
  for(const [id,office,owner] of [[taskA,a,ids.staff],[taskB,b,ids.staff_b],[inactiveTask,a,ids.inactive_staff]])sql.push(`INSERT INTO public.action_items(id,office_id,assigned_owner_id,action_required) VALUES(${q(id)},${q(office)},${q(owner)},'QA / Temporary task');`);
 }
 for(const item of cases){
  const query=item.sql.replace(/\$(\d+)/g,(_,n)=>q(item.params[Number(n)-1]));
  sql.push(`SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub=${q(ids[item.actor])};
SET LOCAL request.jwt.claim.role='authenticated';
DO $probe$ DECLARE n integer:=0; allowed boolean:=false; code text:=NULL; BEGIN
 BEGIN
  EXECUTE ${q(query)};
  GET DIAGNOSTICS n=ROW_COUNT; allowed:=n>0;
  RAISE EXCEPTION USING ERRCODE='ZQ001',MESSAGE='rollback probe mutation';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN NULL; WHEN OTHERS THEN code:=SQLSTATE;
 END;
 PERFORM set_config('qa.probe_results',(current_setting('qa.probe_results')::jsonb || jsonb_build_array(jsonb_build_object('case_name',${q(item.name)},'expected',${q(item.allow?'ALLOW':'DENY')},'actual',CASE WHEN allowed THEN 'ALLOW' ELSE 'DENY' END,'sqlstate',code,'result',CASE WHEN allowed=${q(item.allow)} THEN 'PASS' ELSE 'FAIL' END)))::text,true);
END $probe$;
RESET ROLE;`);
 }
 sql.push(`SELECT 'QA_${group.toUpperCase()}_PERMISSION_PROBES' AS checkpoint,case_name,expected,actual,sqlstate,result FROM jsonb_to_recordset(current_setting('qa.probe_results')::jsonb) AS x(case_name text,expected text,actual text,sqlstate text,result text) ORDER BY case_name;
ROLLBACK;`);
 const out=path.join(__dirname,`hosted-${group}-probes.sql`);fs.writeFileSync(out,sql.join('\n')+'\n');
 console.log(JSON.stringify({group,cases:cases.length,bytes:fs.statSync(out).size,commitsFixtures:false}));
}
