const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();const checks=[];const check=(name,ok)=>{assert.ok(ok,name);checks.push(name)};try{
 await db.exec("SET nudashboard.environment='qa';");const dir=path.join(__dirname,'repairs');
 for(const file of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-9]|20)-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
 const a=crypto.randomUUID(),b=crypto.randomUUID(),actors={};await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / A'),($2,'QA / B')",[a,b]);
 for(const [label,role,office,active,approved] of [['super','super_admin',a,true,true],['admin','admin',a,true,true],['manager','office_manager',a,true,true],['manager_b','office_manager',b,true,true],['staff','staff',a,true,true],['staff_b','staff',b,true,true],['inactive','staff',a,false,true],['unapproved','staff',a,true,false],['regional','regional_manager',a,true,true],['verifier','insurance_verifier',a,true,true]]){
  const id=crypto.randomUUID();actors[label]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,`qa-${label}@nudashboard.example.test`]);await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status='Active' WHERE id=$1",[id,role,office,active,approved]);
 }
 const insert="INSERT INTO bone_tissue_inventory(office_id,patient_name,procedure_date,product_name,identification_number,created_by,updated_by) VALUES($1,'QA TEMP','2027-01-10','QA MOCK','QA-ID',$2,$2) RETURNING id";
 const ra=(await db.query(insert,[a,actors.super])).rows[0].id,rb=(await db.query(insert,[b,actors.super])).rows[0].id;
 async function asActor(label,sql,params=[],role='authenticated'){
  await db.exec('BEGIN; SET LOCAL ROLE '+role+';');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[actors[label]||'',role]);return(await db.query(sql,params)).rows}finally{await db.exec('ROLLBACK;')}
 }
 check('original inactive account reads its office',(await asActor('inactive','SELECT id FROM bone_tissue_inventory')).length===1);
 check('original B staff reads A audit',(await asActor('staff_b','SELECT id FROM bone_tissue_audit_log WHERE record_id=$1',[ra])).length===1);
 await db.exec(fs.readFileSync(path.join(dir,'021-bone-inventory-access-boundary.sql'),'utf8'));
 for(const [actor,count] of [['super',2],['admin',1],['manager',1],['manager_b',1],['staff',1],['staff_b',1],['inactive',0],['unapproved',0],['regional',0],['verifier',0]])for(const table of ['bone_tissue_inventory','bone_tissue_audit_log'])check(actor+' read '+table,(await asActor(actor,'SELECT id FROM '+table)).length===count);
 for(const actor of ['manager_b','staff_b','inactive','unapproved','regional','verifier']){
  check(actor+' cannot change A record',(await asActor(actor,"UPDATE bone_tissue_inventory SET procedure_notes='QA probe' WHERE id=$1 RETURNING id",[ra])).length===0);
  let blocked=false;try{await asActor(actor,insert,[a,actors[actor]])}catch(error){blocked=error.code==='42501'}check(actor+' cannot insert A record',blocked);
 }
 for(const actor of ['staff','manager','admin']){
  check(actor+' own-office edit remains allowed',(await asActor(actor,"UPDATE bone_tissue_inventory SET procedure_notes='QA probe',updated_by=$2 WHERE id=$1 RETURNING id",[ra,actors[actor]])).length===1);
  check(actor+' own-office create remains allowed',(await asActor(actor,insert,[a,actors[actor]])).length===1);
 }
 let moved=false;try{await asActor('staff','UPDATE bone_tissue_inventory SET office_id=$1 WHERE id=$2',[b,ra])}catch(error){moved=error.code==='42501'}check('staff cannot move record to another office',moved);
 for(const table of ['bone_tissue_inventory','bone_tissue_audit_log'])check('anonymous denied '+table,(await asActor('','SELECT id FROM '+table,[],'anon')).length===0);
 check('fixture writes rolled back',(await db.query('SELECT procedure_notes FROM bone_tissue_inventory WHERE id=$1',[ra])).rows[0].procedure_notes==='');
 console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionConnected:false}));
}finally{await db.close()}})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,220)}));process.exitCode=1});
