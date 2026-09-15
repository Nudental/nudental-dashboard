const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),office=crypto.randomUUID(),actors={},results=[];
 try{
  await db.exec("SET nudashboard.environment='qa';");
  for(const file of ['001-profile-access-boundary.sql','002-office-workflow-boundary.sql','008-task-page-permission.sql','009-task-field-permission.sql','013-task-identity-boundary.sql'])
   await db.exec(fs.readFileSync(path.join(__dirname,'repairs',file),'utf8'));
  await db.query("INSERT INTO public.offices(id,name) VALUES($1,'QA / Task audit office')",[office]);
  for(const role of ['staff','office_manager']){
   const id=actors[role]=crypto.randomUUID();
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,'qa-'+role+'@nudashboard.example.test',JSON.stringify({full_name:'QA '+role})]);
   await db.query("UPDATE public.user_profiles SET role=$2,office_id=$3,is_active=true,is_approved=true,status='Active' WHERE id=$1",[id,role,office]);
   await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[id,office]);
   await db.query("INSERT INTO public.role_permissions(role,permission,enabled) VALUES($1,'workflow.tasks.view',true)",[role]);
  }
  const check=(test,ok)=>{results.push({test,pass:!!ok});assert.ok(ok,test);};
  async function write(role,sql,values){
   await db.exec('SET LOCAL ROLE authenticated;');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[role]]);
   try{return await db.query(sql,values);}finally{await db.exec('RESET ROLE;');}
  }
  const audit=id=>db.query("SELECT action,user_id,old_values,new_values,changed_fields FROM public.audit_logs WHERE table_name='action_items' AND record_id=$1 ORDER BY created_at,id",[id]);
  async function probe(repaired){
   const id=crypto.randomUUID();await db.exec('BEGIN;');
   try{
    await write('office_manager',"INSERT INTO public.action_items(id,office_id,assigned_owner_id,created_by,action_required,priority_level,task_status) VALUES($1,$2,$3,$4,'QA TEMP task audit','medium','submitted') RETURNING id",[id,office,actors.staff,actors.office_manager]);
    let rows=(await audit(id)).rows;
    check(repaired?'creation records real manager and values':'original direct-write audit gap',repaired?rows.length===1&&rows[0].action==='INSERT'&&rows[0].user_id===actors.office_manager&&rows[0].new_values.action_required==='QA TEMP task audit':rows.length===0);
    if(!repaired)return;
    await write('staff',"UPDATE public.action_items SET task_status='acknowledged',acknowledged_at=now(),acknowledged_by=$2 WHERE id=$1 AND task_status='submitted' RETURNING id",[id,actors.staff]);
    rows=(await audit(id)).rows;const ack=rows.find(row=>row.action==='UPDATE');
    check('acknowledgment records assignee and old/new status',rows.length===2&&ack.user_id===actors.staff&&ack.old_values.task_status==='submitted'&&ack.new_values.task_status==='acknowledged'&&ack.changed_fields.includes('acknowledged_by'));
    await write('staff',"UPDATE public.action_items SET task_status='completed',completed_at=now(),completed_by=$2 WHERE id=$1 AND task_status='acknowledged' RETURNING id",[id,actors.staff]);
    rows=(await audit(id)).rows;const completion=rows.find(row=>row.new_values?.task_status==='completed');
    check('completion recorded once',rows.length===3&&completion.user_id===actors.staff&&completion.new_values.completed_by===actors.staff);
    const stale=await write('staff',"UPDATE public.action_items SET task_status='completed' WHERE id=$1 AND task_status='acknowledged' RETURNING id",[id]);
    check('stale update adds no duplicate row or history',stale.rows.length===0&&(await audit(id)).rows.length===3);
    const deniedDelete=await write('staff','DELETE FROM public.action_items WHERE id=$1 RETURNING id',[id]);
    check('ordinary staff deletion remains denied',deniedDelete.rows.length===0&&(await audit(id)).rows.length===3);
    await write('office_manager','DELETE FROM public.action_items WHERE id=$1 RETURNING id',[id]);
    rows=(await audit(id)).rows;const removed=rows.find(row=>row.action==='DELETE');
    check('temporary cleanup retains delete actor and prior values',rows.length===4&&removed.user_id===actors.office_manager&&removed.old_values.task_status==='completed');
    check('temporary task absent after cleanup',(await db.query('SELECT id FROM public.action_items WHERE id=$1',[id])).rows.length===0);
    check('unrelated analytics remains disabled',(await db.query("SELECT tgenabled FROM pg_trigger WHERE tgname='trg_eod_approval_sync_analytics'")).rows[0].tgenabled==='D');
   }finally{await db.exec('ROLLBACK;');}
  }
  await probe(false);
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/014-task-row-audit.sql'),'utf8'));
  await probe(true);
  console.log(JSON.stringify({checks:results.length,passed:results.filter(row=>row.pass).length,productionConnected:false,fixturesRolledBack:true}));
 }finally{await db.close();}
})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,300)}));process.exitCode=1;});
