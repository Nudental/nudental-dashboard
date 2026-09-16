const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');await db.exec("SET nudashboard.environment='qa';");
 for(const f of fs.readdirSync(dir).filter(f=>/^\d{3}-.+\.sql$/.test(f)&&f<'032-').sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));
 for(const o of fixtures.offices)await db.query('INSERT INTO offices(id,name) VALUES($1,$2)',[o.id,o.name]);
 const actors={};
 for(const a of fixtures.actors){const id=crypto.randomUUID();actors[a.fixture_key]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,a.email]);await db.query('UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status=$6 WHERE id=$1',[id,a.role,a.office_id,a.is_active,a.is_approved,a.status]);}
 for(const p of fixtures.role_permissions.filter(p=>p.permission==='resources.inventory.front_desk.view'))await db.query('INSERT INTO role_permissions(role,permission,enabled) VALUES($1,$2,$3) ON CONFLICT(role,permission) DO UPDATE SET enabled=EXCLUDED.enabled',[p.role,p.permission,p.enabled]);
 const permissions=(await db.query('SELECT role,permission,enabled FROM role_permissions ORDER BY role,permission')).rows;
 const row=(await db.query("INSERT INTO front_desk_inventory(office_location,category,item_name,current_qty,min_required) VALUES('QA / Office A','General Office','QA TEMP',5,1) RETURNING id")).rows[0].id;
 async function asActor(actor,sql,params=[]){await db.exec('BEGIN; SET LOCAL ROLE authenticated;');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[actor]]);return(await db.query(sql,params)).rows}finally{await db.exec('ROLLBACK;')}}
 const query='SELECT id FROM front_desk_inventory WHERE id=$1';
 for(const actor of Object.keys(actors))check(actor+' original catalog scope',(await asActor(actor,query,[row])).length===(['staff','admin','super_admin','office_manager','regional_clinical_manager','inactive_staff','unapproved_staff'].includes(actor)?1:0));
 await db.exec(fs.readFileSync(path.join(dir,'032-front-desk-catalog-access.sql'),'utf8'));
 for(const actor of Object.keys(actors)){
  const visible=['super_admin','office_manager'].includes(actor);
  check(actor+' account page office scope',(await asActor(actor,query,[row])).length===(visible?1:0));
  check(actor+' writes obey same boundary',(await asActor(actor,'UPDATE front_desk_inventory SET current_qty=6 WHERE id=$1 RETURNING id',[row])).length===(visible?1:0));
 }
 check('rolled back checks preserve quantity',(await db.query('SELECT current_qty FROM front_desk_inventory WHERE id=$1',[row])).rows[0].current_qty===5);
 check('migration preserves permission settings',JSON.stringify((await db.query('SELECT role,permission,enabled FROM role_permissions ORDER BY role,permission')).rows)===JSON.stringify(permissions));
 await db.query("UPDATE role_permissions SET enabled=true WHERE role='staff' AND permission='resources.inventory.front_desk.view'");
 check('existing staff read with page grant',(await asActor('staff',query,[row])).length===1);
 check('existing staff quantity update with page grant',(await asActor('staff','UPDATE front_desk_inventory SET current_qty=6 WHERE id=$1 RETURNING id',[row])).length===1);
 for(const actor of ['staff_b','inactive_staff','unapproved_staff'])check(actor+' remains blocked despite page grant',(await asActor(actor,query,[row])).length===0);
 let denied=false;try{await asActor('office_manager',"INSERT INTO front_desk_inventory(office_location,category,item_name,current_qty,min_required) VALUES('QA / Office B','General Office','QA denied',1,1)")}catch(e){check('other-office insert error',e.code==='42501');denied=true}check('other-office insert denied',denied);
 await db.exec('BEGIN; SET LOCAL ROLE anon;');check('anonymous remains denied',(await db.query(query,[row])).rows.length===0);await db.exec('ROLLBACK;');
 check('no duplicated records',(await db.query('SELECT id FROM front_desk_inventory')).rows.length===1);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1});
