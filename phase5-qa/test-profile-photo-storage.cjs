const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),checks=[],actors={};
 const policy=fs.readFileSync(path.join(__dirname,'storage/profile-photos.sql'),'utf8');
 const check=(name,ok)=>{assert.ok(ok,name);checks.push(name)};
 try{
  let rejected=false;try{await db.exec(policy)}catch(e){rejected=e.code==='P0001'}finally{await db.exec('ROLLBACK;')}check('non-QA installation rejected',rejected);
  await db.exec("SET nudashboard.environment='qa';");const dir=path.join(__dirname,'repairs');for(const f of fs.readdirSync(dir).filter(f=>/^\d{3}.*\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
  await db.exec('CREATE SCHEMA storage;CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO authenticated,anon;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;');
  await db.exec(policy);await db.exec('BEGIN;');
  for(const key of ['super_admin','admin','staff','other','inactive','unapproved']){const id=actors[key]=crypto.randomUUID();await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,'qa-'+key+'@nudashboard.example.test','{}']);await db.query("UPDATE user_profiles SET role=$2,is_active=$3,is_approved=$4,status='Active' WHERE id=$1",[id,['admin','super_admin'].includes(key)?key:'staff',key!=='inactive',key!=='unapproved'])}
  async function actorQuery(key,sql,values=[]){await db.exec('SAVEPOINT actor_operation;SET LOCAL ROLE '+(key==='anon'?'anon':'authenticated'));await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[actors[key]||'',key==='anon'?'anon':'authenticated']);try{return await db.query(sql,values)}catch(e){await db.exec('ROLLBACK TO SAVEPOINT actor_operation;');throw e}finally{await db.exec('RESET ROLE;RELEASE SAVEPOINT actor_operation;')}}
  const photo=actors.staff+'/qa.png';
  await actorQuery('staff',"INSERT INTO storage.objects(bucket_id,name) VALUES('profile-photos',$1)",[photo]);check('ordinary active profile uploads its own photo',true);
  for(const role of ['staff','other','admin','super_admin','inactive','unapproved','anon']){const visible=(await actorQuery(role,'SELECT name FROM storage.objects')).rows;check(role+' existing authenticated read boundary',visible.length===(['staff','other','admin','super_admin'].includes(role)?1:0))}
  for(const [role,name,bucket] of [['other',photo,'profile-photos'],['admin',photo,'profile-photos'],['inactive',actors.inactive+'/qa.png','profile-photos'],['unapproved',actors.unapproved+'/qa.png','profile-photos'],['anon',photo,'profile-photos'],['staff',photo,'other-bucket'],['super_admin',photo,'other-bucket']]){let denied=false;try{await actorQuery(role,'INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',[bucket,name])}catch(e){denied=e.code==='42501'}check(role+' rejects invalid upload '+bucket+' '+name.split('/').length,denied)}
  check('owner can upsert its own object',(await actorQuery('staff','UPDATE storage.objects SET name=name WHERE name=$1 RETURNING name',[photo])).rows.length===1);
  for(const role of ['other','admin','inactive','unapproved','anon']){check(role+' cannot modify another photo',(await actorQuery(role,'UPDATE storage.objects SET name=name WHERE name=$1 RETURNING name',[photo])).rows.length===0);check(role+' cannot remove another photo',(await actorQuery(role,'DELETE FROM storage.objects WHERE name=$1 RETURNING name',[photo])).rows.length===0)}
  let denied=false;try{await actorQuery('staff','UPDATE storage.objects SET name=$2 WHERE name=$1',[photo,actors.other+'/stolen.png'])}catch(e){denied=e.code==='42501'}check('owner cannot move file into another identity',denied);
  await actorQuery('super_admin',"INSERT INTO storage.objects(bucket_id,name) VALUES('profile-photos',$1)",[actors.other+'/admin-managed.png']);check('existing Super Admin creates another profile photo',true);
  check('existing Super Admin updates another profile photo',(await actorQuery('super_admin','UPDATE storage.objects SET name=name WHERE name=$1 RETURNING name',[actors.other+'/admin-managed.png'])).rows.length===1);
  check('existing Super Admin removes another profile photo',(await actorQuery('super_admin','DELETE FROM storage.objects WHERE name=$1 RETURNING name',[actors.other+'/admin-managed.png'])).rows.length===1);
  check('owner can remove its own photo',(await actorQuery('staff','DELETE FROM storage.objects WHERE name=$1 RETURNING name',[photo])).rows.length===1);
  check('no photo fixture remains',(await db.query('SELECT id FROM storage.objects')).rows.length===0);
  await db.exec('ROLLBACK;');console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionConnected:false,fixturesRolledBack:true}));
 }finally{await db.close()}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1});
