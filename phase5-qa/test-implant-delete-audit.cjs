const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),actors={},checks=[],office=crypto.randomUUID();
 const check=(name,pass)=>{checks.push({name,pass});assert.ok(pass,name);};
 try{
  await db.exec("SET nudashboard.environment='qa';");
  const folder=path.join(__dirname,'repairs');
  for(const name of fs.readdirSync(folder).filter(n=>/^0(0[1-9]|1[0-6])-.*\.sql$/.test(n)).sort())await db.exec(fs.readFileSync(path.join(folder,name),'utf8'));
  for(const role of ['super_admin','staff']){
   const id=actors[role]=crypto.randomUUID();
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,'qa-'+role+'@nudashboard.example.test',JSON.stringify({full_name:'QA '+role})]);
   await db.query("UPDATE public.user_profiles SET role=$2,is_active=true,is_approved=true,status='Active' WHERE id=$1",[id,role]);
  }
  await db.query("INSERT INTO public.offices(id,name,is_active) VALUES($1,'QA / Delete Audit',true)",[office]);
  await db.query('UPDATE public.user_profiles SET office_id=$1 WHERE id IN ($2,$3)',[office,actors.super_admin,actors.staff]);
  async function asRole(role,sql,values){await db.exec('SET LOCAL ROLE authenticated;');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[role]]);try{return await db.query(sql,values);}finally{await db.exec('RESET ROLE;');}}
  const audit=id=>db.query("SELECT action,user_id,old_values,new_values FROM public.audit_logs WHERE table_name='implant_inventory' AND record_id=$1",[id]);
  async function probe(repaired){
   await db.exec('BEGIN;');const id=crypto.randomUUID();
   try{
    await db.query("INSERT INTO public.implant_inventory(id,office_id,identification_number,notes,quantity_in_stock) VALUES($1,$2,'QA TEMP deletion','QA TEMP deletion',3)",[id,office]);
    check('creation audit unchanged '+repaired,(await audit(id)).rows.length===0);
    const denied=await asRole('staff','DELETE FROM public.implant_inventory WHERE id=$1 RETURNING id',[id]);
    check('staff cannot delete or create delete audit '+repaired,denied.rows.length===0&&(await audit(id)).rows.length===0);
    const removed=await asRole('super_admin','DELETE FROM public.implant_inventory WHERE id=$1 RETURNING id',[id]);
    const rows=(await audit(id)).rows;
    assert.equal(removed.rows.length,1);
    check(repaired?'deleted row actor and prior state retained':'original deletion audit gap',repaired?rows.length===1&&rows[0].action==='DELETE'&&rows[0].user_id===actors.super_admin&&rows[0].old_values.quantity_in_stock===3&&rows[0].old_values.identification_number==='QA TEMP deletion'&&rows[0].new_values===null:rows.length===0);
    await asRole('super_admin','DELETE FROM public.implant_inventory WHERE id=$1',[id]);
    check('repeat delete adds no audit '+repaired,(await audit(id)).rows.length===(repaired?1:0));
   }finally{await db.exec('ROLLBACK;');}
  }
  await probe(false);await db.exec(fs.readFileSync(path.join(folder,'017-implant-delete-audit.sql'),'utf8'));await probe(true);
  console.log(JSON.stringify({checks:checks.length,passed:checks.length,fixturesRolledBack:true,productionConnected:false}));
 }finally{await db.close();}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1;});
