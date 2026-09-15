const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{const {db}=await openSchema();try{
 await db.exec("CREATE TABLE dashboard_qa.schema_installation(project_ref text,applied_batch integer); INSERT INTO dashboard_qa.schema_installation VALUES('hvtxjfayenqnwtaisoaw',26); SET nudashboard.environment='qa';");
 await db.exec(fs.readFileSync(path.join(__dirname,'repairs/001-profile-access-boundary.sql'),'utf8'));
 for(const [group,repaired,expectedFailures] of [['profile',true,0],['office',false,11],['office',true,0]]){
  if(group==='office'&&repaired)await db.exec(fs.readFileSync(path.join(__dirname,'repairs/002-office-workflow-boundary.sql'),'utf8'));
  const output=await db.exec(fs.readFileSync(path.join(__dirname,`hosted-${group}-probes.sql`),'utf8'));
  const rows=output.flatMap(x=>x.rows||[]).filter(x=>x.checkpoint);
  const failed=rows.filter(x=>x.result==='FAIL').length;
  assert.equal(failed,expectedFailures);assert.equal(rows.length,group==='profile'?11:17);
  const cleanup=(await db.query('SELECT (SELECT count(*) FROM auth.users)::int AS users,(SELECT count(*) FROM offices)::int AS offices')).rows[0];
  assert.deepEqual(cleanup,{users:0,offices:0});
  console.log(JSON.stringify({group,repaired,passed:rows.length-failed,failed,expectedFailures,cleanup,transport:'offline rehearsal only'}));
 }
}finally{await db.close();}})().catch(e=>{console.error(String(e.message).slice(0,400));process.exitCode=1;});
