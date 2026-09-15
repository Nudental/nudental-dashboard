const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),office=crypto.randomUUID(),other=crypto.randomUUID(),actors={};
 try{
  await db.exec("SET nudashboard.environment='qa';");
  for(const file of ['001-profile-access-boundary.sql','002-office-workflow-boundary.sql'])
   await db.exec(fs.readFileSync(path.join(__dirname,'repairs',file),'utf8'));
  for(const id of [office,other])await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)',[id,'QA / Huddle review office '+id.slice(0,8)]);
  for(const role of ['staff','office_manager','admin','super_admin','regional_manager','regional_clinical_manager']){
   const id=actors[role]=crypto.randomUUID();
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,`qa-${role}@nudashboard.example.test`,JSON.stringify({full_name:'QA '+role})]);
   await db.query("UPDATE public.user_profiles SET role=$2,office_id=$3,is_active=true,is_approved=true,status='Active' WHERE id=$1",[id,role,office]);
   await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[id,office]);
  }
  const cases=[
   ['manager approval','office_manager','submitted',{status:'approved'},false],
   ['manager rejection','office_manager','submitted',{status:'rejected'},false],
   ['staff approval','staff','submitted',{status:'approved'},false],
   ['staff rejection','staff','submitted',{status:'rejected'},false],
   ['manager approval identity','office_manager','submitted',{approved_by:actors.admin},false],
   ['manager approval time','office_manager','submitted',{approved_at:'2026-09-15T12:00:00Z'},false],
   ['manager rejection reason','office_manager','submitted',{rejection_reason:'QA TEMP reason'},false],
   ['staff approval identity','staff','submitted',{approved_by:actors.admin},false],
   ['manager clears reviewed status','office_manager','approved',{status:'draft'},false],
   ['manager unlocks rejected status','office_manager','rejected',{status:'unlocked'},false],
   ['manager preapproved insert','office_manager','insert',{status:'approved'},false],
   ['manager rejected insert','office_manager','insert',{status:'rejected'},false],
   ['manager insert review metadata','office_manager','insert',{status:'draft',approved_by:actors.admin},false],
   ['manager draft submission','office_manager','draft',{status:'submitted',submitted_by:actors.office_manager},true],
   ['manager unlocked submission','office_manager','unlocked',{status:'submitted',submitted_by:actors.office_manager},true],
   ['manager submitted unlock','office_manager','submitted',{status:'unlocked'},true],
   ['manager ordinary content edit','office_manager','submitted',{prev_day_right:'QA TEMP allowed edit'},true],
   ['staff ordinary draft edit','staff','draft',{prev_day_right:'QA TEMP allowed edit'},true],
   ['manager ordinary insert','office_manager','insert',{status:'draft'},true],
   ['manager other-office scope','office_manager','submitted',{status:'approved'},false,other],
  ];
  for(const role of ['admin','super_admin','regional_manager','regional_clinical_manager']){
   cases.push([role+' approval',role,'submitted',{status:'approved',approved_by:actors[role]},true]);
   cases.push([role+' rejection',role,'submitted',{status:'rejected',rejection_reason:'QA TEMP review reason'},true]);
   cases.push([role+' reviewed unlock',role,'approved',{status:'unlocked'},true]);
  }
  async function run(){
   const results=[];
   for(const [name,role,status,changes,expected,scope=office] of cases){
    const id=crypto.randomUUID(),keys=Object.keys(changes),values=Object.values(changes);let allowed=false;
    await db.exec('BEGIN;');
    try{
     if(status!=='insert')await db.query("INSERT INTO public.huddles(id,office_id,huddle_date,status,created_by,notes_addendum) VALUES($1,$2,'2026-09-17',$3,$4,'QA TEMP Huddle review')",[id,scope,status,actors.office_manager]);
     await db.exec('SET LOCAL ROLE authenticated;');
     await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[role]]);
     if(status==='insert'){
      allowed=(await db.query(`INSERT INTO public.huddles(id,office_id,huddle_date,created_by,notes_addendum,${keys.join(',')}) VALUES($1,$2,'2026-09-17',$3,'QA TEMP Huddle review',${keys.map((_,i)=>'$'+(i+4)).join(',')}) RETURNING id`,[id,scope,actors[role],...values])).rows.length===1;
     }else allowed=(await db.query(`UPDATE public.huddles SET ${keys.map((key,i)=>key+'=$'+(i+1)).join(',')} WHERE id=$${keys.length+1} RETURNING id`,[...values,id])).rows.length===1;
    }catch(error){if(error.code!=='42501')throw error;}
    finally{await db.exec('ROLLBACK;');}
    results.push({test:name,pass:allowed===expected});
   }
   return results;
  }
  const original=await run();assert.equal(original.filter(r=>!r.pass).length,13);
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/011-huddle-review-permission.sql'),'utf8'));
  const repaired=await run();assert.ok(repaired.every(r=>r.pass),JSON.stringify(repaired.filter(r=>!r.pass)));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.huddles')).rows[0].n,0);
  console.log(JSON.stringify({originalDefectsReproduced:13,checks:repaired.length,passed:repaired.filter(r=>r.pass).length,fixturesRolledBack:true,productionConnected:false}));
 }finally{await db.close();}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,250)}));process.exitCode=1;});
