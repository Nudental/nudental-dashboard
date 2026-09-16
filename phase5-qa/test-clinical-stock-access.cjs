const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');await db.exec("SET nudashboard.environment='qa';");
 for(const f of fs.readdirSync(dir).filter(f=>/^\d{3}-.+\.sql$/.test(f)&&f<'035-'&&!/^(032|034)-/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));
 for(const o of fixtures.offices)await db.query('INSERT INTO offices(id,name) VALUES($1,$2)',[o.id,o.name]);
 const actors={};for(const a of fixtures.actors){const id=crypto.randomUUID();actors[a.fixture_key]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,a.email]);await db.query('UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status=$6 WHERE id=$1',[id,a.role,a.office_id,a.is_active,a.is_approved,a.status]);}
 for(const p of fixtures.role_permissions.filter(p=>p.permission==='resources.inventory.monthly_supply.view'))await db.query('INSERT INTO role_permissions(role,permission,enabled) VALUES($1,$2,$3) ON CONFLICT(role,permission) DO UPDATE SET enabled=EXCLUDED.enabled',[p.role,p.permission,p.enabled]);
 const stockInsert="INSERT INTO office_supply_inventory(office_id,item_name,quantity_on_hand,last_updated_by) VALUES($1,'QA TEMP stock',4,$2) RETURNING id";
 const rowA=(await db.query(stockInsert,['QA / Office A',actors.office_manager])).rows[0].id,rowB=(await db.query(stockInsert,['QA / Office B',actors.office_manager_b])).rows[0].id;
 const historyInsert="INSERT INTO supply_inventory_history(inventory_id,office_id,old_qty,new_qty,change_qty,changed_by) VALUES($1,$2,3,4,1,$3) RETURNING id";
 await db.query(historyInsert,[rowA,'QA / Office A',actors.office_manager]);await db.query(historyInsert,[rowB,'QA / Office B',actors.office_manager_b]);
 async function asActor(actor,sql,params=[]){await db.exec('BEGIN; SET LOCAL ROLE '+(actor==='anonymous'?'anon':actor==='service'?'service_role':'authenticated')+';');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[actors[actor]||'',actor==='anonymous'?'anon':actor==='service'?'service_role':'authenticated']);return(await db.query(sql,params)).rows}finally{await db.exec('ROLLBACK;')}}
 async function denied(actor,sql,params){try{return(await asActor(actor,sql,params)).length===0}catch(e){check(actor+' permission denial code',e.code==='42501');return true}}
 const readStock='SELECT id FROM office_supply_inventory WHERE id=$1',readHistory='SELECT id FROM supply_inventory_history WHERE inventory_id=$1';
 for(const actor of Object.keys(actors)){check(actor+' original stock bypass',(await asActor(actor,readStock,[rowA])).length===1);check(actor+' original history bypass',(await asActor(actor,readHistory,[rowA])).length===1)}
 check('original cross-office insert bypass',(await asActor('office_manager_b',stockInsert,['QA / Office A',actors.office_manager_b])).length===1);
 await db.exec(fs.readFileSync(path.join(dir,'035-clinical-stock-access.sql'),'utf8'));
 for(const actor of [...Object.keys(actors),'anonymous']){const expected=['super_admin','office_manager'].includes(actor)?1:0;check(actor+' scoped stock',(await asActor(actor,readStock,[rowA])).length===expected);check(actor+' scoped history',(await asActor(actor,readHistory,[rowA])).length===expected);
  if(expected)check(actor+' own authenticated insert',(await asActor(actor,stockInsert,['QA / Office A',actors[actor]])).length===1);
  else check(actor+' insert denied',await denied(actor,stockInsert,['QA / Office A',actors[actor]||actors.staff]));
 }
 check('Office B reads own stock',(await asActor('office_manager_b',readStock,[rowB])).length===1);
 check('Office B reads own history',(await asActor('office_manager_b',readHistory,[rowB])).length===1);
 check('Office A adjustment stays authorized',(await asActor('office_manager','UPDATE office_supply_inventory SET quantity_on_hand=5,last_updated_by=$2 WHERE id=$1 RETURNING id',[rowA,actors.office_manager])).length===1);
 check('wrong-office adjustment denied',await denied('office_manager_b','UPDATE office_supply_inventory SET quantity_on_hand=5,last_updated_by=$2 WHERE id=$1 RETURNING id',[rowA,actors.office_manager_b]));
 check('stock actor spoof denied',await denied('office_manager',stockInsert,['QA / Office A',actors.super_admin]));
 check('audit actor spoof denied',await denied('office_manager',historyInsert,[rowA,'QA / Office A',actors.super_admin]));
 check('cross-office history denied',await denied('office_manager',historyInsert,[rowB,'QA / Office B',actors.office_manager]));
 check('mismatched history office denied',await denied('office_manager',historyInsert,[rowA,'QA / Office B',actors.office_manager]));
 check('authorized history insert preserved',(await asActor('office_manager',historyInsert,[rowA,'QA / Office A',actors.office_manager])).length===1);
 check('service cleanup still authorized',(await asActor('service','DELETE FROM office_supply_inventory WHERE id=$1 RETURNING id',[rowA])).length===1);
 check('all mutations rolled back',(await db.query('SELECT id FROM office_supply_inventory WHERE quantity_on_hand=4')).rows.length===2);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false,unappliedAccessCandidatesSkipped:['032','034']}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,200)}));process.exitCode=1});
