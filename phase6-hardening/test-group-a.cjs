const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require(path.join(process.env.PHASE5_QA_DIR,'offline_database.cjs'));
const {snapshot,rollback}=require('./catalog.cjs');
const config=require('./production-permissions.json'),sql=fs.readFileSync(path.join(__dirname,'migrations/A-tasks-notifications-profiles.sql'),'utf8');
(async()=>{const {db}=await openSchema();let checks=0;const actors={},offices=[crypto.randomUUID(),crypto.randomUUID()];
const ok=(value,label)=>{assert.ok(value,label);checks++;};
try{
 const before=await snapshot(db);await db.exec(sql);const after=await snapshot(db);await db.exec(sql);assert.deepEqual(await snapshot(db),after);checks++;
 const undo=rollback(before,after);await db.exec(undo);assert.deepEqual(await snapshot(db),before);checks++;
 await db.exec(sql);assert.deepEqual((await snapshot(db)).tables,before.tables);checks++;
 for(const id of offices)await db.query("INSERT INTO public.offices(id,name) VALUES($1,$2)",[id,'PH6 TEMP office '+offices.indexOf(id)]);
 for(const role of config.roles){const id=actors[role]=crypto.randomUUID();
  await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{\"role\":\"super_admin\"}')",[id,role+'@phase6.example.test']);
  ok((await db.query('SELECT role FROM public.user_profiles WHERE id=$1',[id])).rows[0].role==='staff','signup cannot select its own privileged role');
  await db.query("UPDATE public.user_profiles SET role=$2,office_id=$3,is_active=true,is_approved=true,status='Active' WHERE id=$1",[id,role,offices[0]]);
  await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[id,offices[0]]);
  for(const key of config.keys)await db.query('INSERT INTO public.role_permissions(role,permission,enabled) VALUES($1,$2,$3)',[role,key,config.enabled[role].includes(key)]);
 }
 async function actor(role,statement,values=[]){await db.exec('BEGIN;SET LOCAL ROLE authenticated;');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[role]]);try{const r=await db.query(statement,values);await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
 async function deny(role,statement,values,label){try{const r=await actor(role,statement,values);ok(r.rows.length===0,label);}catch(e){ok(e.code==='42501',label+': '+e.message);}}
 for(const role of config.roles.filter(r=>!['super_admin','admin'].includes(r)))await deny(role,"UPDATE public.user_profiles SET role='super_admin' WHERE id=$1 RETURNING id",[actors[role]],role+' cannot escalate own profile');
 await actor('office_manager',"UPDATE public.user_profiles SET full_name='PH6 TEMP renamed' WHERE id=$1",[actors.office_manager]);ok(true,'ordinary own profile remains editable');
 const task=crypto.randomUUID();await actor('office_manager',"INSERT INTO public.action_items(id,office_id,assigned_owner_id,created_by,action_required,priority_level,task_status) VALUES($1,$2,$3,$3,'PH6 TEMP task','medium','submitted') RETURNING id",[task,offices[0],actors.office_manager]);
 for(const role of config.roles){const r=await actor(role,'SELECT id FROM public.action_items WHERE id=$1',[task]);ok(r.rows.length===(['super_admin','admin','office_manager'].includes(role)?1:0),'task visibility respects actual grant AND existing row policy: '+role);}
 await deny('office_manager',"INSERT INTO public.action_items(office_id,created_by,action_required,priority_level,task_status) VALUES($1,$2,'PH6 TEMP out of scope','medium','submitted') RETURNING id",[offices[1],actors.office_manager],'cross office denied');
 await deny('office_manager',"UPDATE public.action_items SET created_by=$2 WHERE id=$1 RETURNING id",[task,actors.super_admin],'cannot forge task creator');
 await actor('office_manager',"UPDATE public.action_items SET task_status='completed',completed_at=now(),completed_by=$2 WHERE id=$1",[task,actors.office_manager]);
 await deny('office_manager',"UPDATE public.action_items SET completed_by=$2 WHERE id=$1 RETURNING id",[task,actors.super_admin],'immutable lifecycle actor');
 let rows=(await db.query("SELECT * FROM public.audit_logs WHERE table_name='action_items' AND record_id=$1 ORDER BY created_at",[task])).rows;
 ok(rows.length===2&&rows[1].user_id===actors.office_manager&&rows[1].old_values.task_status==='submitted'&&rows[1].new_values.task_status==='completed','task audit actor, before and after');
 const context=JSON.parse(rows[1].change_summary);ok(context.actor_role==='office_manager'&&context.record_office_id===offices[0]&&rows[1].created_at,'audit role, office, timestamp');
 await db.query('UPDATE public.user_profiles SET is_active=false WHERE id=$1',[actors.office_manager]);await deny('office_manager','SELECT id FROM public.action_items WHERE id=$1',[task],'inactive account denied');await db.query('UPDATE public.user_profiles SET is_active=true WHERE id=$1',[actors.office_manager]);
 const nid=crypto.randomUUID();await db.query("INSERT INTO public.notifications(id,user_id,title,message,notification_type) VALUES($1,$2,'PH6 TEMP','harmless','system')",[nid,actors.staff]);
 await actor('staff','UPDATE public.notifications SET is_read=true WHERE id=$1',[nid]);await deny('office_manager','UPDATE public.notifications SET is_archived=true WHERE id=$1 RETURNING id',[nid],'notification ownership');
 rows=(await db.query("SELECT * FROM public.audit_logs WHERE table_name='notifications' AND record_id=$1 AND action='UPDATE'",[nid])).rows;ok(rows.length===1&&rows[0].user_id===actors.staff&&rows[0].new_values.is_read,'notification read persisted and audited once');
 await deny('office_manager','SELECT * FROM public.dashboard_set_user_offices($1,$2,false)',[actors.staff,[offices[1]]],'office assignment admin only');
 await actor('admin','SELECT * FROM public.dashboard_set_user_offices($1,$2,false)',[actors.staff,[offices[1],offices[1]]]);ok((await db.query('SELECT office_id FROM public.user_profiles WHERE id=$1',[actors.staff])).rows[0].office_id===offices[1],'primary office and assignments atomic');ok((await db.query('SELECT * FROM public.user_office_assignments WHERE user_id=$1',[actors.staff])).rows.length===1,'deduplicated assignments');
 try{await actor('admin','SELECT * FROM public.dashboard_set_user_offices($1,$2,false)',[actors.staff,[crypto.randomUUID()]]);assert.fail('invalid office accepted');}catch(e){ok(e.code==='23503','invalid office rolls back entire assignment');}
 ok((await db.query('SELECT office_id FROM public.user_profiles WHERE id=$1',[actors.staff])).rows[0].office_id===offices[1],'failed assignment retains previous primary office');
 await actor('office_manager','DELETE FROM public.action_items WHERE id=$1',[task]);await actor('staff','DELETE FROM public.notifications WHERE id=$1',[nid]);ok((await db.query('SELECT id FROM public.action_items WHERE id=$1',[task])).rows.length===0,'temporary task cleanup');
 ok((await db.query("SELECT tgenabled FROM pg_trigger WHERE tgname='trg_eod_approval_sync_analytics'")).rows[0].tgenabled==='D','unrelated analytics trigger stays disabled');
 console.log(JSON.stringify({group:'A',result:'PASS',checks,productionPermissionFixture:true,idempotence:true,rollback:true,network:false}));
}finally{await db.close();}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:e.message,stack:e.stack?.split('\n').slice(0,3)}));process.exitCode=1;});
