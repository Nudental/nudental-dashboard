const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),owner=crypto.randomUUID(),other=crypto.randomUUID(),notification=crypto.randomUUID(),results=[];
 try{
  for(const id of [owner,other])await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,'qa-'+id+'@nudashboard.example.test',JSON.stringify({full_name:'QA notification actor'})]);
  await db.query("INSERT INTO public.notifications(id,user_id,title,message,notification_type) VALUES($1,$2,'QA TEMP notification','QA harmless test','system')",[notification,owner]);
  async function asActor(actor,sql,params){await db.exec('BEGIN; SET LOCAL ROLE authenticated;');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actor]);try{const r=await db.query(sql,params);await db.exec('COMMIT;');return r;}catch(e){await db.exec('ROLLBACK;');throw e;}}
  async function audit(){return (await db.query("SELECT action,user_id,old_values,new_values,changed_fields FROM public.audit_logs WHERE table_name='notifications' AND record_id=$1 ORDER BY created_at,id",[notification])).rows;}
  function check(name,value){results.push({test:name,pass:!!value});}
  await asActor(owner,'UPDATE public.notifications SET is_read=true WHERE id=$1',[notification]);check('original read-state audit gap reproduced',(await audit()).length===0);
  await db.exec("SET nudashboard.environment='qa';");await db.exec(fs.readFileSync(path.join(__dirname,'repairs/010-notification-audit-coverage.sql'),'utf8'));
  await asActor(owner,'UPDATE public.notifications SET is_read=false WHERE id=$1',[notification]);let rows=await audit();check('owner read-state change audited once',rows.length===1&&rows[0].user_id===owner&&rows[0].old_values.is_read===true&&rows[0].new_values.is_read===false&&rows[0].changed_fields.includes('is_read'));
  await asActor(other,'UPDATE public.notifications SET is_archived=true WHERE id=$1',[notification]);check('other-user write denied without audit',(await audit()).length===1);
  await asActor(owner,'UPDATE public.notifications SET is_archived=true,is_read=true WHERE id=$1',[notification]);rows=await audit();check('owner archive retains old and new state',rows.length===2&&rows.some(r=>r.old_values.is_archived===false&&r.new_values.is_archived===true));
  await asActor(owner,'DELETE FROM public.notifications WHERE id=$1',[notification]);rows=await audit();check('temporary notification deletion audited and history retained',rows.length===3&&rows.some(r=>r.action==='DELETE'&&r.old_values.id===notification));
  check('temporary notification cleaned',(await db.query('SELECT id FROM public.notifications WHERE id=$1',[notification])).rows.length===0);
  const fresh=crypto.randomUUID();await asActor(owner,"INSERT INTO public.notifications(id,user_id,title,message,notification_type) VALUES($1,$2,'QA TEMP create','QA harmless test','system')",[fresh,owner]);const inserted=(await db.query("SELECT action,user_id FROM public.audit_logs WHERE table_name='notifications' AND record_id=$1",[fresh])).rows;check('new notification creation audited',inserted.length===1&&inserted[0].action==='INSERT'&&inserted[0].user_id===owner);
  console.log(JSON.stringify({checks:results.length,passed:results.filter(r=>r.pass).length,results,productionConnected:false}));assert.ok(results.every(r=>r.pass));
 }finally{await db.close();}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1;});
