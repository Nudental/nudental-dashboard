// Every QA migration must fail outside QA and coexist without changing data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),folder=path.join(__dirname,'repairs');
 const files=fs.readdirSync(folder).filter(name=>/^\d{3}.*\.sql$/.test(name)).sort();
 try{
  assert.equal(files.length,27);
  for(const file of files){
   let rejected=false;
   try{await db.exec(fs.readFileSync(path.join(folder,file),'utf8'));}
   catch(error){assert.equal(error.code,'P0001');rejected=true;}
   finally{await db.exec('ROLLBACK;');}
   assert.ok(rejected,file+' must reject non-QA installation');
  }
  await db.exec("SET nudashboard.environment='qa';");
  for(const file of files)await db.exec(fs.readFileSync(path.join(folder,file),'utf8'));
  assert.equal((await db.query("SELECT tgenabled FROM pg_trigger WHERE tgname='trg_eod_approval_sync_analytics'")).rows[0].tgenabled,'D');
  const counts=(await db.query('SELECT (SELECT count(*) FROM public.action_items)+(SELECT count(*) FROM public.huddles)+(SELECT count(*) FROM public.implant_inventory)+(SELECT count(*) FROM public.daily_entries) AS n')).rows[0];
  assert.equal(Number(counts.n),0);
  console.log(JSON.stringify({checks:files.length*2+2,passed:files.length*2+2,qaRepairsInstalled:files.length,productionConnected:false}));
 }finally{await db.close();}
})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,200)}));process.exitCode=1;});
