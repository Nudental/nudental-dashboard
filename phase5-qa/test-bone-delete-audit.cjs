const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 await db.exec("SET nudashboard.environment='qa';");const dir=path.join(__dirname,'repairs');for(const file of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-9]|2[0-2])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
 const a=crypto.randomUUID(),b=crypto.randomUUID(),actors={};await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / A'),($2,'QA / B')",[a,b]);
 for(const [label,role,office,active] of [['super','super_admin',a,true],['staff','staff',a,true],['admin_b','admin',b,true],['inactive','super_admin',a,false]]){
  const id=crypto.randomUUID();actors[label]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,`qa-${label}@nudashboard.example.test`]);await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=true,status='Active' WHERE id=$1",[id,role,office,active]);
 }
 const record=(await db.query("INSERT INTO bone_tissue_inventory(office_id,patient_name,procedure_date,product_name,identification_number,created_by,updated_by) VALUES($1,'QA TEMP','2027-01-10','QA Bone','QA-ID',$2,$2) RETURNING id",[a,actors.super])).rows[0].id;
 await db.query("UPDATE bone_tissue_inventory SET procedure_notes='QA v2' WHERE id=$1",[record]);
 await db.query("INSERT INTO bone_tissue_stock(product_name,identification_number,office_id,current_stock) VALUES('QA Bone','QA-ID',$1,10)",[a]);
 const prior=(await db.query('SELECT * FROM bone_tissue_audit_log WHERE record_id=$1 ORDER BY changed_at,id',[record])).rows;check('created and updated audits exist',prior.length===2);
 await db.exec('BEGIN;');let originalCode;try{await db.query('DELETE FROM bone_tissue_inventory WHERE id=$1',[record])}catch(error){originalCode=error.code}finally{await db.exec('ROLLBACK;')}
 check('original deletion fails its audit FK',originalCode==='23503');check('failed deletion preserves record',(await db.query('SELECT id FROM bone_tissue_inventory WHERE id=$1',[record])).rows.length===1);
 await db.exec(fs.readFileSync(path.join(dir,'023-bone-delete-audit-history.sql'),'utf8'));
 async function asActor(label,sql,params=[],commit=false){await db.exec('BEGIN; SET LOCAL ROLE authenticated;');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[label]]);const rows=(await db.query(sql,params)).rows;await db.exec(commit?'COMMIT;':'ROLLBACK;');return rows}catch(error){await db.exec('ROLLBACK;');throw error}}
 for(const actor of ['staff','admin_b','inactive'])check(actor+' cannot delete',(await asActor(actor,'DELETE FROM bone_tissue_inventory WHERE id=$1 RETURNING id',[record])).length===0);
 check('super-admin deletion succeeds',(await asActor('super','DELETE FROM bone_tissue_inventory WHERE id=$1 RETURNING id',[record],true)).length===1);
 check('deleted record absent',(await db.query('SELECT id FROM bone_tissue_inventory WHERE id=$1',[record])).rows.length===0);
 const after=(await db.query('SELECT * FROM bone_tissue_audit_log WHERE record_id=$1 ORDER BY changed_at,id',[record])).rows;
 check('prior audits and delete event retained',after.length===3);check('original audits unchanged',prior.every(old=>JSON.stringify(after.find(row=>row.id===old.id))===JSON.stringify(old)));
 const removed=after.find(row=>row.action==='deleted');check('delete snapshot retains original record ID',removed.old_values.id===record&&removed.record_id===record);check('delete snapshot retains latest note',removed.old_values.procedure_notes==='QA v2');check('deleted audit has no new values',removed.new_values===null);
 check('deleting usage record does not invent stock return',(await db.query('SELECT current_stock FROM bone_tissue_stock WHERE office_id=$1',[a])).rows[0].current_stock===10);
 check('second deletion is an empty no-op',(await asActor('super','DELETE FROM bone_tissue_inventory WHERE id=$1 RETURNING id',[record],true)).length===0);
 check('no duplicate delete audit',(await db.query("SELECT id FROM bone_tissue_audit_log WHERE record_id=$1 AND action='deleted'",[record])).rows.length===1);
 check('historical audit does not broaden other-office access',(await asActor('admin_b','SELECT id FROM bone_tissue_audit_log WHERE record_id=$1',[record])).length===0);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false}));
}finally{await db.close()}})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,180)}));process.exitCode=1});
