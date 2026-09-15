const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),office=crypto.randomUUID(),other=crypto.randomUUID(),actors={},tasks={},results=[];
 try{
  for(const id of [office,other])await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)',[id,'QA / Task permission '+id.slice(0,8)]);
  for(const role of ['staff','office_manager','super_admin']){
   const id=actors[role]=crypto.randomUUID();
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,'qa-'+role+'@nudashboard.example.test',JSON.stringify({full_name:'QA '+role})]);
   await db.query("UPDATE public.user_profiles SET role=$2,office_id=$3,is_active=true,is_approved=true,status='Active' WHERE id=$1",[id,role,office]);
   await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,$3)',[id,office,role==='super_admin']);
   await db.query("INSERT INTO public.role_permissions(role,permission,enabled) VALUES($1,'workflow.tasks.view',$2)",[role,role==='office_manager']);
  }
  for(const [key,scope] of [['own',office],['other',other]]){
   const id=tasks[key]=crypto.randomUUID();await db.query("INSERT INTO public.action_items(id,office_id,assigned_owner_id,action_required) VALUES($1,$2,$3,'QA TEMP permission task')",[id,scope,actors.staff]);
  }
  await db.exec("SET nudashboard.environment='qa';");await db.exec(fs.readFileSync(path.join(__dirname,'repairs/002-office-workflow-boundary.sql'),'utf8'));
  async function attempt(name,role,sql,params,expected){
   await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[role]]);
   let allowed=false;try{allowed=(await db.query(sql,params)).rows.length>0;}catch(e){if(e.code!=='42501')throw e;}finally{await db.exec('ROLLBACK;');}
   results.push({test:name,pass:allowed===expected});
  }
  const read='SELECT id FROM public.action_items WHERE id=$1';
  await attempt('original disabled staff API read bypass reproduced','staff',read,[tasks.own],true);
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/008-task-page-permission.sql'),'utf8'));
  await attempt('disabled staff read denied','staff',read,[tasks.own],false);
  await attempt('disabled staff update denied','staff',"UPDATE public.action_items SET notes='QA denied' WHERE id=$1 RETURNING id",[tasks.own],false);
  await attempt('disabled staff insert denied','staff',"INSERT INTO public.action_items(office_id,assigned_owner_id,action_required) VALUES($1,$2,'QA denied insert') RETURNING id",[office,actors.staff],false);
  await attempt('enabled manager read preserved','office_manager',read,[tasks.own],true);
  await attempt('manager office scope preserved','office_manager',read,[tasks.other],false);
  await attempt('super-admin UI exception preserved despite false flag','super_admin',read,[tasks.own],true);
  await db.query("UPDATE public.role_permissions SET enabled=true WHERE role='staff' AND permission='workflow.tasks.view'");
  await attempt('existing permission can enable assigned staff reads','staff',read,[tasks.own],true);
  await attempt('enabled staff status update preserved','staff',"UPDATE public.action_items SET task_status='in_progress' WHERE id=$1 RETURNING id",[tasks.own],true);
  await attempt('enabled staff office scope preserved','staff',read,[tasks.other],false);
  await db.query("DELETE FROM public.role_permissions WHERE role='staff' AND permission='workflow.tasks.view'");
  await attempt('missing permission denies staff as UI does','staff',read,[tasks.own],false);
  console.log(JSON.stringify({checks:results.length,passed:results.filter(r=>r.pass).length,results,productionConnected:false}));assert.ok(results.every(r=>r.pass));
 }finally{await db.close();}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1;});
