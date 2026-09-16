const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');await db.exec("SET nudashboard.environment='qa';");
 for(const f of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-9]|2[0-6])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));
 for(const o of fixtures.offices)await db.query('INSERT INTO offices(id,name) VALUES($1,$2)',[o.id,o.name]);
 const actors={};for(const a of fixtures.actors){const id=crypto.randomUUID();actors[a.fixture_key]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,a.email]);await db.query('UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status=$6 WHERE id=$1',[id,a.role,a.office_id,a.is_active,a.is_approved,a.status]);}
 for(const p of fixtures.role_permissions.filter(p=>['resources.inventory.front_desk.view','resources.inventory.monthly_supply.view','request:front_desk_order','request:back_staff_order'].includes(p.permission)))await db.query('INSERT INTO role_permissions(role,permission,enabled) VALUES($1,$2,$3) ON CONFLICT(role,permission) DO UPDATE SET enabled=EXCLUDED.enabled',[p.role,p.permission,p.enabled]);
 async function actor(name){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[actors[name]]);await db.exec('SET ROLE authenticated');}
 async function save(name,batch,items){await actor(name);try{return(await db.query('SELECT public.save_supply_request_draft($1::jsonb,$2::jsonb) AS result',[JSON.stringify(batch),JSON.stringify(items)])).rows[0].result}finally{await db.exec('RESET ROLE')}}
 async function state(){return{batches:(await db.query('SELECT * FROM supply_request_batches ORDER BY id')).rows,items:(await db.query('SELECT * FROM supply_request_items ORDER BY id')).rows,audits:(await db.query('SELECT * FROM supply_audit_logs ORDER BY id')).rows}}
 const batch={office_id:'QA / Office A',request_month:'2026-09-01',request_type:'monthly',department_category:'Back Staff'};
 const line={department_id:'',subsection_id:'',item_id:'',custom_item_name:'QA TEMP',requested_qty:1,reason_notes:'v1'};
 const created=await save('super_admin',{...batch,requested_by:actors.staff},[line]);let snap=await state();
 check('one draft and one line created',snap.batches.length===1&&snap.items.length===1);
 check('requester cannot be spoofed',created.requested_by===actors.super_admin);
 check('optional UUIDs normalize to null',['department_id','subsection_id','item_id'].every(k=>snap.items[0][k]===null));
 check('creation has one actor-bound audit',snap.audits.length===1&&snap.audits[0].action==='draft_created'&&snap.audits[0].changed_by===actors.super_admin);
 check('audit contains custom item and quantity',snap.audits[0].new_values.items[0].custom_item_name==='QA TEMP'&&snap.audits[0].new_values.items[0].requested_qty===1);
 await save('super_admin',{...batch,id:created.id},[line]);assert.deepEqual(await state(),snap);checks++;
 const editedLine={...line,requested_qty:3,reason_notes:'v2'};await save('super_admin',{...batch,id:created.id},[editedLine]);snap=await state();
 check('edit retains one batch and one line',snap.batches.length===1&&snap.items.length===1&&snap.items[0].requested_qty===3);
 check('edit audit captures old and new notes',snap.audits.length===2&&snap.audits.some(a=>a.action==='draft_updated'&&a.old_values.items[0].reason_notes==='v1'&&a.new_values.items[0].reason_notes==='v2'));
 // FK failure occurs after the draft update/delete path; the full call rolls back.
 for(const id of [created.id,undefined]){
  let code;try{await save('super_admin',{...batch,id,request_month:id?batch.request_month:'2026-10-01'},[{...editedLine,item_id:crypto.randomUUID()}])}catch(e){code=e.code}
  check('unknown catalog item fails with FK constraint (received '+code+')',code==='23503');assert.deepEqual(await state(),snap);checks++;
 }
 let duplicateCode;try{await save('super_admin',batch,[line])}catch(e){duplicateCode=e.code}
 check('existing unique office/month/category still prevents duplicate creation',duplicateCode==='23505');assert.deepEqual(await state(),snap);checks++;
 for(const name of ['staff','admin','regional_manager','regional_clinical_manager','insurance_verifier','marketing','office_manager_b','inactive_staff','unapproved_staff','office_manager']){
  let code;try{await save(name,{...batch,id:created.id},[editedLine])}catch(e){code=e.code}
  check(name+' cannot save this clinical draft',code==='42501');assert.deepEqual(await state(),snap);checks++;
 }
 // Existing Office Manager Front Desk request permission still works.
 const front=await save('office_manager',{...batch,department_category:'Front Desk'},[{...line,custom_item_name:'QA TEMP Front Desk'}]);
 check('front-desk request uses existing permission',front.requested_by===actors.office_manager);
 const beforeCrossOffice=await state();let officeCode;try{await save('office_manager',{...batch,office_id:'QA / Office B',department_category:'Front Desk'},[line])}catch(e){officeCode=e.code}
 check('cross-office create denied',officeCode==='42501');assert.deepEqual(await state(),beforeCrossOffice);checks++;
 await db.query("UPDATE supply_request_batches SET batch_status='submitted' WHERE id=$1",[created.id]);const submitted=await state();let staleCode;
 try{await save('super_admin',{...batch,id:created.id},[line])}catch(e){staleCode=e.code}
 check('stale editor cannot revert submission',staleCode==='22023');assert.deepEqual(await state(),submitted);checks++;
 await db.query("UPDATE supply_request_batches SET batch_status='draft' WHERE id=$1",[created.id]);
 await db.exec('CREATE POLICY qa_test_deny_audit ON supply_audit_logs AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false)');
 const beforeAuditFailure=await state();let auditCode;try{await save('super_admin',{...batch,id:created.id},[{...line,reason_notes:'must roll back'}])}catch(e){auditCode=e.code}
 check('audit failure rejects the whole save',auditCode==='42501');assert.deepEqual(await state(),beforeAuditFailure);checks++;
 await db.exec('DROP POLICY qa_test_deny_audit ON supply_audit_logs');
 await actor('staff_b');check('other-office audit hidden',(await db.query('SELECT id FROM supply_audit_logs')).rows.length===0);await db.exec('RESET ROLE');
 await actor('office_manager');check('office manager sees both office-A histories',(await db.query('SELECT id FROM supply_audit_logs')).rows.length===3);await db.exec('RESET ROLE');
 check('anonymous cannot execute',!(await db.query("SELECT has_function_privilege('anon','public.save_supply_request_draft(jsonb,jsonb)','EXECUTE') AS allowed")).rows[0].allowed);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,220)}));process.exitCode=1});
