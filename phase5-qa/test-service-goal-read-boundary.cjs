const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema(),dir=path.join(__dirname,'repairs'),a=crypto.randomUUID(),b=crypto.randomUUID(),actors={},checks=[];const check=(name,ok)=>{assert.ok(ok,name);checks.push(name)};try{
 await db.exec("SET nudashboard.environment='qa'");for(const f of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|[123][0-9]|4[01])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / A'),($2,'QA / B')",[a,b]);
 for(const [label,role,office,active,approved] of [['super_admin','super_admin',a,true,true],['admin','admin',a,true,true],['regional_manager','regional_manager',a,true,true],['regional_clinical_manager','regional_clinical_manager',a,true,true],['office_manager','office_manager',a,true,true],['office_manager_b','office_manager',b,true,true],['staff','staff',a,true,true],['staff_b','staff',b,true,true],['marketing','marketing',a,true,true],['insurance_verifier','insurance_verifier',a,true,true],['inactive','staff',a,false,true],['unapproved','staff',a,true,false]]){
  const id=crypto.randomUUID();actors[label]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,`qa-goal-${label}@nudashboard.example.test`]);await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status='Active' WHERE id=$1",[id,role,office,active,approved]);
 }
 await db.query("INSERT INTO service_category_goals(office_id,month_year,service_category,net_production_goal) VALUES($1,'2027-01','QA TEMP Preventive',1150),($2,'2027-01','QA TEMP Preventive',2300)",[a,b]);
 async function run(label,sql,params=[],role='authenticated'){await db.exec('BEGIN;SET LOCAL ROLE '+role);try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[actors[label]||'',role]);return(await db.query(sql,params)).rows}finally{await db.exec('ROLLBACK')}}
 for(const role of ['staff_b','office_manager_b'])check('original '+role+' sees wrong office',(await run(role,'SELECT id FROM service_category_goals WHERE office_id=$1',[a])).length===1);
 const before=(await db.query('SELECT * FROM service_category_goals ORDER BY id')).rows;
 await db.exec(fs.readFileSync(path.join(dir,'042-service-goal-read-boundary.sql'),'utf8'));
 for(const role of ['super_admin','admin','regional_manager','regional_clinical_manager'])check(role+' retains regional visibility',(await run(role,'SELECT id FROM service_category_goals')).length===2);
 for(const [role,office] of [['office_manager',a],['office_manager_b',b],['staff',a],['staff_b',b],['marketing',a],['insurance_verifier',a]]){const rows=await run(role,'SELECT office_id FROM service_category_goals');check(role+' retains only permitted office',rows.length===1&&rows[0].office_id===office)}
 for(const role of ['inactive','unapproved'])check(role+' denied',(await run(role,'SELECT id FROM service_category_goals')).length===0);
 check('anonymous denied',(await run('','SELECT id FROM service_category_goals',[],'anon')).length===0);
 await db.query('INSERT INTO user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[actors.staff_b,a]);check('explicit assignment honored',(await run('staff_b','SELECT id FROM service_category_goals')).length===2);
 await db.query('DELETE FROM user_office_assignments WHERE user_id=$1',[actors.staff_b]);check('revocation immediate',(await run('staff_b','SELECT id FROM service_category_goals')).length===1);
 for(const role of ['super_admin','admin'])check(role+' original write retained',(await run(role,'UPDATE service_category_goals SET net_production_goal=0 WHERE office_id=$1 RETURNING id',[b])).length===1);
 for(const role of ['office_manager','staff','staff_b'])check(role+' cannot update goals',(await run(role,'UPDATE service_category_goals SET net_production_goal=0 RETURNING id')).length===0);
 check('all fixture contents unchanged',JSON.stringify((await db.query('SELECT * FROM service_category_goals ORDER BY id')).rows)===JSON.stringify(before));
 console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionConnected:false}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,200)}));process.exitCode=1});
