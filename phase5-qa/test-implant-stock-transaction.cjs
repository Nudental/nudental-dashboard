const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),office=crypto.randomUUID(),actor=crypto.randomUUID(),checks=[];
 const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);};
 try{
  await db.exec("SET nudashboard.environment='qa';");
  const dir=path.join(__dirname,'repairs');for(const f of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-5])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
  await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / Stock')",[office]);
  await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'qa-stock@nudashboard.example.test','{}')",[actor]);
  await db.query("UPDATE user_profiles SET role='admin',office_id=$2,is_active=true,is_approved=true,status='Active' WHERE id=$1",[actor,office]);
  async function probe(repaired,initial,quantity){
   const id=crypto.randomUUID();await db.exec('BEGIN;');
   try{
    await db.query("INSERT INTO implant_inventory(id,office_id,identification_number,notes,quantity_in_stock,item_status) VALUES($1,$2,'QA-ID','QA TEMP stock',$3,'in_stock')",[id,office,initial]);
    await db.exec('SET LOCAL ROLE authenticated;');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actor]);
    await db.exec('SAVEPOINT usage_attempt;');let code=null;
    try{await db.query("INSERT INTO implant_usage_logs(office_id,implant_inventory_id,patient_name,procedure_notes,created_by) SELECT $1,$2,'QA. Synthetic','QA TEMP stock',$3 FROM generate_series(1,$4)",[office,id,actor,quantity]);}
    catch(e){code=e.code;await db.exec('ROLLBACK TO SAVEPOINT usage_attempt;');}
    await db.exec('RESET ROLE;');
    const row=(await db.query('SELECT quantity_in_stock,item_status FROM implant_inventory WHERE id=$1',[id])).rows[0];
    const count=Number((await db.query('SELECT count(*) AS n FROM implant_usage_logs WHERE implant_inventory_id=$1',[id])).rows[0].n);
    if(!repaired){check('original oversell silently clamps stock while adding excess usage',!code&&row.quantity_in_stock===0&&count===quantity);return;}
    if(quantity>initial){check('failed batch leaves stock intact',code==='23514'&&row.quantity_in_stock===initial);check('failed batch leaves no usage rows',count===0);}
    else{check('one deduction per usage unit '+quantity,!code&&row.quantity_in_stock===initial-quantity&&count===quantity);check('stock status agrees with remaining quantity '+quantity,row.item_status===(initial===quantity?'used':'in_stock'));}
   }finally{await db.exec('ROLLBACK;');}
  }
  await probe(false,1,2);
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/016-implant-stock-transaction.sql'),'utf8'));
  await probe(true,5,1);await probe(true,5,3);await probe(true,2,2);await probe(true,1,2);await probe(true,0,1);
  console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionConnected:false,fixturesRolledBack:true}));
 }finally{await db.close();}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,180)}));process.exitCode=1;});
