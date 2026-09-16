const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 await db.exec("SET nudashboard.environment='qa';");const dir=path.join(__dirname,'repairs');for(const file of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-9]|2[01])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
 const a=crypto.randomUUID(),b=crypto.randomUUID(),actors={};await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / A'),($2,'QA / B')",[a,b]);
 for(const [label,role,office,active,approved] of [['super','super_admin',a,true,true],['admin','admin',a,true,true],['admin_b','admin',b,true,true],['manager','office_manager',a,true,true],['staff','staff',a,true,true],['inactive_admin','admin',a,false,true],['unapproved_admin','admin',a,true,false],['inactive_staff','staff',a,false,true],['unapproved_staff','staff',a,true,false],['regional','regional_manager',a,true,true]]){
  const id=crypto.randomUUID();actors[label]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,`qa-${label}@nudashboard.example.test`]);await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status='Active' WHERE id=$1",[id,role,office,active,approved]);
 }
 const insert="INSERT INTO bone_tissue_stock(product_name,identification_number,office_id,current_stock) VALUES('QA Bone','QA-ID',$1,10) RETURNING id";
 const stock=(await db.query(insert,[a])).rows[0].id;await db.query(insert,[b]);
 async function asActor(label,sql,params=[]){await db.exec('BEGIN; SET LOCAL ROLE authenticated;');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[label]]);return(await db.query(sql,params)).rows}finally{await db.exec('ROLLBACK;')}}
 check('original inactive staff reads stock',(await asActor('inactive_staff','SELECT id FROM bone_tissue_stock')).length===1);
 check('original unapproved admin updates stock',(await asActor('unapproved_admin','UPDATE bone_tissue_stock SET current_stock=11 WHERE id=$1 RETURNING id',[stock])).length===1);
 await db.exec(fs.readFileSync(path.join(dir,'022-bone-role-active-profile.sql'),'utf8'));
 for(const [actor,count] of [['super',2],['admin',1],['admin_b',1],['manager',1],['staff',1],['inactive_admin',0],['unapproved_admin',0],['inactive_staff',0],['unapproved_staff',0],['regional',0]])check(actor+' stock read',(await asActor(actor,'SELECT id FROM bone_tissue_stock')).length===count);
 for(const actor of ['inactive_admin','unapproved_admin','inactive_staff','unapproved_staff']){
  check(actor+' has no policy role',(await asActor(actor,'SELECT bti_get_user_role() AS role'))[0].role===null);
  check(actor+' stock update denied',(await asActor(actor,'UPDATE bone_tissue_stock SET current_stock=11 WHERE id=$1 RETURNING id',[stock])).length===0);
  let denied=false;try{await asActor(actor,insert,[a])}catch(error){denied=error.code==='42501'}check(actor+' stock create denied',denied);
 }
 for(const actor of ['admin_b','staff','manager'])check(actor+' cannot update A stock',(await asActor(actor,'UPDATE bone_tissue_stock SET current_stock=11 WHERE id=$1 RETURNING id',[stock])).length===0);
 check('active admin update remains allowed',(await asActor('admin','UPDATE bone_tissue_stock SET current_stock=11 WHERE id=$1 RETURNING id',[stock])).length===1);
 check('active admin create remains allowed',(await asActor('admin',insert.replace("'QA-ID'","'QA-NEW'"),[a])).length===1);
 check('fixture stock unchanged',(await db.query('SELECT current_stock FROM bone_tissue_stock WHERE id=$1',[stock])).rows[0].current_stock===10);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false}));
}finally{await db.close()}})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,180)}));process.exitCode=1});
