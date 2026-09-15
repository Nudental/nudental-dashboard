const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),a=crypto.randomUUID(),b=crypto.randomUUID(),dir=path.join(__dirname,'repairs');
 const actors={};const checks=[];const check=(name,ok)=>{assert.ok(ok,name);checks.push(name)};
 try{
  await db.exec("SET nudashboard.environment='qa';");
  for(const f of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-8])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
  await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / A'),($2,'QA / B')",[a,b]);
  for(const [label,role,office,active,approved] of [
   ['super_admin','super_admin',a,true,true],['admin','admin',a,true,true],['regional_manager','regional_manager',a,true,true],['regional_clinical_manager','regional_clinical_manager',a,true,true],
   ['office_manager','office_manager',a,true,true],['office_manager_b','office_manager',b,true,true],['staff','staff',a,true,true],['staff_b','staff',b,true,true],['marketing','marketing',a,true,true],['inactive','staff',a,false,true],['unapproved','staff',a,true,false]
  ]){
   const id=crypto.randomUUID();actors[label]=id;
   await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,`qa-${label}@nudashboard.example.test`]);
   await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status='Active' WHERE id=$1",[id,role,office,active,approved]);
  }
  await db.query("INSERT INTO office_goals(office_id,month_year,monthly_target,production_goal) VALUES($1,'2027-07',1000,1000),($2,'2027-07',2000,2000)",[a,b]);
  async function asActor(label,query,params=[],role='authenticated'){
   await db.exec('BEGIN; SET LOCAL ROLE '+role+';');
   try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[actors[label]||'',role]);return(await db.query(query,params)).rows}
   finally{await db.exec('ROLLBACK;')}
  }
  check('original broad policy leaks both offices to Office B staff',(await asActor('staff_b','SELECT office_id FROM office_goals')).length===2);
  const before=(await db.query('SELECT id,office_id,monthly_target,production_goal FROM office_goals ORDER BY id')).rows;
  await db.exec(fs.readFileSync(path.join(dir,'019-office-goal-read-boundary.sql'),'utf8'));
  for(const label of ['super_admin','admin','regional_manager','regional_clinical_manager'])check(label+' retains regional read',(await asActor(label,'SELECT id FROM office_goals')).length===2);
  for(const [label,office] of [['office_manager',a],['office_manager_b',b],['staff',a],['staff_b',b],['marketing',a]]){
   const rows=await asActor(label,'SELECT office_id FROM office_goals');check(label+' reads only own office',rows.length===1&&rows[0].office_id===office);
  }
  for(const label of ['inactive','unapproved'])check(label+' cannot read goals',(await asActor(label,'SELECT id FROM office_goals')).length===0);
  check('anonymous cannot read goals',(await asActor('','SELECT id FROM office_goals',[],'anon')).length===0);
  await db.query('INSERT INTO user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[actors.staff_b,a]);
  check('explicit additional-office access remains honored',(await asActor('staff_b','SELECT id FROM office_goals')).length===2);
  await db.query('DELETE FROM user_office_assignments WHERE user_id=$1',[actors.staff_b]);
  check('removing added office revokes its goal read',(await asActor('staff_b','SELECT id FROM office_goals')).length===1);
  check('Office B cannot update Office A goal',(await asActor('office_manager_b','UPDATE office_goals SET production_goal=9000 WHERE office_id=$1 RETURNING id',[a])).length===0);
  check('Office A manager retains existing own-office update',(await asActor('office_manager','UPDATE office_goals SET production_goal=9000 WHERE office_id=$1 RETURNING id',[a])).length===1);
  check('administrator retains update',(await asActor('admin','UPDATE office_goals SET production_goal=9000 WHERE office_id=$1 RETURNING id',[b])).length===1);
  check('ordinary staff cannot update own goal',(await asActor('staff','UPDATE office_goals SET production_goal=9000 WHERE office_id=$1 RETURNING id',[a])).length===0);
  check('installation and rolled-back probes preserve goal values',JSON.stringify((await db.query('SELECT id,office_id,monthly_target,production_goal FROM office_goals ORDER BY id')).rows)===JSON.stringify(before));
  console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionConnected:false}));
 }finally{await db.close()}
})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,200)}));process.exitCode=1});
