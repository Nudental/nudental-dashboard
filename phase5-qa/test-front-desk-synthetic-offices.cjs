// Actual PostgreSQL enum/filter/constraint behavior; no hosted connection.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++};try{
 const dir=path.join(__dirname,'repairs');await db.exec("SET nudashboard.environment='qa';");
 for(const file of fs.readdirSync(dir).filter(f=>/^\d{3}-.+\.sql$/.test(f)&&f<'031-').sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
 const tables=['front_desk_inventory','front_desk_amazon_orders'];
 const policies=()=>db.query("SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE tablename IN ('front_desk_inventory','front_desk_amazon_orders') ORDER BY tablename,policyname");
 const originalPolicies=(await policies()).rows;
 for(const table of tables){let rejected=false;try{await db.query(`SELECT id FROM ${table} WHERE office_location=$1`,['QA / Office A'])}catch(e){check(table+' original invalid enum',e.code==='22P02');rejected=true}check(table+' original query fails',rejected)}
 await db.exec(fs.readFileSync(path.join(dir,'031-front-desk-synthetic-offices.sql'),'utf8'));
 check('existing role policies preserved',JSON.stringify((await policies()).rows)===JSON.stringify(originalPolicies));
 for(const table of tables){
  for(const office of ['QA / Office A','QA / Office B']){
   check(table+' synthetic filter accepted',(await db.query(`SELECT id FROM ${table} WHERE office_location=$1`,[office])).rows.length===0);
   const insert=table==='front_desk_inventory' ? "INSERT INTO front_desk_inventory(office_location,category,item_name,current_qty,min_required) VALUES($1,'General Office','QA TEMP',2,1) RETURNING office_location::text" : "INSERT INTO front_desk_amazon_orders(office_location,order_date,order_id,item_name,item_quantity) VALUES($1,'2026-09-16','QA TEMP','QA TEMP',1) RETURNING office_location::text";
   check(table+' synthetic write accepted',(await db.query(insert,[office])).rows[0].office_location===office);
   let rejected=false;try{await db.query(insert,['Nu Dental of Eatontown'])}catch(e){check(table+' production office constraint',e.code==='23514');rejected=true}check(table+' production office rejected',rejected);
  }
  check(table+' exactly two synthetic records',(await db.query(`SELECT id FROM ${table}`)).rows.length===2);
 }
 console.log(JSON.stringify({checks,passed:checks,productionConnected:false}));
}finally{await db.close()}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1});
