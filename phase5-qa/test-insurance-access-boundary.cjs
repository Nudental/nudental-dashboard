const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();const checks=[];const check=(name,ok)=>{assert.ok(ok,name);checks.push(name)};try{
 await db.exec("SET nudashboard.environment='qa';");const dir=path.join(__dirname,'repairs');
 for(const file of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-9])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
 const a=crypto.randomUUID(),b=crypto.randomUUID(),actors={};
 await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / A'),($2,'QA / B')",[a,b]);
 for(const [label,role,office,active,approved] of [['super','super_admin',a,true,true],['admin','admin',a,true,true],['manager','office_manager',a,true,true],['manager_b','office_manager',b,true,true],['verifier','insurance_verifier',a,true,true],['staff','staff',a,true,true],['staff_b','staff',b,true,true],['inactive','office_manager',a,false,true],['unapproved','office_manager',a,true,false]]){
  const id=crypto.randomUUID();actors[label]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,`qa-${label}@nudashboard.example.test`]);await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status='Active' WHERE id=$1",[id,role,office,active,approved]);
 }
 for(const role of ['admin','office_manager','insurance_verifier'])await db.query("INSERT INTO role_permissions(role,permission,enabled) VALUES($1,'workflow.insurance.view',true) ON CONFLICT(role,permission) DO UPDATE SET enabled=true",[role]);
 async function request(office){return(await db.query("INSERT INTO insurance_verification_requests(submission_date,requesting_staff_name,appointment_date,appointment_time,patient_first_name,patient_last_name,patient_dob,patient_phone,insurance_company_name,insurance_phone,member_id,status,office_id) VALUES('2026-09-15','QA TEMP','2027-01-10','09:00','QA TEMP','scope-test','2000-01-01','','QA MOCK','2025550123','QA-NOT-VALID','in_progress',$1) RETURNING id",[office])).rows[0].id}
 const ra=await request(a),rb=await request(b);
 const va=(await db.query("INSERT INTO insurance_verifications(request_id,status,notes) VALUES($1,'draft','QA TEMP') RETURNING id",[ra])).rows[0].id;
 await db.query("INSERT INTO insurance_verifications(request_id,status,notes) VALUES($1,'draft','QA TEMP')",[rb]);
 for(const rid of [ra,rb])await db.query("INSERT INTO insurance_verification_audit_log(request_id,event_type) VALUES($1,'qa_test')",[rid]);
 async function asActor(label,sql,params=[],role='authenticated'){
  await db.exec('BEGIN; SET LOCAL ROLE '+role+';');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[actors[label]||'',role]);return(await db.query(sql,params)).rows}finally{await db.exec('ROLLBACK;')}
 }
 check('original staff can read both requests',(await asActor('staff','SELECT id FROM insurance_verification_requests')).length===2);
 check('original Office B manager can update Office A draft',(await asActor('manager_b',"UPDATE insurance_verifications SET notes='QA probe' WHERE id=$1 RETURNING id",[va])).length===1);
 await db.exec(fs.readFileSync(path.join(dir,'020-insurance-access-boundary.sql'),'utf8'));
 const tables=['insurance_verification_requests','insurance_verifications','insurance_verification_audit_log'];
 for(const [actor,count] of [['super',2],['admin',2],['manager',1],['manager_b',1],['verifier',1],['staff',0],['staff_b',0],['inactive',0],['unapproved',0]])for(const table of tables)check(actor+' read '+table,(await asActor(actor,'SELECT id FROM '+table)).length===count);
 for(const actor of ['manager_b','staff','inactive','unapproved']){
  check(actor+' cannot change A request',(await asActor(actor,"UPDATE insurance_verification_requests SET additional_notes='QA probe' WHERE id=$1 RETURNING id",[ra])).length===0);
  check(actor+' cannot change A draft',(await asActor(actor,"UPDATE insurance_verifications SET notes='QA probe' WHERE id=$1 RETURNING id",[va])).length===0);
  let blocked=false;try{await asActor(actor,"INSERT INTO insurance_verifications(request_id,status) VALUES($1,'draft')",[ra])}catch(error){blocked=error.code==='42501'}check(actor+' cannot insert A draft',blocked);
 }
 check('own office draft updates remain allowed',(await asActor('manager',"UPDATE insurance_verifications SET notes='QA probe' WHERE id=$1 RETURNING id",[va])).length===1);
 check('own office audit insert remains allowed',(await asActor('verifier',"INSERT INTO insurance_verification_audit_log(request_id,event_type,performed_by_user_id) VALUES($1,'qa_probe',$2) RETURNING id",[ra,actors.verifier])).length===1);
 let moved=false;try{await asActor('manager','UPDATE insurance_verification_requests SET office_id=$1 WHERE id=$2',[b,ra])}catch(error){moved=error.code==='42501'}check('request cannot move outside actor office',moved);
 let linked=false;try{await asActor('manager','UPDATE insurance_verifications SET request_id=$1 WHERE id=$2',[rb,va])}catch(error){linked=error.code==='42501'}check('draft cannot relink across offices',linked);
 for(const table of tables)check('anonymous blocked '+table,(await asActor('','SELECT id FROM '+table,[],'anon')).length===0);
 await db.query("UPDATE role_permissions SET enabled=false WHERE role='office_manager' AND permission='workflow.insurance.view'");check('revoked page permission removes API reads',(await asActor('manager','SELECT id FROM insurance_verification_requests')).length===0);
 check('original fixture data unchanged',(await db.query('SELECT notes FROM insurance_verifications WHERE id=$1',[va])).rows[0].notes==='QA TEMP');
 console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionConnected:false}));
}finally{await db.close()}})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,220)}));process.exitCode=1});
