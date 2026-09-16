const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');await db.exec("SET nudashboard.environment='qa';");for(const f of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-9]|2[0-7])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const a=crypto.randomUUID(),b=crypto.randomUUID(),actors={};await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / Office A'),($2,'QA / Office B')",[a,b]);
 for(const [key,role,office,active] of [['super','super_admin',a,true],['manager','office_manager',a,true],['manager_b','office_manager',b,true],['inactive','super_admin',a,false]]){const id=crypto.randomUUID();actors[key]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,`qa-${key}@nudashboard.example.test`]);await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=true,status='Active' WHERE id=$1",[id,role,office,active]);}
 for(const permission of ['resources.inventory.front_desk.view','resources.inventory.monthly_supply.view','request:front_desk_order'])await db.query("INSERT INTO role_permissions(role,permission,enabled) VALUES('office_manager',$1,true) ON CONFLICT(role,permission) DO UPDATE SET enabled=true",[permission]);
 await db.query("INSERT INTO role_permissions(role,permission,enabled) VALUES('office_manager','request:back_staff_order',false) ON CONFLICT(role,permission) DO UPDATE SET enabled=false");
 async function call(who,sql,args){await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[actors[who]]);await db.exec('SET ROLE authenticated');try{return(await db.query(sql,args)).rows[0]?.result}finally{await db.exec('RESET ROLE')}}
 const batch={office_id:'QA / Office A',request_month:'2026-09-01',department_category:'Front Desk'},lines=[{custom_item_name:'QA TEMP',requested_qty:2}];
 const created=await call('manager','SELECT save_supply_request_draft($1::jsonb,$2::jsonb) AS result',[JSON.stringify(batch),JSON.stringify(lines)]);
 const submit=who=>call(who,'SELECT submit_supply_request_qa($1::uuid) AS result',[created.id]);
 async function state(){return{batch:(await db.query('SELECT * FROM supply_request_batches ORDER BY id')).rows,items:(await db.query('SELECT * FROM supply_request_items ORDER BY id')).rows,audits:(await db.query('SELECT * FROM supply_audit_logs ORDER BY id')).rows,intents:(await db.query('SELECT * FROM dashboard_qa.execution_intents ORDER BY id')).rows}}
 let before=await state();for(const actor of ['manager_b','inactive']){let code;try{await submit(actor)}catch(e){code=e.code}check(actor+' submit denied',code==='42501');assert.deepEqual(await state(),before);checks++;}
 await db.exec('CREATE POLICY qa_test_deny_submission_audit ON supply_audit_logs AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false)');let code;try{await submit('manager')}catch(e){code=e.code}
 check('audit failure rejects submission',code==='42501');assert.deepEqual(await state(),before);checks++;
 await db.exec('DROP POLICY qa_test_deny_submission_audit ON supply_audit_logs');
 const sent=await submit('manager');check('ordinary manager submits own front-desk request',sent.batch_status==='submitted'&&!!sent.submitted_at);
 const after=await state();check('one status audit records simulation',after.audits.length===2&&after.audits.some(x=>x.action==='status_submitted'&&x.changed_by===actors.manager&&x.new_values.notification_mode==='simulated'));
 check('two durable mock notification intents',after.intents.length===2&&after.intents.every(x=>x.mocked===true&&x.subject_id===created.id&&x.operation==='notification.simulate'));
 assert.deepEqual(after.intents.map(i=>i.adapter).sort(),['supply_email_qa','supply_sms_qa']);checks++;
 await submit('manager');assert.deepEqual(await state(),after);checks++;
 await db.query("UPDATE supply_request_batches SET batch_status='approved' WHERE id=$1",[created.id]);before=await state();code=null;try{await submit('manager')}catch(e){code=e.code}
 check('approved request cannot be resubmitted',code==='22023');assert.deepEqual(await state(),before);checks++;
 const empty=await call('super','SELECT save_supply_request_draft($1::jsonb,$2::jsonb) AS result',[JSON.stringify({...batch,department_category:'Back Staff'}),'[]']);before=await state();code=null;try{await call('super','SELECT submit_supply_request_qa($1::uuid) AS result',[empty.id])}catch(e){code=e.code}
 check('empty draft rejected',code==='22023');assert.deepEqual(await state(),before);checks++;
 const defs=(await db.query("SELECT pg_get_functiondef(oid) AS definition FROM pg_proc WHERE proname IN ('submit_supply_request_qa','dashboard_qa_supply_submission_intents')")).rows;
 check('simulation functions have no HTTP or provider invocation',defs.length===2&&defs.every(f=>!/(https?:|net\.http|http_post|dblink)/i.test(f.definition)));
 check('anonymous cannot execute',!(await db.query("SELECT has_function_privilege('anon','public.submit_supply_request_qa(uuid)','EXECUTE') AS allowed")).rows[0].allowed);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false,providerCalls:0}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,200)}));process.exitCode=1});
