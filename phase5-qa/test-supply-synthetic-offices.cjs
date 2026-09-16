const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');
 await db.exec("SET nudashboard.environment='qa';");
 for(const f of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-9]|2[0-3])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const names=['chk_osi_office_id','chk_order_requests_office_name','chk_sfl_office_id','chk_sih_office_id','chk_srb_office_id','chk_sri_office_id','chk_usr_office_id'];
 async function constraints(){return(await db.query('SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname=ANY($1) ORDER BY conname',[names])).rows}
 async function accepts(c,value){const expression=c.definition.slice(6);const column=c.conname==='chk_order_requests_office_name'?'office_name':'office_id';return(await db.query(`SELECT (${expression}) AS allowed FROM (SELECT $1::text AS ${column}) fixture`,[value])).rows[0].allowed}
 const before=await constraints();check('all seven copied constraints present',before.length===7);
 for(const c of before){check(c.conname+' originally rejects synthetic office',await accepts(c,'QA / Office A')===false);check(c.conname+' originally accepts production label',await accepts(c,'Nu Dental of Brick')===true)}
 const policies=await db.query('SELECT * FROM pg_policies ORDER BY schemaname,tablename,policyname');
 const migration=fs.readFileSync(path.join(dir,'024-supply-synthetic-offices.sql'),'utf8');
 await db.exec("SET nudashboard.environment='production';");let blocked=false;
 try{await db.exec(migration)}catch(e){blocked=e.message.includes('isolated Dashboard QA');await db.exec('ROLLBACK;')}
 check('migration rejects non-QA environment',blocked);
 assert.deepEqual(await constraints(),before);checks++;
 await db.exec("SET nudashboard.environment='qa';");await db.exec(migration);
 const after=await constraints();check('same seven constraints retained',after.length===7);
 for(const c of after){
  for(const value of ['QA / Office A','QA / Office B'])check(c.conname+' accepts '+value,await accepts(c,value)===true);
  for(const value of ['Nu Dental of Brick','Nu Dental of Eatontown','Nu Dental of Barnegat','Nu Dental of Staten Island','QA / Office C',''])check(c.conname+' rejects '+value,await accepts(c,value)===false);
  check(c.conname+' retains nullable semantics',await accepts(c,null)===null);
 }
 assert.deepEqual(await db.query('SELECT * FROM pg_policies ORDER BY schemaname,tablename,policyname'),policies);checks++;
 const row=(await db.query("INSERT INTO supply_request_batches(office_id,request_month,department_category) VALUES('QA / Office A','2026-09-01','Back Staff') RETURNING id")).rows[0];
 check('synthetic draft inserts into real schema',!!row.id);
 check('synthetic line inserts with valid optional nulls',(await db.query("INSERT INTO supply_request_items(batch_id,office_id,custom_item_name,department_category) VALUES($1,'QA / Office A','QA TEMP','Back Staff') RETURNING id",[row.id])).rows.length===1);
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1});
