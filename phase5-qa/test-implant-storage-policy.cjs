const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),checks=[],actors={},offices=[crypto.randomUUID(),crypto.randomUUID()];
 const policy=fs.readFileSync(path.join(__dirname,'storage/implant-attachments.sql'),'utf8');
 const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);};
 try{
  let rejected=false;try{await db.exec(policy);}catch(e){rejected=e.code==='P0001';}finally{await db.exec('ROLLBACK;');}check('installation outside QA rejected',rejected);
  await db.exec("SET nudashboard.environment='qa';");
  const dir=path.join(__dirname,'repairs');for(const f of fs.readdirSync(dir).filter(f=>/^\d{3}.*\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
  await db.exec('CREATE SCHEMA storage;CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO authenticated,anon;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;');
  await db.exec(policy);await db.exec('BEGIN;');
  for(let n=0;n<2;n++)await db.query('INSERT INTO offices(id,name) VALUES($1,$2)',[offices[n],'QA / Office '+n]);
  for(const key of ['admin','staff','staff_b','inactive']){
   const id=actors[key]=crypto.randomUUID();await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,'qa-'+key+'@nudashboard.example.test','{}']);
   await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=true,status='Active' WHERE id=$1",[id,key==='admin'?'admin':'staff',offices[key==='staff_b'?1:0],key!=='inactive']);
   await db.query('INSERT INTO user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[id,offices[key==='staff_b'?1:0]]);
  }
  async function actorQuery(key,sql,values=[]){await db.exec('SAVEPOINT actor_operation;');await db.exec('SET LOCAL ROLE '+(key==='anon'?'anon':'authenticated'));await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[actors[key]||'',key==='anon'?'anon':'authenticated']);try{return await db.query(sql,values);}catch(e){await db.exec('ROLLBACK TO SAVEPOINT actor_operation;');throw e;}finally{await db.exec('RESET ROLE;RELEASE SAVEPOINT actor_operation;');}}
  const file=actors.admin+'/QA.pdf',other=actors.admin+'/other.pdf';
  await actorQuery('admin',"INSERT INTO storage.objects(bucket_id,name) VALUES('implant-attachments',$1)",[file]);check('admin uploads to own folder',true);
  check('uploader can read before inventory binding',(await actorQuery('admin','SELECT name FROM storage.objects')).rows.length===1);
  check('staff cannot read an unbound upload',(await actorQuery('staff','SELECT name FROM storage.objects')).rows.length===0);
  await db.query("INSERT INTO implant_inventory(office_id,attachment_url,notes) VALUES($1,$2,'QA TEMP storage')",[offices[0],file]);
  for(const [role,expected] of [['staff',1],['staff_b',0],['inactive',0],['anon',0]])check(role+' read follows active office scope',(await actorQuery(role,'SELECT name FROM storage.objects')).rows.length===expected);
  for(const [role,name,bucket] of [['staff',actors.staff+'/QA.pdf','implant-attachments'],['admin',actors.staff+'/QA.pdf','implant-attachments'],['admin',other,'other-bucket'],['inactive',actors.inactive+'/QA.pdf','implant-attachments']]){
   await db.exec('SAVEPOINT rejected_upload;');let denied=false;try{await actorQuery(role,'INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',[bucket,name]);}catch(e){denied=e.code==='42501';await db.exec('ROLLBACK TO SAVEPOINT rejected_upload;');}check(role+' invalid upload '+bucket+' rejected',denied);
  }
  check('staff cannot delete linked attachment',(await actorQuery('staff','DELETE FROM storage.objects WHERE name=$1 RETURNING name',[file])).rows.length===0);
  check('upsert updates remain unavailable',(await actorQuery('admin','UPDATE storage.objects SET name=$2 WHERE name=$1 RETURNING name',[file,other])).rows.length===0);
  check('original uploader can clean up own fixture',(await actorQuery('admin','DELETE FROM storage.objects WHERE name=$1 RETURNING name',[file])).rows.length===1);
  check('cleanup leaves no temporary objects',(await db.query('SELECT id FROM storage.objects')).rows.length===0);
  await db.exec('ROLLBACK;');console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionConnected:false,storageSchema:'minimal offline model; live Storage API still required',fixturesRolledBack:true}));
 }finally{await db.close();}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1;});
