const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');await db.exec("SET nudashboard.environment='qa';");
 for(const f of fs.readdirSync(dir).filter(f=>/^\d{3}-.+\.sql$/.test(f)&&f<'029-').sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));
 for(const o of fixtures.offices)await db.query('INSERT INTO offices(id,name) VALUES($1,$2)',[o.id,o.name]);
 const actors={};
 for(const a of fixtures.actors){const id=crypto.randomUUID();actors[a.fixture_key]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,a.email]);await db.query('UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status=$6 WHERE id=$1',[id,a.role,a.office_id,a.is_active,a.is_approved,a.status]);}
 for(const p of fixtures.role_permissions.filter(p=>p.permission==='resources.inventory.monthly_supply.view'))await db.query('INSERT INTO role_permissions(role,permission,enabled) VALUES($1,$2,$3) ON CONFLICT(role,permission) DO UPDATE SET enabled=EXCLUDED.enabled',[p.role,p.permission,p.enabled]);
 async function asActor(actor,sql,params=[],commit=false){await db.exec('BEGIN; SET LOCAL ROLE authenticated;');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[actor]]);const rows=(await db.query(sql,params)).rows;await db.exec(commit?'COMMIT;':'ROLLBACK;');return rows}catch(e){await db.exec('ROLLBACK;');throw e}}
 const old=(await asActor('super_admin',"INSERT INTO supply_fulfillment_logs(office_id,item_name,supplied_by) VALUES('QA / Office A','QA old',$1) RETURNING id",[actors.super_admin],true))[0].id;
 check('original creation lacks audit',(await db.query('SELECT id FROM supply_audit_logs WHERE record_id=$1',[old])).rows.length===0);
 await db.exec(fs.readFileSync(path.join(dir,'029-supply-fulfillment-audit.sql'),'utf8'));
 check('no manufactured historical events',(await db.query('SELECT id FROM supply_audit_logs WHERE record_id=$1',[old])).rows.length===0);
 const row=(await asActor('super_admin',"INSERT INTO supply_fulfillment_logs(office_id,item_name,qty_supplied,supplied_by) VALUES('QA / Office A','QA TEMP',1,$1) RETURNING id",[actors.super_admin],true))[0].id;
 const read=async()=> (await db.query('SELECT * FROM supply_audit_logs WHERE record_id=$1 ORDER BY changed_at,id',[row])).rows;
 let audit=await read();check('one create audit',audit.length===1&&audit[0].action==='insert');check('actor server bound',audit[0].changed_by===actors.super_admin);check('create snapshot',audit[0].old_values===null&&audit[0].new_values.qty_supplied===1);
 await asActor('super_admin',"UPDATE supply_fulfillment_logs SET tracking_notes='QA edited' WHERE id=$1 RETURNING id",[row],true);
 audit=await read();check('update audit',audit.length===2);const edit=audit.find(a=>a.action==='update');check('before and after preserved',edit.old_values.tracking_notes==null&&edit.new_values.tracking_notes==='QA edited');
 await asActor('super_admin',"UPDATE supply_fulfillment_logs SET tracking_notes='QA edited' WHERE id=$1 RETURNING id",[row],true);check('unchanged write creates no duplicate audit',(await read()).length===2);
 for(const actor of Object.keys(actors))check(actor+' audit visibility',(await asActor(actor,'SELECT id FROM supply_audit_logs WHERE record_id=$1',[row])).length===(['super_admin','office_manager'].includes(actor)?2:0));
 for(const actor of ['super_admin','office_manager','staff']){let denied=false;try{await asActor(actor,"INSERT INTO supply_audit_logs(record_id,record_type,action,changed_by) VALUES($1,'supply_fulfillment_log','forged',$2)",[row,actors.super_admin])}catch(e){check(actor+' forged audit SQLSTATE',e.code==='42501');denied=true}check(actor+' cannot forge audit',denied)}
 // A failed audit must roll back the business row in the same transaction.
 await db.exec("ALTER TABLE supply_audit_logs ADD CONSTRAINT qa_test_audit_failure CHECK (record_type IS DISTINCT FROM 'supply_fulfillment_log') NOT VALID;");
 let failed=false;try{await asActor('super_admin',"UPDATE supply_fulfillment_logs SET qty_supplied=99 WHERE id=$1",[row],true)}catch(e){check('audit failure SQLSTATE',e.code==='23514');failed=true}check('audit failure stops mutation',failed);check('stock data preserved',(await db.query('SELECT qty_supplied FROM supply_fulfillment_logs WHERE id=$1',[row])).rows[0].qty_supplied===1);check('no partial audit',(await read()).length===2);
 await db.exec('ALTER TABLE supply_audit_logs DROP CONSTRAINT qa_test_audit_failure;');
 check('authorized deletion succeeds',(await asActor('super_admin','DELETE FROM supply_fulfillment_logs WHERE id=$1 RETURNING id',[row],true)).length===1);
 audit=await read();check('history survives deletion',audit.length===3);const del=audit.find(a=>a.action==='delete');check('delete snapshot preserved',del.new_values===null&&del.old_values.tracking_notes==='QA edited');
 for(const actor of ['super_admin','office_manager','office_manager_b','inactive_staff'])check(actor+' deleted history scope',(await asActor(actor,'SELECT id FROM supply_audit_logs WHERE record_id=$1',[row])).length===(['super_admin','office_manager'].includes(actor)?3:0));
 check('repeat deletion harmless',(await asActor('super_admin','DELETE FROM supply_fulfillment_logs WHERE id=$1 RETURNING id',[row],true)).length===0);check('repeat deletion no audit',(await read()).length===3);
 check('private trigger has no direct authenticated permission',(await db.query("SELECT has_function_privilege('authenticated','dashboard_qa.audit_supply_fulfillment()','EXECUTE') allowed")).rows[0].allowed===false);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1});
