const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),actors={},results=[];
 const check=(test,ok)=>{results.push({test,pass:!!ok});assert.ok(ok,test);};
 try{
  await db.exec("SET nudashboard.environment='qa';");
  for(const role of ['admin','staff']){
   const id=actors[role]=crypto.randomUUID();
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,'qa-'+role+'@nudashboard.example.test',JSON.stringify({full_name:'QA '+role})]);
   await db.query("UPDATE public.user_profiles SET role=$2,is_active=true,is_approved=true,status='Active' WHERE id=$1",[id,role]);
  }
  async function write(role,sql,values){
   await db.exec('SET LOCAL ROLE authenticated;');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[role]]);
   try{return await db.query(sql,values);}finally{await db.exec('RESET ROLE;');}
  }
  const audit=(table,id)=>db.query('SELECT action,user_id,old_values,new_values,changed_fields FROM public.audit_logs WHERE table_name=$1 AND record_id=$2',[table,id]);
  async function probe(repaired){
   for(const suffix of ['companies','systems','platform_sizes','lengths','diameters']){
    const table='implant_'+suffix,key=['lengths','diameters'].includes(suffix)?'label':'name',id=crypto.randomUUID();
    await db.exec('BEGIN;');
    try{
     await write('admin',`INSERT INTO public.${table}(id,${key},created_by) VALUES($1,'QA TEMP lookup',$2)`,[id,actors.admin]);
     let rows=(await audit(table,id)).rows;
     check(table+(repaired?' creation actor and values':' original audit gap'),repaired?rows.length===1&&rows[0].action==='INSERT'&&rows[0].user_id===actors.admin&&rows[0].new_values[key]==='QA TEMP lookup':rows.length===0);
     if(!repaired)continue;
     await write('admin',`UPDATE public.${table} SET is_active=false WHERE id=$1`,[id]);
     rows=(await audit(table,id)).rows;let updated=rows.find(row=>row.action==='UPDATE');
     check(table+' archive audit',rows.length===2&&updated.user_id===actors.admin&&updated.old_values.is_active===true&&updated.new_values.is_active===false&&updated.changed_fields.includes('is_active'));
     const denied=await write('staff',`UPDATE public.${table} SET is_active=true WHERE id=$1 RETURNING id`,[id]);
     check(table+' staff denial unchanged',denied.rows.length===0&&(await audit(table,id)).rows.length===2);
     await write('admin',`UPDATE public.${table} SET is_active=true WHERE id=$1`,[id]);
     rows=(await audit(table,id)).rows;
     check(table+' restore audited once',rows.length===3&&rows.some(row=>row.action==='UPDATE'&&row.old_values.is_active===false&&row.new_values.is_active===true));
     await write('admin',`DELETE FROM public.${table} WHERE id=$1`,[id]);
     rows=(await audit(table,id)).rows;
     check(table+' cleanup audited',rows.length===4&&rows.some(row=>row.action==='DELETE'&&row.user_id===actors.admin&&row.old_values[key]==='QA TEMP lookup')&&(await db.query(`SELECT id FROM public.${table} WHERE id=$1`,[id])).rows.length===0);
    }finally{await db.exec('ROLLBACK;');}
   }
  }
  await probe(false);await db.exec(fs.readFileSync(path.join(__dirname,'repairs/015-implant-lookup-audit.sql'),'utf8'));await probe(true);
  console.log(JSON.stringify({checks:results.length,passed:results.filter(row=>row.pass).length,productionConnected:false,fixturesRolledBack:true}));
 }finally{await db.close();}
})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,200)}));process.exitCode=1;});
