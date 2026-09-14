// Exact copied RLS, synthetic records and offline PostgreSQL only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {openSchema}=require('./offline_database.cjs');
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));
const actors=Object.fromEntries(fixtures.actors.map(a=>[a.fixture_key,crypto.randomUUID()]));
(async()=>{
 const {db,report}=await openSchema();let stage='synthetic fixture setup';
 const a=fixtures.offices[0].id,b=fixtures.offices[1].id;
 const huddleA=crypto.randomUUID(),huddleB=crypto.randomUUID(),taskA=crypto.randomUUID(),taskB=crypto.randomUUID(),inactiveTask=crypto.randomUUID();
 const checkA=crypto.randomUUID(),checkB=crypto.randomUUID();
 try{
  for(const office of fixtures.offices)await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)',[office.id,office.name]);
  for(const actor of fixtures.actors){
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[actors[actor.fixture_key],actor.email,JSON.stringify({full_name:actor.full_name,role:actor.role})]);
   await db.query('UPDATE public.user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status=$6 WHERE id=$1',[actors[actor.fixture_key],actor.role,actor.office_id,actor.is_active,actor.is_approved,actor.status]);
   await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,$3)',[actors[actor.fixture_key],actor.office_id,actor.all_offices]);
  }
  for(const [id,office,date,label] of [[huddleA,a,'2026-09-14','A'],[huddleB,b,'2026-09-15','B']])
   await db.query("INSERT INTO public.huddles(id,office_id,huddle_date,status,notes_addendum) VALUES($1,$2,$3,'draft',$4)",[id,office,date,'QA / Huddle '+label]);
  for(const [id,huddle,label] of [[checkA,huddleA,'A'],[checkB,huddleB,'B']])
   await db.query('INSERT INTO public.huddle_checklist_items(id,huddle_id,section,item_number) VALUES($1,$2,$3,1)',[id,huddle,'QA / Checklist '+label]);
  for(const [id,office,owner] of [[taskA,a,actors.staff],[taskB,b,actors.staff_b],[inactiveTask,a,actors.inactive_staff]])
   await db.query("INSERT INTO public.action_items(id,office_id,assigned_owner_id,action_required) VALUES($1,$2,$3,'QA / Temporary task')",[id,office,owner]);
  const repaired=process.argv.includes('--repair');
  if(repaired){await db.exec("SET nudashboard.environment='qa';");await db.exec(fs.readFileSync(path.join(__dirname,'repairs/002-office-workflow-boundary.sql'),'utf8'));}
  const cases=[
   ['manager reads own huddle','office_manager','SELECT id FROM public.huddles WHERE id=$1',[huddleA],true],
   ['manager cannot read other-office huddle','office_manager','SELECT id FROM public.huddles WHERE id=$1',[huddleB],false],
   ['manager cannot edit other-office huddle','office_manager',"UPDATE public.huddles SET notes_addendum='QA / Changed' WHERE id=$1 RETURNING id",[huddleB],false],
   ['manager cannot delete other-office huddle','office_manager','DELETE FROM public.huddles WHERE id=$1 RETURNING id',[huddleB],false],
   ['manager cannot move own huddle to another office','office_manager',"UPDATE public.huddles SET office_id=$2,huddle_date='2026-09-16' WHERE id=$1 RETURNING id",[huddleA,b],false],
   ['manager cannot create huddle in another office','office_manager',"INSERT INTO public.huddles(office_id,huddle_date,notes_addendum) VALUES($1,'2026-09-17','QA / Scope probe') RETURNING id",[b],false],
   ['regional manager retains existing all-office huddle read','regional_manager','SELECT id FROM public.huddles WHERE id=$1',[huddleB],true],
   ['inactive user cannot read own-office huddle','inactive_staff','SELECT id FROM public.huddles WHERE id=$1',[huddleA],false],
   ['unapproved user cannot read own-office huddle','unapproved_staff','SELECT id FROM public.huddles WHERE id=$1',[huddleA],false],
   ['manager reads own checklist','office_manager','SELECT id FROM public.huddle_checklist_items WHERE id=$1',[checkA],true],
   ['manager cannot read other-office checklist','office_manager','SELECT id FROM public.huddle_checklist_items WHERE id=$1',[checkB],false],
   ['manager cannot move checklist into other-office huddle','office_manager','UPDATE public.huddle_checklist_items SET huddle_id=$2,item_number=2 WHERE id=$1 RETURNING id',[checkA,huddleB],false],
   ['staff reads assigned own-office task','staff','SELECT id FROM public.action_items WHERE id=$1',[taskA],true],
   ['staff cannot read another-office task','staff','SELECT id FROM public.action_items WHERE id=$1',[taskB],false],
   ['manager cannot create task for another office','office_manager',"INSERT INTO public.action_items(office_id,assigned_owner_id,action_required) VALUES($1,$2,'QA / Cross-office task')",[b,actors.staff_b],false,'no-returning'],
   ['inactive staff cannot read previously assigned task','inactive_staff','SELECT id FROM public.action_items WHERE id=$1',[inactiveTask],false],
   ['assigned staff may update own task status','staff',"UPDATE public.action_items SET task_status='in_progress' WHERE id=$1 RETURNING id",[taskA],true],
  ];
  const results=[];
  for(const [name,actor,sql,params,expect,mode] of cases){
   stage=name;await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[actor]]);
   let allowed=false,code=null;
   try{const response=await db.query(sql,params);allowed=mode==='no-returning'||response.rows.length>0;}catch(error){code=error.code;}
   await db.exec('ROLLBACK;');
   results.push({case:name,expected:expect?'ALLOW':'DENY',actual:allowed?'ALLOW':'DENY',sqlstate:code,result:allowed===expect?'PASS':'FAIL'});
  }
  const result={engine:report.engine,schemaSha256:report.schemaSha256,repaired,cases:results,passed:results.filter(r=>r.result==='PASS').length,failed:results.filter(r=>r.result==='FAIL').length,productionConnected:false,liveSupabaseVerified:false};
  console.log(JSON.stringify(result));if(repaired&&result.failed)process.exitCode=1;
 }catch(error){console.log(JSON.stringify({status:'PROBE_ERROR',stage,code:error.code,message:String(error.message).slice(0,200)}));process.exitCode=1;}
 finally{await db.close();}
})().catch(error=>{console.log(JSON.stringify({status:'SETUP_ERROR',message:String(error.message).slice(0,160)}));process.exitCode=1;});
