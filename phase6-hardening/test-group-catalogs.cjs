const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {openSchema}=require(path.join(process.env.PHASE5_QA_DIR,'offline_database.cjs'));
const {snapshot,rollback}=require('./catalog.cjs');
(async()=>{const {db}=await openSchema();const results=[];try{
 // These two repairs are already in production; they are not part of this release.
 for(const name of ['001-implant-stock-transaction.sql','002-receipt-columns.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../production-release',name),'utf8'));
 for(const name of fs.readdirSync(path.join(__dirname,'migrations')).sort()){
  const before=await snapshot(db),sql=fs.readFileSync(path.join(__dirname,'migrations',name),'utf8');
  assert.ok(!sql.includes('dashboard_qa')&&!sql.includes('execution_intents'),'QA implementation excluded');
  await db.exec(sql);const after=await snapshot(db);await db.exec(sql);assert.deepEqual(await snapshot(db),after,'repeatable '+name);
  await db.exec(rollback(before,after));assert.deepEqual(await snapshot(db),before,'rollback '+name);
  await db.exec(sql);assert.deepEqual((await snapshot(db)).tables,before.tables,'table grants/owners/RLS unchanged '+name);
  for(const old of before.functions){const curr=after.functions.find(x=>x.name===old.name&&x.args===old.args);assert.equal(curr?.owner,old.owner);assert.equal(curr?.acl,old.acl);}
  results.push({group:name,idempotence:'PASS',rollback:'PASS',ownersGrants:'PASS'});
 }
 console.log(JSON.stringify({result:'PASS',groups:results,network:false}));
}finally{await db.close();}})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,500)}));process.exitCode=1;});
