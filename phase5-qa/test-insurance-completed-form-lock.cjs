const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema(),checks=[],check=(name,ok)=>{assert.ok(ok,name);checks.push(name)};try{
 await db.exec("SET nudashboard.environment='qa'");const dir=path.join(__dirname,'repairs');
 for(const file of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|[123][0-9]|40)-.*\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
 const office=crypto.randomUUID(),actors={};await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / Lock Office')",[office]);
 for(const role of ['super_admin','admin','office_manager','insurance_verifier','staff']){
  const id=crypto.randomUUID();actors[role]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,`qa-lock-${role}@nudashboard.example.test`]);await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=true,is_approved=true,status='Active' WHERE id=$1",[id,role,office]);
  if(role!=='staff')await db.query("INSERT INTO role_permissions(role,permission,enabled) VALUES($1,'workflow.insurance.view',true) ON CONFLICT(role,permission) DO UPDATE SET enabled=true",[role]);
 }
 const rid=(await db.query("INSERT INTO insurance_verification_requests(submission_date,requesting_staff_name,appointment_date,appointment_time,patient_first_name,patient_last_name,patient_dob,patient_phone,insurance_company_name,insurance_phone,member_id,status,office_id) VALUES('2026-09-16','QA TEMP','2027-01-10','09:00','QA TEMP','lock-test','2000-01-01','','QA MOCK','2025550123','QA-NOT-VALID','completed',$1) RETURNING id",[office])).rows[0].id;
 const vid=(await db.query("INSERT INTO insurance_verifications(request_id,status,notes,patient_name,completed_at) VALUES($1,'completed','QA original','QA TEMP lock-test','2026-09-16') RETURNING id",[rid])).rows[0].id;
 async function asActor(role,sql,params=[],commit=false){await db.exec('BEGIN; SET LOCAL ROLE authenticated;');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[role]]);const rows=(await db.query(sql,params)).rows;await db.exec(commit?'COMMIT;':'ROLLBACK;');return rows}catch(e){await db.exec('ROLLBACK;');throw e}}
 for(let i=0;i<2;i++)check('completed form bypass reproduces '+i,(await asActor('office_manager',"UPDATE insurance_verifications SET notes='QA bypass' WHERE id=$1 RETURNING notes",[vid]))[0].notes==='QA bypass');
 await db.exec(fs.readFileSync(path.join(dir,'041-insurance-completed-form-lock.sql'),'utf8'));
 const before=(await db.query('SELECT to_jsonb(v) AS row FROM insurance_verifications v WHERE id=$1',[vid])).rows[0].row;
 for(const role of ['super_admin','admin','office_manager','insurance_verifier']){
  let rejected=false;try{await asActor(role,"UPDATE insurance_verifications SET notes='QA bypass' WHERE id=$1 RETURNING id",[vid])}catch(e){check(role+' rejects with lock error',e.code==='23514');rejected=true}check(role+' completed notes immutable',rejected);
 }
 for(const assignment of ["status='draft'","patient_name='QA changed'","yearly_max=2000","form_data='{\"qa_changed\":true}'::jsonb","completed_at=now()","completed_by_name='QA forged'","office='QA changed'","request_id=NULL"]){let rejected=false;try{await asActor('office_manager','UPDATE insurance_verifications SET '+assignment+' WHERE id=$1 RETURNING id',[vid])}catch(e){check(assignment+' lock SQLSTATE',e.code==='23514');rejected=true}check(assignment+' denied',rejected)}
 check('all failed writes preserve entire completed row',JSON.stringify((await db.query('SELECT to_jsonb(v) AS row FROM insurance_verifications v WHERE id=$1',[vid])).rows[0].row)===JSON.stringify(before));
 check('staff still cannot update through existing page gate',(await asActor('staff',"UPDATE insurance_verifications SET notes='QA bypass' WHERE id=$1 RETURNING id",[vid])).length===0);
 for(const assignment of ["pdf_storage_path='QA/test.pdf',pdf_generated_at=now(),pdf_checksum_sha256='qa-digest'","office_emailed_at=now(),office_email_to='qa-office@nudashboard.example.test'","chart_upload_status='manual_uploaded',manual_chart_uploaded_at=now(),manual_chart_upload_note='QA tracking only'","updated_at=now()","notes='QA original'"]){check('existing tracking/no-op stays available '+assignment,(await asActor('office_manager','UPDATE insurance_verifications SET '+assignment+' WHERE id=$1 RETURNING id',[vid])).length===1)}
 const draft=(await db.query("INSERT INTO insurance_verifications(request_id,status,notes) VALUES($1,'draft','QA draft') RETURNING id",[rid])).rows[0].id;
 check('draft edit remains available',(await asActor('office_manager',"UPDATE insurance_verifications SET notes='QA edited' WHERE id=$1 RETURNING notes",[draft],true))[0].notes==='QA edited');
 check('draft completion remains available',(await asActor('office_manager',"UPDATE insurance_verifications SET status='completed',completed_at=now() WHERE id=$1 RETURNING status",[draft],true))[0].status==='completed');
 let stale=false;try{await asActor('office_manager',"UPDATE insurance_verifications SET notes='QA stale draft' WHERE id=$1",[draft])}catch(e){stale=e.code==='23514'}check('stale draft save after completion is rejected',stale);
 check('trigger function is not directly executable by client',(await db.query("SELECT has_function_privilege('authenticated','dashboard_qa.guard_completed_insurance_form()','EXECUTE') AS allowed")).rows[0].allowed===false);
 console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionConnected:false}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,220)}));process.exitCode=1});
