const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),offices=[crypto.randomUUID(),crypto.randomUUID()],actors={};
 try{
  await db.exec("SET nudashboard.environment='qa';");
  for(const file of ['001-profile-access-boundary.sql','002-office-workflow-boundary.sql','003-eod-audit-coverage.sql','004-eod-insert-boundary.sql','005-eod-workflow-integrity.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'repairs',file),'utf8'));
  for(const [index,id] of offices.entries())await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)',[id,'QA / History Office '+index]);
  for(const [key,role,active,approved,office] of [
   ['staff','staff',true,true,0],['staff_b','staff',true,true,1],['manager','office_manager',true,true,0],
   ['regional','regional_manager',true,true,0],['clinical','regional_clinical_manager',true,true,0],
   ['admin','admin',true,true,0],['super','super_admin',true,true,0],
   ['inactive','staff',false,true,0],['unapproved','staff',true,false,0],
  ]){
   const actor=actors[key]={id:crypto.randomUUID(),role,name:'QA History '+key,email:'qa-history-'+key+'@nudashboard.example.test'};
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[actor.id,actor.email,JSON.stringify({full_name:actor.name})]);
   await db.query("UPDATE public.user_profiles SET role=$2::public.user_role,office_id=$3,is_active=$4,is_approved=$5,status='Active' WHERE id=$1",[actor.id,role,offices[office],active,approved]);
   await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[actor.id,offices[office]]);
  }
  const cases=[
   ['staff forged approver','staff','regional',0,null,null,false],['staff own history','staff','staff',0,null,null,false],
   ['manager own history','manager','manager',0,null,null,false],['staff cross-office','staff','staff',1,null,null,false],
   ['regional forged actor','regional','super',0,null,null,false],['regional forged role','regional','regional',0,'super_admin',null,false],
   ['regional forged name','regional','regional',0,null,'QA Other Reviewer',false],
   ['inactive flag with legacy Active status','inactive','inactive',0,null,null,false],['unapproved history','unapproved','unapproved',0,null,null,false],
  ];
  for(const key of ['regional','clinical','admin','super'])cases.push([key+' valid history',key,key,0,null,null,true]);
  for(const key of ['regional','clinical','admin','super'])cases.push([key+' existing all-office access',key,key,1,null,null,true]);
  async function run(){const results=[];for(const [name,actorKey,claimedKey,office,role,nameOverride,expected] of cases){
   const id=crypto.randomUUID(),actor=actors[actorKey],claimed=actors[claimedKey];let allowed=false;
   await db.exec('BEGIN;');
   try{
    await db.query("INSERT INTO public.daily_entries(id,office_id,submitted_by,entry_date,status,notes) VALUES($1,$2,$3,'2026-09-11','approved','QA TEMP history')",[id,offices[office],actors[office?'staff_b':'staff'].id]);
    await db.exec('SET LOCAL ROLE authenticated;');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actor.id]);
    await db.query("INSERT INTO public.eod_status_history(entry_id,from_status,to_status,changed_by,changer_name,changer_role,note,event_type) VALUES($1,'pending','approved',$2,$3,$4,'QA TEMP history','approval')",[id,claimed.id,nameOverride||claimed.name,role||claimed.role]);
    await db.exec('RESET ROLE;');allowed=(await db.query('SELECT id FROM public.eod_status_history WHERE entry_id=$1',[id])).rows.length===1;
   }catch(error){if(error.code!=='42501')throw error;}finally{await db.exec('ROLLBACK;');}
   results.push({name,allowed,pass:allowed===expected});
  }return results;}
  // The legacy helper ignores is_active, so the intentionally inconsistent
  // inactive flag/Active status is an eighth offline bypass beyond the live seven.
  const original=await run();assert.equal(original.filter(r=>!r.pass).length,8,original.filter(r=>!r.pass).map(r=>r.name).join(', '));
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/006-eod-history-identity.sql'),'utf8'));
  const repaired=await run();assert.ok(repaired.every(r=>r.pass),JSON.stringify(repaired.filter(r=>!r.pass)));
  // Existing history reads remain governed by the unchanged select policy.
  const readCases=[];
  for(const [key,office,expected] of [['staff',0,true],['staff',1,false],['manager',0,true],['manager',1,false],['regional',1,true],['inactive',0,false],['unapproved',0,false]]){
   const id=crypto.randomUUID();await db.exec('BEGIN;');
   try{
    await db.query("INSERT INTO public.daily_entries(id,office_id,submitted_by,entry_date,status,notes) VALUES($1,$2,$3,'2026-09-11','approved','QA TEMP history read')",[id,offices[office],actors[office?'staff_b':'staff'].id]);
    await db.query("INSERT INTO public.eod_status_history(entry_id,to_status,changed_by,changer_name,changer_role) VALUES($1,'approved',$2,$3,'regional_manager')",[id,actors.regional.id,actors.regional.name]);
    await db.exec('SET LOCAL ROLE authenticated;');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[key].id]);
    const allowed=(await db.query('SELECT id FROM public.eod_status_history WHERE entry_id=$1',[id])).rows.length===1;
    assert.equal(allowed,expected,key+' office '+office);readCases.push({key,office,pass:true});
   }finally{await db.exec('ROLLBACK;');}
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.daily_entries')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.eod_status_history')).rows[0].n,0);
  console.log(JSON.stringify({originalBypasses:8,writeChecks:repaired.length,readChecks:readCases.length,passed:repaired.length+readCases.length,fixturesRolledBack:true,productionConnected:false}));
 }finally{await db.close();}
})().catch(e=>{console.log(JSON.stringify({result:'FAIL',code:e.code,message:String(e.message).slice(0,300)}));process.exitCode=1;});
