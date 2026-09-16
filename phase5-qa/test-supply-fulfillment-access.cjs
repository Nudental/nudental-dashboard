const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');await db.exec("SET nudashboard.environment='qa';");
 for(const f of fs.readdirSync(dir).filter(f=>/^\d{3}-.+\.sql$/.test(f)&&f<'028-').sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));
 for(const o of fixtures.offices)await db.query('INSERT INTO offices(id,name) VALUES($1,$2)',[o.id,o.name]);
 const actors={};
 for(const a of fixtures.actors){const id=crypto.randomUUID();actors[a.fixture_key]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,a.email]);await db.query('UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status=$6 WHERE id=$1',[id,a.role,a.office_id,a.is_active,a.is_approved,a.status]);}
 for(const p of fixtures.role_permissions.filter(p=>p.permission==='resources.inventory.monthly_supply.view'))await db.query('INSERT INTO role_permissions(role,permission,enabled) VALUES($1,$2,$3) ON CONFLICT(role,permission) DO UPDATE SET enabled=EXCLUDED.enabled',[p.role,p.permission,p.enabled]);
 const permissions=(await db.query('SELECT role,permission,enabled FROM role_permissions ORDER BY role,permission')).rows;
 const row=(await db.query("INSERT INTO supply_fulfillment_logs(office_id,item_name,qty_supplied,supplied_by) VALUES('QA / Office A','QA TEMP',1,$1) RETURNING id",[actors.super_admin])).rows[0].id;
 async function asActor(actor,sql,params=[]){await db.exec('BEGIN; SET LOCAL ROLE authenticated;');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[actor]]);return(await db.query(sql,params)).rows}finally{await db.exec('ROLLBACK;')}}
 for(const actor of Object.keys(actors))check(actor+' originally reads fulfillment',(await asActor(actor,'SELECT id FROM supply_fulfillment_logs WHERE id=$1',[row])).length===1);
 await db.exec(fs.readFileSync(path.join(dir,'028-supply-fulfillment-access-boundary.sql'),'utf8'));
 for(const actor of Object.keys(actors)){
  const visible=['super_admin','office_manager'].includes(actor);
  check(actor+' existing page and office boundary',(await asActor(actor,'SELECT id FROM supply_fulfillment_logs WHERE id=$1',[row])).length===(visible?1:0));
  check(actor+' existing write role preserved',(await asActor(actor,"UPDATE supply_fulfillment_logs SET tracking_notes='QA test' WHERE id=$1 RETURNING id",[row])).length===(actor==='super_admin'?1:0));
 }
 check('denied writes unchanged',(await db.query('SELECT tracking_notes FROM supply_fulfillment_logs WHERE id=$1',[row])).rows[0].tracking_notes==null);
 await db.query("UPDATE role_permissions SET enabled=true WHERE role='staff' AND permission='resources.inventory.monthly_supply.view'");
 check('same-office staff reads when granted section',(await asActor('staff','SELECT id FROM supply_fulfillment_logs')).length===1);
 for(const actor of ['staff_b','inactive_staff','unapproved_staff'])check(actor+' stays denied with page grant',(await asActor(actor,'SELECT id FROM supply_fulfillment_logs')).length===0);
 await db.query("UPDATE role_permissions SET enabled=false WHERE role='staff' AND permission='resources.inventory.monthly_supply.view'");
 await db.query("UPDATE role_permissions SET enabled=true WHERE role IN ('admin','regional_clinical_manager') AND permission='resources.inventory.monthly_supply.view'");
 for(const actor of ['admin','regional_clinical_manager'])check(actor+' authorized privileged write survives',(await asActor(actor,"UPDATE supply_fulfillment_logs SET tracking_notes='QA test' WHERE id=$1 RETURNING id",[row])).length===1);
 await db.query('UPDATE user_profiles SET is_active=false WHERE id=$1',[actors.admin]);
 check('inactive admin update denied',(await asActor('admin',"UPDATE supply_fulfillment_logs SET tracking_notes='QA test' WHERE id=$1 RETURNING id",[row])).length===0);
 let denied=false;try{await asActor('admin',"INSERT INTO supply_fulfillment_logs(office_id,item_name,supplied_by) VALUES('QA / Office A','QA denied',$1)",[actors.admin])}catch(e){check('inactive insert error code',e.code==='42501');denied=true}check('inactive admin insert denied',denied);
 await db.query("UPDATE role_permissions SET enabled=false WHERE role IN ('admin','regional_clinical_manager') AND permission='resources.inventory.monthly_supply.view'");
 assert.deepEqual((await db.query('SELECT role,permission,enabled FROM role_permissions ORDER BY role,permission')).rows,permissions);checks++;
 check('no duplicated records',(await db.query('SELECT id FROM supply_fulfillment_logs')).rows.length===1);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1});
