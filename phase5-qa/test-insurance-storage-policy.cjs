const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema(),checks=[];const check=(n,v)=>{assert.ok(v,n);checks.push(n)};try{
 const policy=fs.readFileSync(path.join(__dirname,'storage/insurance-verifications.sql'),'utf8');let rejected=false;
 try{await db.exec(policy)}catch(error){rejected=error.code==='P0001'}finally{await db.exec('ROLLBACK;')}check('non-QA installation rejected',rejected);
 await db.exec("SET nudashboard.environment='qa';");const dir=path.join(__dirname,'repairs');for(const f of fs.readdirSync(dir).filter(f=>/^\d{3}.*\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 await db.exec('CREATE SCHEMA storage;CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO authenticated,anon;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;');await db.exec(policy);
 const a=crypto.randomUUID(),b=crypto.randomUUID(),actors={};await db.query("INSERT INTO offices(id,name) VALUES($1,'QA A'),($2,'QA B')",[a,b]);
 for(const [name,role,office,active,approved] of [['manager','office_manager',a,true,true],['other','office_manager',b,true,true],['staff','staff',a,true,true],['inactive','office_manager',a,false,true],['unapproved','office_manager',a,true,false]]){const id=actors[name]=crypto.randomUUID();await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)",[id,`qa-${name}@nudashboard.example.test`]);await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status='Active' WHERE id=$1",[id,role,office,active,approved])}
 await db.query("INSERT INTO role_permissions(role,permission,enabled) VALUES('office_manager','workflow.insurance.view',true) ON CONFLICT(role,permission) DO UPDATE SET enabled=true");
 const r=(await db.query("INSERT INTO insurance_verification_requests(submission_date,requesting_staff_name,appointment_date,appointment_time,patient_first_name,patient_last_name,patient_dob,patient_phone,insurance_company_name,insurance_phone,member_id,status,office_id) VALUES('2026-09-15','QA TEMP','2027-01-10','09:00','QA TEMP','storage','2000-01-01','','QA MOCK','2025550123','QA-NOT-VALID','completed',$1) RETURNING id",[a])).rows[0].id;
 const v=(await db.query("INSERT INTO insurance_verifications(request_id,status) VALUES($1,'completed') RETURNING id",[r])).rows[0].id;const file=`verifications/${v}/QA.pdf`;
 await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('insurance-verifications',$1)",[file]);
 async function run(actor,sql,params=[]){await db.exec('BEGIN;SET LOCAL ROLE '+(actor==='anon'?'anon':'authenticated')+';');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[actors[actor]||'',actor==='anon'?'anon':'authenticated']);return(await db.query(sql,params)).rows}finally{await db.exec('ROLLBACK;')}}
 for(const actor of ['manager','other','staff','inactive','unapproved','anon']){
  const allowed=actor==='manager';check(actor+' read scope',(await run(actor,'SELECT id FROM storage.objects')).length===(allowed?1:0));
  check(actor+' update scope',(await run(actor,"UPDATE storage.objects SET metadata='{}' RETURNING id")).length===(allowed?1:0));
  check(actor+' delete scope',(await run(actor,'DELETE FROM storage.objects RETURNING id')).length===(allowed?1:0));
  let inserted=false;try{inserted=(await run(actor,"INSERT INTO storage.objects(bucket_id,name) VALUES('insurance-verifications',$1) RETURNING id",[file])).length===1}catch(error){assert.equal(error.code,'42501')}check(actor+' upload scope',inserted===allowed);
 }
 for(const bad of [`unknown/${v}/QA.pdf`,`verifications/${crypto.randomUUID()}/QA.pdf`,`verifications/${v}/nested/QA.pdf`,`verifications/${v}/QA.txt`]){let blocked=false;try{await run('manager',"INSERT INTO storage.objects(bucket_id,name) VALUES('insurance-verifications',$1)",[bad])}catch(error){blocked=error.code==='42501'}check('invalid path denied '+bad,blocked)}
 const draft=(await db.query("INSERT INTO insurance_verifications(request_id,status) VALUES($1,'draft') RETURNING id",[r])).rows[0].id;
 const draftFile=`verifications/${draft}/QA-draft.pdf`;await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('insurance-verifications',$1)",[draftFile]);
 check('draft PDFs are not readable',(await run('manager','SELECT id FROM storage.objects WHERE name=$1',[draftFile])).length===0);
 check('completed PDF remains readable without reopening its form',(await run('manager','SELECT id FROM storage.objects WHERE name=$1',[file])).length===1);
 check('probe operations leave both seeded objects unchanged',(await db.query('SELECT count(*)::int AS n FROM storage.objects')).rows[0].n===2);
 console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionConnected:false,storageSchema:'offline model; hosted Storage testing required'}));
}finally{await db.close()}})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,200)}));process.exitCode=1});
