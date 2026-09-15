const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),actor=crypto.randomUUID(),office=crypto.randomUUID(),otherOffice=crypto.randomUUID(),huddle=crypto.randomUUID(),otherHuddle=crypto.randomUUID(),results=[];
 try{
  for(const id of [office,otherOffice])await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)',[id,'QA / Child audit office '+id.slice(0,8)]);
  await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[actor,'qa-huddle-audit@nudashboard.example.test',JSON.stringify({full_name:'QA Huddle Manager'})]);
  await db.query("UPDATE public.user_profiles SET role='office_manager',office_id=$2,is_active=true,is_approved=true,status='Active' WHERE id=$1",[actor,office]);
  await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[actor,office]);
  for(const [id,scope] of [[huddle,office],[otherHuddle,otherOffice]])await db.query("INSERT INTO public.huddles(id,office_id,huddle_date,status,notes_addendum) VALUES($1,$2,'2026-09-15','draft','QA TEMP child audit')",[id,scope]);
  await db.exec("SET nudashboard.environment='qa';");
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/002-office-workflow-boundary.sql'),'utf8'));
  async function write(sql,params){
   await db.exec('SET LOCAL ROLE authenticated;');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actor]);
   const result=await db.query(sql,params);await db.exec('RESET ROLE;');return result;
  }
  const cases=[
   ['huddle_provider_blocks',"INSERT INTO public.huddle_provider_blocks(id,huddle_id,block_order,block_type,provider_name) VALUES($1,$2,1,'doctor','QA initial') RETURNING id",'provider_name'],
   ['huddle_checklist_items',"INSERT INTO public.huddle_checklist_items(id,huddle_id,section,item_number,item_text,notes) VALUES($1,$2,'front_desk',1,'QA synthetic checklist','QA initial') RETURNING id",'notes'],
  ];
  async function probe(repaired){for(const [table,insert,field]of cases){
   const id=crypto.randomUUID(),crossId=crypto.randomUUID();await db.exec('BEGIN;');
   try{
    await write(insert,[id,huddle]);
    let audit=(await db.query('SELECT * FROM public.audit_logs WHERE table_name=$1 AND record_id=$2',[table,id])).rows;
    results.push({test:table+(repaired?' create audited once':' original gap'),pass:repaired?audit.length===1&&audit[0].action==='INSERT'&&audit[0].user_id===actor:audit.length===0});
    if(!repaired)continue;
    await write(`UPDATE public.${table} SET ${field}='QA revised' WHERE id=$1 RETURNING id`,[id]);
    audit=(await db.query("SELECT * FROM public.audit_logs WHERE table_name=$1 AND record_id=$2 AND action='UPDATE'",[table,id])).rows;
    results.push({test:table+' edit actor and old/new values',pass:audit.length===1&&audit[0].user_id===actor&&audit[0].old_values[field]==='QA initial'&&audit[0].new_values[field]==='QA revised'&&audit[0].changed_fields.includes(field)});
    await db.query(insert,[crossId,otherHuddle]);
    const before=(await db.query('SELECT id FROM public.audit_logs WHERE record_id=$1',[crossId])).rows.length;
    const denied=await write(`UPDATE public.${table} SET ${field}='QA denied' WHERE id=$1 RETURNING id`,[crossId]);
    const after=(await db.query('SELECT id FROM public.audit_logs WHERE record_id=$1',[crossId])).rows.length;
    results.push({test:table+' other-office write remains denied',pass:denied.rows.length===0&&before===after});
    await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
    await db.query(`DELETE FROM public.${table} WHERE id=$1`,[id]);
    audit=(await db.query('SELECT action,user_id,old_values FROM public.audit_logs WHERE table_name=$1 AND record_id=$2',[table,id])).rows;
    results.push({test:table+' cleanup retains three events',pass:audit.length===3&&audit.filter(e=>e.action==='DELETE'&&e.user_id===null&&e.old_values[field]==='QA revised').length===1});
   }finally{await db.exec('ROLLBACK;');}
  }}
  await probe(false);
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/007-huddle-child-audit-coverage.sql'),'utf8'));
  await probe(true);
  console.log(JSON.stringify({checks:results.length,passed:results.filter(r=>r.pass).length,results,productionConnected:false}));assert.ok(results.every(r=>r.pass));
 }finally{await db.close();}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1;});
