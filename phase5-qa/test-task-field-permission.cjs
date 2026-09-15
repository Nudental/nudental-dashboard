const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),office=crypto.randomUUID(),other=crypto.randomUUID(),actors={},tasks={},results=[];
 try{
  for(const id of [office,other])await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)',[id,'QA / Task fields '+id.slice(0,8)]);
  for(const role of ['staff','office_manager','super_admin']){
   const id=actors[role]=crypto.randomUUID();
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,'qa-'+role+'@nudashboard.example.test',JSON.stringify({full_name:'QA '+role})]);
   await db.query("UPDATE public.user_profiles SET role=$2,office_id=$3,is_active=true,is_approved=true,status='Active' WHERE id=$1",[id,role,office]);
   await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,$3)',[id,office,role==='super_admin']);
   await db.query("INSERT INTO public.role_permissions(role,permission,enabled) VALUES($1,'workflow.tasks.view',true)",[role]);
  }
  for(const [key,scope] of [['own',office],['other',other]]){
   const id=tasks[key]=crypto.randomUUID();await db.query("INSERT INTO public.action_items(id,office_id,assigned_owner_id,created_by,action_required,priority_level,task_status) VALUES($1,$2,$3,$4,'QA TEMP field task','medium','acknowledged')",[id,scope,actors.staff,actors.office_manager]);
  }
  await db.exec("SET nudashboard.environment='qa';");
  for(const file of ['002-office-workflow-boundary.sql','008-task-page-permission.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'repairs',file),'utf8'));
  async function attempt(name,role,sql,params,expected){
   await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[role]]);
   let allowed=false;try{allowed=(await db.query(sql,params)).rows.length>0;}catch(e){if(e.code!=='42501')throw e;}finally{await db.exec('ROLLBACK;');}
   results.push({test:name,pass:allowed===expected});
  }
  const priority="UPDATE public.action_items SET priority_level='high' WHERE id=$1 RETURNING id";
  await attempt('original staff manager-field bypass reproduced','staff',priority,[tasks.own],true);
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/009-task-field-permission.sql'),'utf8'));
  for(const [name,set,params]of [
   ['priority',"priority_level='high'",[]],['description',"action_required='QA changed'",[]],
   ['notes',"notes='QA changed'",[]],['due date',"due_date='2026-09-16'",[]],
   ['creator','created_by=$2',[actors.staff]],['submission time',"submitted_at=now()",[]],
   ['assignment','assigned_owner_id=$2',[actors.office_manager]],['office','office_id=$2',[other]]
  ])await attempt('staff cannot edit '+name,'staff','UPDATE public.action_items SET '+set+' WHERE id=$1 RETURNING id',[tasks.own,...params],false);
  await attempt('staff ordinary lifecycle transition preserved','staff',"UPDATE public.action_items SET task_status='in_progress',in_progress_at=now(),in_progress_by=$2,updated_at=now() WHERE id=$1 RETURNING id",[tasks.own,actors.staff],true);
  await attempt('staff other-office scope preserved','staff',"UPDATE public.action_items SET task_status='completed' WHERE id=$1 RETURNING id",[tasks.other],false);
  await attempt('manager field edits preserved','office_manager',priority,[tasks.own],true);
  await attempt('manager other-office scope preserved','office_manager',priority,[tasks.other],false);
  await attempt('super-admin field edits preserved','super_admin',priority,[tasks.own],true);
  console.log(JSON.stringify({checks:results.length,passed:results.filter(r=>r.pass).length,results,productionConnected:false}));assert.ok(results.every(r=>r.pass));
 }finally{await db.close();}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1;});
