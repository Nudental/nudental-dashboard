const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {openSchema}=require('./offline_database.cjs');
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));
const actorIds=Object.fromEntries(fixtures.actors.map(a=>[a.fixture_key,crypto.randomUUID()]));
(async()=>{
 const {db,report}=await openSchema();let stage='seeding synthetic fixtures';
 try{
  for(const office of fixtures.offices)await db.query('INSERT INTO public.offices(id,name,is_active) VALUES($1,$2,true)',[office.id,office.name]);
  for(const actor of fixtures.actors){
   const id=actorIds[actor.fixture_key];
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,actor.email,JSON.stringify({full_name:actor.full_name,role:actor.role})]);
   await db.query('UPDATE public.user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status=$6 WHERE id=$1',[id,actor.role,actor.office_id,actor.is_active,actor.is_approved,actor.status]);
   await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,$3)',[id,actor.office_id,actor.all_offices]);
  }
  await db.query('INSERT INTO public.role_permissions(role,permission,enabled) SELECT role,permission,enabled FROM jsonb_to_recordset($1::jsonb) AS x(role text,permission text,enabled boolean)',[JSON.stringify(fixtures.role_permissions)]);
  const repaired=process.argv.includes('--repair');
  if(repaired){
   stage='QA profile repair candidate';
   await db.exec("SET nudashboard.environment='qa';");
   await db.exec(fs.readFileSync(path.join(__dirname,'repairs/001-profile-access-boundary.sql'),'utf8'));
  }
  const cases=[
   {name:'staff cannot promote own role',actor:'staff',sql:"UPDATE public.user_profiles SET role='super_admin' WHERE id=$1 RETURNING id",params:[actorIds.staff],allow:false},
   {name:'unapproved user cannot approve self',actor:'unapproved_staff',sql:"UPDATE public.user_profiles SET is_approved=true,status='Active' WHERE id=$1 RETURNING id",params:[actorIds.unapproved_staff],allow:false},
   {name:'inactive user cannot reactivate self',actor:'inactive_staff',sql:"UPDATE public.user_profiles SET is_active=true,status='Active' WHERE id=$1 RETURNING id",params:[actorIds.inactive_staff],allow:false},
   {name:'staff cannot grant self another office',actor:'staff',sql:'UPDATE public.user_profiles SET office_id=$2 WHERE id=$1 RETURNING id',params:[actorIds.staff,fixtures.offices[1].id],allow:false},
   {name:'staff cannot grant executive access',actor:'staff',sql:'UPDATE public.user_profiles SET has_executive_view=true,"dashboard:executive_overview"=true WHERE id=$1 RETURNING id',params:[actorIds.staff],allow:false},
   {name:'staff may edit own display name',actor:'staff',sql:"UPDATE public.user_profiles SET full_name='QA / Renamed Staff' WHERE id=$1 RETURNING id",params:[actorIds.staff],allow:true},
   {name:'staff cannot edit another profile',actor:'staff',sql:"UPDATE public.user_profiles SET full_name='QA / Unwanted Change' WHERE id=$1 RETURNING id",params:[actorIds.staff_b],allow:false},
   {name:'staff cannot change role permission grants',actor:'staff',sql:"UPDATE public.role_permissions SET enabled=true WHERE role='staff' AND permission='dashboard:executive_overview' RETURNING id",params:[],allow:false},
   {name:'staff cannot delete own profile to bypass update guard',actor:'staff',sql:'DELETE FROM public.user_profiles WHERE id=$1 RETURNING id',params:[actorIds.staff],allow:false},
   {name:'active administrator may manage another user',actor:'admin',sql:"UPDATE public.user_profiles SET office_id=$2 WHERE id=$1 RETURNING id",params:[actorIds.staff,fixtures.offices[1].id],allow:true},
   {name:'active super administrator may manage another user',actor:'super_admin',sql:"UPDATE public.user_profiles SET is_active=false WHERE id=$1 RETURNING id",params:[actorIds.staff],allow:true},
  ];
  const results=[];
  for(const item of cases){
   stage=item.name;await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claims',$2,true)",[actorIds[item.actor],JSON.stringify({sub:actorIds[item.actor],role:'authenticated'})]);
   let allowed=false,code=null;
   try{const response=await db.query(item.sql,item.params);allowed=response.rows.length>0;}catch(error){code=error.code;}
   await db.exec('ROLLBACK;');
   results.push({case:item.name,expected:item.allow?'ALLOW':'DENY',actual:allowed?'ALLOW':'DENY',sqlstate:code,result:allowed===item.allow?'PASS':'FAIL'});
  }
  stage='untrusted signup metadata';
  const signupId=crypto.randomUUID();
  await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[signupId,'qa-metadata-probe@nudashboard.example.test',JSON.stringify({full_name:'QA / Metadata Probe',role:'super_admin'})]);
  const signupRole=(await db.query('SELECT role FROM public.user_profiles WHERE id=$1',[signupId])).rows[0].role;
  results.push({case:'untrusted signup metadata cannot select privileged role',expected:'staff',actual:signupRole,result:signupRole==='staff'?'PASS':'FAIL'});
  stage='committed profile edit and audit readback';
  const beforeAudit=(await db.query("SELECT count(*)::int AS n FROM public.audit_logs WHERE table_name='user_profiles' AND record_id=$1",[actorIds.staff])).rows[0].n;
  await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actorIds.staff]);
  await db.query("UPDATE public.user_profiles SET full_name='QA / Persistent Profile Edit' WHERE id=$1",[actorIds.staff]);
  await db.exec('COMMIT; RESET ROLE;');
  const afterName=(await db.query('SELECT full_name FROM public.user_profiles WHERE id=$1',[actorIds.staff])).rows[0].full_name;
  const afterAudit=(await db.query("SELECT count(*)::int AS n FROM public.audit_logs WHERE table_name='user_profiles' AND record_id=$1",[actorIds.staff])).rows[0].n;
  results.push({case:'ordinary profile edit persists after commit and new query',result:afterName==='QA / Persistent Profile Edit'?'PASS':'FAIL'});
  results.push({case:'ordinary profile edit records audit history',auditDelta:afterAudit-beforeAudit,result:afterAudit===beforeAudit+1?'PASS':'FAIL'});
  await db.query('UPDATE public.user_profiles SET full_name=$2 WHERE id=$1',[actorIds.staff,fixtures.actors.find(a=>a.fixture_key==='staff').full_name]);
  const result={engine:report.engine,schemaSha256:report.schemaSha256,repaired,method:'Copied schema policies and functions, SET ROLE authenticated, synthetic auth claims and fixtures; every role probe rolled back',cases:results,passed:results.filter(x=>x.result==='PASS').length,failed:results.filter(x=>x.result==='FAIL').length,liveSupabaseVerified:false,productionConnected:false};
  if(repaired && result.failed)process.exitCode=1;
  console.log(JSON.stringify(result));
 }catch(error){console.log(JSON.stringify({status:'PROBE_ERROR',stage,code:error.code,message:String(error.message).slice(0,200)}));process.exitCode=1;}
 finally{await db.close();}
})().catch(error=>{console.log(JSON.stringify({status:'SETUP_ERROR',code:error.code,message:String(error.message).slice(0,180)}));process.exitCode=1;});
