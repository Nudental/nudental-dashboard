const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),offices=[crypto.randomUUID(),crypto.randomUUID()],actors={},inventory=offices.map(()=>crypto.randomUUID()),usage=offices.map(()=>crypto.randomUUID());
 try{
  await db.exec("SET nudashboard.environment='qa';");
  for(const file of ['001-profile-access-boundary.sql','002-office-workflow-boundary.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'repairs',file),'utf8'));
  for(let i=0;i<2;i++)await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)',[offices[i],'QA / Implant office '+i]);
  for(const [name,role,index,active,approved] of [['staff','staff',0,true,true],['manager_b','office_manager',1,true,true],['admin','admin',0,true,true],['inactive','staff',0,false,true],['unapproved','staff',0,true,false]]){
   const id=actors[name]=crypto.randomUUID();
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,`qa-${name}@nudashboard.example.test`,JSON.stringify({full_name:'QA '+name})]);
   await db.query("UPDATE public.user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=$5,status='Active' WHERE id=$1",[id,role,offices[index],active,approved]);
   await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[id,offices[index]]);
  }
  for(let i=0;i<2;i++){
   await db.query("INSERT INTO public.implant_inventory(id,office_id,quantity_in_stock,item_status,notes) VALUES($1,$2,5,'in_stock','QA TEMP inventory')",[inventory[i],offices[i]]);
   await db.query("INSERT INTO public.implant_usage_logs(id,office_id,procedure_notes,item_status) VALUES($1,$2,'QA TEMP usage','used')",[usage[i],offices[i]]);
  }
  async function transaction(role,fn){
   await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[role]]);
   try{return await fn();}finally{await db.exec('ROLLBACK;');}
  }
  async function run(){
   const results=[];
   for(const [table,ids] of [['implant_inventory',inventory],['implant_usage_logs',usage]]){
    for(const role of Object.keys(actors)){
     const expected=role==='admin'?ids:role==='staff'?[ids[0]]:role==='manager_b'?[ids[1]]:[];
     const rows=await transaction(role,async()=> (await db.query(`SELECT id FROM public.${table} ORDER BY id`)).rows.map(r=>r.id));
     results.push({test:table+' '+role+' read scope',pass:JSON.stringify(rows.sort())===JSON.stringify([...expected].sort())});
    }
   }
   for(const [name,role,index,linked,expected] of [
    ['own stock use','staff',0,inventory[0],true],
    ['other-office linked stock','staff',0,inventory[1],false],
    ['other-office usage insert','staff',1,inventory[1],false],
    ['inactive linked use','inactive',0,inventory[0],false],
    ['unapproved linked use','unapproved',0,inventory[0],false],
    ['unlinked own usage','staff',0,null,true],
    ['unlinked other-office usage','staff',1,null,false],
    ['authorized admin cross-office stock','admin',0,inventory[1],true],
    ['authorized other-office staff','manager_b',1,inventory[1],true],
   ]){
    let allowed=false,stock=5;
    await transaction(role,async()=>{
     await db.exec('SAVEPOINT attempt;');
     try{
      allowed=(await db.query("INSERT INTO public.implant_usage_logs(id,office_id,implant_inventory_id,procedure_notes,item_status,created_by) VALUES($1,$2,$3,'QA TEMP scope test','used',$4) RETURNING id",[crypto.randomUUID(),offices[index],linked,actors[role]])).rows.length===1;
     }catch(e){if(e.code!=='42501')throw e;await db.exec('ROLLBACK TO SAVEPOINT attempt;');}
     await db.exec('RESET ROLE;');
     if(linked)stock=(await db.query('SELECT quantity_in_stock FROM public.implant_inventory WHERE id=$1',[linked])).rows[0].quantity_in_stock;
    });
    results.push({test:name,pass:allowed===expected&&stock===(expected&&linked?4:5)});
   }
   for(const [role,expected] of [['staff',false],['admin',true]]){
    let allowed=false;
    await transaction(role,async()=>{try{allowed=(await db.query('UPDATE public.implant_inventory SET quantity_in_stock=9 WHERE id=$1 RETURNING id',[inventory[0]])).rows.length===1;}catch(e){if(e.code!=='42501')throw e;}});
    results.push({test:role+' retained inventory edit role',pass:allowed===expected});
   }
   return results;
  }
  const original=await run();assert.ok(original.filter(r=>!r.pass).length>=9);
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/012-implant-office-boundary.sql'),'utf8'));
  const repaired=await run();assert.ok(repaired.every(r=>r.pass),JSON.stringify(repaired.filter(r=>!r.pass)));
  assert.deepEqual((await db.query('SELECT quantity_in_stock FROM public.implant_inventory ORDER BY id')).rows,[{quantity_in_stock:5},{quantity_in_stock:5}]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.implant_usage_logs')).rows[0].n,2);
  console.log(JSON.stringify({originalDefectsReproduced:original.filter(r=>!r.pass).length,checks:repaired.length,passed:repaired.filter(r=>r.pass).length,temporaryWritesRolledBack:true,productionConnected:false}));
 }finally{await db.close();}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,250)}));process.exitCode=1;});
