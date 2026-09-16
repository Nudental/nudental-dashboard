const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');await db.exec("SET nudashboard.environment='qa';");for(const f of fs.readdirSync(dir).filter(f=>/^\d{3}-.+\.sql$/.test(f)&&f<'039-'&&!/^(032|034|035)-/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'synthetic-role-fixtures.json'),'utf8'));for(const o of fixtures.offices)await db.query('INSERT INTO offices(id,name) VALUES($1,$2)',[o.id,o.name]);
 const actors={};for(const a of fixtures.actors){const id=crypto.randomUUID();actors[a.fixture_key]=id;await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,a.email]);await db.query('UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status=$6 WHERE id=$1',[id,a.role,a.office_id,a.is_active,a.is_approved,a.status]);}
 for(const p of fixtures.role_permissions.filter(p=>p.permission==='resources.inventory.monthly_supply.view'))await db.query('INSERT INTO role_permissions(role,permission,enabled) VALUES($1,$2,$3) ON CONFLICT(role,permission) DO UPDATE SET enabled=EXCLUDED.enabled',[p.role,p.permission,p.enabled]);
 async function asActor(actor,sql,params=[],commit=false){await db.exec('BEGIN;SET LOCAL ROLE '+(actor==='anonymous'?'anon':'authenticated')+';');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[actors[actor]||'',actor==='anonymous'?'anon':'authenticated']);const rows=(await db.query(sql,params)).rows;await db.exec(commit?'COMMIT;':'ROLLBACK;');return rows}catch(e){await db.exec('ROLLBACK;');throw e}}
 const create='INSERT INTO urgent_supply_requests(office_id,custom_item_name,reason,requested_by) VALUES($1,$2,\'QA only\',$3) RETURNING *';
 const a=(await asActor('super_admin',create,['QA / Office A','QA TEMP scope A',actors.super_admin],true))[0],b=(await asActor('super_admin',create,['QA / Office B','QA TEMP scope B',actors.super_admin],true))[0];
 for(const actor of Object.keys(actors))check(actor+' reproduces original unrestricted read',(await asActor(actor,'SELECT id FROM urgent_supply_requests WHERE id=$1',[a.id])).length===1);
 const snapshot=async()=>({requests:(await db.query('SELECT * FROM urgent_supply_requests ORDER BY id')).rows,audits:(await db.query('SELECT * FROM supply_audit_logs ORDER BY id')).rows,intents:(await db.query('SELECT * FROM dashboard_qa.execution_intents ORDER BY id')).rows});const before=await snapshot();
 await db.exec(fs.readFileSync(path.join(dir,'039-urgent-request-access-boundary.sql'),'utf8'));
 check('install changes no records, audits or simulations',JSON.stringify(await snapshot())===JSON.stringify(before));
 for(const actor of [...Object.keys(actors),'anonymous']){
  const allowedA=['super_admin','office_manager'].includes(actor),allowedB=['super_admin','office_manager_b'].includes(actor);
  check(actor+' Office A read',(await asActor(actor,'SELECT id FROM urgent_supply_requests WHERE id=$1',[a.id])).length===(allowedA?1:0));check(actor+' Office B read',(await asActor(actor,'SELECT id FROM urgent_supply_requests WHERE id=$1',[b.id])).length===(allowedB?1:0));
  check(actor+' existing reviewer write scope',(await asActor(actor,'UPDATE urgent_supply_requests SET notes=notes WHERE id=$1 RETURNING id',[a.id])).length===(actor==='super_admin'?1:0));
 }
 check('read/no-op matrix preserves exact state',JSON.stringify(await snapshot())===JSON.stringify(before));
 for(const actor of Object.keys(actors)){
  let saved=false;try{const rows=await asActor(actor,create,['QA / Office A','QA TEMP create '+actor,actors[actor]]);saved=rows.length===1}catch(e){check(actor+' denied insert SQLSTATE',e.code==='42501')}
  check(actor+' can insert only with Office A page access',saved===['super_admin','office_manager'].includes(actor));
 }
 const own=(await asActor('office_manager',create,['QA / Office A','QA TEMP own',actors.office_manager],true))[0];check('authorized office owner still creates request',own.requested_by===actors.office_manager);
 check('existing owner update remains supported',(await asActor('office_manager',"UPDATE urgent_supply_requests SET notes='QA metadata' WHERE id=$1 RETURNING id",[own.id],true)).length===1);
 let moved=false;try{await asActor('office_manager',"UPDATE urgent_supply_requests SET office_id='QA / Office B' WHERE id=$1",[own.id],true);moved=true}catch(e){check('cross-office move rejected SQLSTATE',e.code==='42501')}check('cannot move request outside office scope',!moved);
 check('authorized cleanup remains supported',(await asActor('super_admin','DELETE FROM urgent_supply_requests WHERE id=$1 RETURNING id',[own.id],true)).length===1);
 check('existing audit history survives cleanup',(await asActor('office_manager','SELECT id FROM supply_audit_logs WHERE record_id=$1',[own.id])).length===3);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false,unappliedAccessCandidatesSkipped:['032','034','035']}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,220)}));process.exitCode=1});
