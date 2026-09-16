const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');await db.exec("SET nudashboard.environment='qa';");
 for(const f of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-9]|2[0-4])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));
 for(const o of fixtures.offices)await db.query('INSERT INTO offices(id,name) VALUES($1,$2)',[o.id,o.name]);
 const actors={};
 for(const a of fixtures.actors){const id=crypto.randomUUID();actors[a.fixture_key]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,a.email]);await db.query('UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status=$6 WHERE id=$1',[id,a.role,a.office_id,a.is_active,a.is_approved,a.status]);}
 for(const p of fixtures.role_permissions.filter(p=>['resources.inventory.front_desk.view','resources.inventory.monthly_supply.view'].includes(p.permission)))await db.query('INSERT INTO role_permissions(role,permission,enabled) VALUES($1,$2,$3) ON CONFLICT(role,permission) DO UPDATE SET enabled=EXCLUDED.enabled',[p.role,p.permission,p.enabled]);
 const permissions=(await db.query('SELECT role,permission,enabled FROM role_permissions ORDER BY role,permission')).rows;
 const batch=(await db.query("INSERT INTO supply_request_batches(office_id,request_month,requested_by,department_category) VALUES('QA / Office A','2026-09-01',$1,'Back Staff') RETURNING id",[actors.super_admin])).rows[0].id;
 const item=(await db.query("INSERT INTO supply_request_items(batch_id,office_id,custom_item_name,department_category) VALUES($1,'QA / Office A','QA TEMP','Back Staff') RETURNING id",[batch])).rows[0].id;
 async function asActor(actor,sql,params=[]){await db.exec('BEGIN; SET LOCAL ROLE authenticated;');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[actor]]);return(await db.query(sql,params)).rows}finally{await db.exec('ROLLBACK;')}}
 for(const actor of ['staff_b','office_manager_b','inactive_staff','unapproved_staff','marketing']){
  check(actor+' original broad batch read',(await asActor(actor,'SELECT id FROM supply_request_batches WHERE id=$1',[batch])).length===1);
  check(actor+' original broad item read',(await asActor(actor,'SELECT id FROM supply_request_items WHERE id=$1',[item])).length===1);
 }
 await db.exec(fs.readFileSync(path.join(dir,'025-supply-request-access-boundary.sql'),'utf8'));
 for(const actor of Object.keys(actors)){
  const expected=['super_admin','office_manager'].includes(actor)?1:0;
  check(actor+' batch read follows current permissions',(await asActor(actor,'SELECT id FROM supply_request_batches WHERE id=$1',[batch])).length===expected);
  check(actor+' item read follows parent',(await asActor(actor,'SELECT id FROM supply_request_items WHERE id=$1',[item])).length===expected);
  if(!expected){check(actor+' denied batch update',(await asActor(actor,"UPDATE supply_request_batches SET reviewer_notes='QA denied probe' WHERE id=$1 RETURNING id",[batch])).length===0);check(actor+' denied item update',(await asActor(actor,"UPDATE supply_request_items SET requested_qty=99 WHERE id=$1 RETURNING id",[item])).length===0);}
 }
 check('authorized super-admin still edits',(await asActor('super_admin','UPDATE supply_request_items SET requested_qty=3 WHERE id=$1 RETURNING id',[item])).length===1);
 check('rolled-back tests preserve quantity',(await db.query('SELECT requested_qty FROM supply_request_items WHERE id=$1',[item])).rows[0].requested_qty===1);
 // Account and office rules remain effective when page permission is enabled.
 await db.query("UPDATE role_permissions SET enabled=true WHERE role='staff' AND permission='resources.inventory.monthly_supply.view'");
 check('authorized office-A staff can read',(await asActor('staff','SELECT id FROM supply_request_batches')).length===1);
 for(const actor of ['staff_b','inactive_staff','unapproved_staff'])check(actor+' still denied with page grant',(await asActor(actor,'SELECT id FROM supply_request_batches')).length===0);
 await db.query("UPDATE role_permissions SET enabled=false WHERE role='staff' AND permission='resources.inventory.monthly_supply.view'");
 assert.deepEqual((await db.query('SELECT role,permission,enabled FROM role_permissions ORDER BY role,permission')).rows,permissions);checks++;
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1});
