const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');await db.exec("SET nudashboard.environment='qa';");
 // 032 remains an independently approved boundary; this repair does not depend on it.
 for(const f of fs.readdirSync(dir).filter(f=>/^\d{3}-.+\.sql$/.test(f)&&f<'032-').sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));
 for(const o of fixtures.offices)await db.query('INSERT INTO offices(id,name) VALUES($1,$2)',[o.id,o.name]);
 const actor=crypto.randomUUID();await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'catalog-audit@nudashboard.example.test','{}')",[actor]);await db.query("UPDATE user_profiles SET role='office_manager',office_id=$2,is_active=true,is_approved=true,status='Active' WHERE id=$1",[actor,fixtures.offices[0].id]);
 async function write(sql,params=[]){await db.exec('BEGIN; SET LOCAL ROLE authenticated;');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actor]);const rows=(await db.query(sql,params)).rows;await db.exec('COMMIT;');return rows}catch(e){await db.exec('ROLLBACK;');throw e}}
 const insert="INSERT INTO front_desk_inventory(office_location,category,item_name,current_qty,min_required) VALUES('QA / Office A','General Office','QA TEMP',5,1) RETURNING id";
 const original=(await write(insert))[0].id;
 const logs=id=>db.query("SELECT user_id,action,old_values,new_values,changed_fields FROM audit_logs WHERE table_name='front_desk_inventory' AND record_id=$1 ORDER BY created_at,id",[id]);
 check('original create has no audit',(await logs(original)).rows.length===0);
 await write('UPDATE front_desk_inventory SET current_qty=6 WHERE id=$1',[original]);check('original edit has no audit',(await logs(original)).rows.length===0);
 const policies=(await db.query("SELECT * FROM pg_policies WHERE tablename='audit_logs' ORDER BY policyname")).rows;
 await db.exec(fs.readFileSync(path.join(dir,'033-front-desk-catalog-audit.sql'),'utf8'));
 check('old history not fabricated',(await logs(original)).rows.length===0);
 check('audit access policies unchanged',JSON.stringify((await db.query("SELECT * FROM pg_policies WHERE tablename='audit_logs' ORDER BY policyname")).rows)===JSON.stringify(policies));
 const id=(await write(insert))[0].id;let audit=(await logs(id)).rows;
 check('create logged once',audit.length===1&&audit[0].action==='INSERT');check('actor recorded',audit[0].user_id===actor);check('new snapshot correct',audit[0].new_values.current_qty===5&&audit[0].new_values.office_location==='QA / Office A');check('create old snapshot absent',audit[0].old_values===null);
 await write('UPDATE front_desk_inventory SET current_qty=6 WHERE id=$1',[id]);audit=(await logs(id)).rows;check('edit logged once',audit.length===2&&audit[1].action==='UPDATE');check('before and after preserved',audit[1].old_values.current_qty===5&&audit[1].new_values.current_qty===6);check('changed field recorded',audit[1].changed_fields.includes('current_qty'));
 await write('UPDATE front_desk_inventory SET current_qty=6,updated_at=now() WHERE id=$1',[id]);check('identical replay adds no audit',(await logs(id)).rows.length===2);
 let failed=false;try{await write('UPDATE front_desk_inventory SET current_qty=NULL WHERE id=$1',[id])}catch(e){check('invalid edit rejected',e.code==='23502');failed=true}check('invalid edit fails',failed);check('failed edit preserves data',(await db.query('SELECT current_qty FROM front_desk_inventory WHERE id=$1',[id])).rows[0].current_qty===6);check('failed edit adds no audit',(await logs(id)).rows.length===2);
 check('owner cannot rewrite audit',(await write("UPDATE audit_logs SET action='QA forged' WHERE record_id=$1 RETURNING id",[id])).length===0);
 await write('DELETE FROM front_desk_inventory WHERE id=$1',[id]);audit=(await logs(id)).rows;check('delete logged once',audit.length===3&&audit[2].action==='DELETE');check('delete snapshot retained',audit[2].old_values.current_qty===6&&audit[2].new_values===null);check('deleted item absent',(await db.query('SELECT id FROM front_desk_inventory WHERE id=$1',[id])).rows.length===0);
 await write('DELETE FROM front_desk_inventory WHERE id=$1',[id]);check('delete retry adds no duplicate',(await logs(id)).rows.length===3);
 check('original unrelated row preserved',(await db.query('SELECT current_qty FROM front_desk_inventory WHERE id=$1',[original])).rows[0].current_qty===6);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1});
