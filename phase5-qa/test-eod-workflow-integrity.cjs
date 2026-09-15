const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema();
 const officeA=crypto.randomUUID(),officeB=crypto.randomUUID(),actors={};
 try {
  await db.exec("SET nudashboard.environment='qa';");
  for(const file of ['001-profile-access-boundary.sql','002-office-workflow-boundary.sql','003-eod-audit-coverage.sql','004-eod-insert-boundary.sql'])
   await db.exec(fs.readFileSync(path.join(__dirname,'repairs',file),'utf8'));
  for(const [id,name] of [[officeA,'QA / Office A'],[officeB,'QA / Office B']])await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)',[id,name]);
  for(const [name,role,active,approved] of [
   ['staff','staff',true,true],['manager','office_manager',true,true],
   ['regional','regional_manager',true,true],['clinical','regional_clinical_manager',true,true],
   ['admin','admin',true,true],['super','super_admin',true,true],
   ['inactive','staff',false,true],['unapproved','staff',true,false]
  ]) {
   const id=actors[name]=crypto.randomUUID();
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,`qa-eod-${name}@nudashboard.example.test`,JSON.stringify({full_name:`QA EOD ${name}`})]);
   await db.query("UPDATE public.user_profiles SET role=$2::public.user_role,office_id=$3,is_active=$4,is_approved=$5,status='Active' WHERE id=$1",[id,role,officeA,active,approved]);
   await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[id,officeA]);
  }
  const cases=[
   ['staff approval','staff','pending',{status:'approved'},false],
   ['manager approval','manager','pending',{status:'approved'},false],
   ['staff rejection','staff','pending',{status:'rejected'},false],
   ['staff approved edit','staff','approved',{notes:'QA approved edit'},false],
   ['manager approved edit','manager','approved',{notes:'QA approved edit'},false],
   ['staff approval metadata','staff','pending',{approved_by:actors.regional},false],
   ['staff office retarget','staff','pending',{office_id:officeB},false],
   ['staff submitter retarget','staff','pending',{submitted_by:actors.manager},false],
   ['inactive edit','inactive','pending',{notes:'QA inactive edit'},false],
   ['unapproved edit','unapproved','pending',{notes:'QA unapproved edit'},false],
   ['staff pending notes','staff','pending',{notes:'QA valid pending edit'},true],
   ['manager pending notes','manager','pending',{notes:'QA valid pending edit'},true],
   ['staff preapproved insert','staff','insert',{status:'approved'},false],
   ['staff forged metadata insert','staff','insert',{status:'pending',approved_by:actors.regional},false],
   ['staff normal insert','staff','insert',{status:'pending'},true],
  ];
  for(const actor of ['regional','clinical','admin','super']) {
   cases.push([actor+' approval',actor,'pending',{status:'approved',approved_by:actors[actor]},true]);
   cases.push([actor+' rejection',actor,'pending',{status:'rejected',approved_by:actors[actor],rejection_reason:'QA reason'},true]);
   cases.push([actor+' approved edit',actor,'approved',{status:'pending_reapproval',notes:'QA reviewed edit',edited_by:actors[actor]},true]);
  }
  async function run() {
   const results=[];
   for(const [name,actor,status,changes,expected] of cases) {
    const id=crypto.randomUUID(),submitter=actors[['inactive','unapproved'].includes(actor)?actor:'staff'];
    let allowed=false;
    await db.exec('BEGIN;');
    try {
     if(status!=='insert')await db.query("INSERT INTO public.daily_entries(id,office_id,submitted_by,entry_date,status,notes) VALUES($1,$2,$3,'2026-09-12',$4,'QA TEMP EOD workflow')",[id,officeA,submitter,status]);
     await db.exec('SET LOCAL ROLE authenticated;');
     await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[actor]]);
     const keys=Object.keys(changes),values=Object.values(changes);
     if(status==='insert') {
      await db.query(`INSERT INTO public.daily_entries(id,office_id,submitted_by,entry_date,notes,${keys.join(',')}) VALUES($1,$2,$3,'2026-09-12','QA TEMP EOD workflow',${keys.map((_,i)=>'$'+(i+4)).join(',')})`,[id,officeA,actors[actor],...values]);
     } else await db.query(`UPDATE public.daily_entries SET ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')} WHERE id=$${keys.length+1}`, [...values,id]);
     await db.exec('RESET ROLE;');
     const rows=(await db.query('SELECT * FROM public.daily_entries WHERE id=$1',[id])).rows;
     allowed=rows.length===1&&keys.every((key,i)=>rows[0][key]===values[i]);
     if(allowed) {
      const audit=(await db.query("SELECT user_id FROM public.audit_logs WHERE table_name='daily_entries' AND record_id=$1 AND action=$2",[id,status==='insert'?'INSERT':'UPDATE'])).rows;
      assert.deepEqual(audit,[{user_id:actors[actor]}]);
     }
    } catch(error) { if(error.code!=='42501')throw error; }
    finally {await db.exec('ROLLBACK;');}
    results.push({test:name,allowed,pass:allowed===expected});
   }
   return results;
  }
  const original=await run();
  assert.ok(original.filter(r=>!r.pass).length>=8,'Reproduce the live policy bypasses');
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/005-eod-workflow-integrity.sql'),'utf8'));
  const repaired=await run();
  assert.ok(repaired.every(r=>r.pass),JSON.stringify(repaired.filter(r=>!r.pass)));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.daily_entries')).rows[0].n,0);
  const triggers=(await db.query("SELECT tgenabled FROM pg_trigger WHERE tgname='trg_eod_approval_sync_analytics'")).rows;
  assert.deepEqual(triggers,[{tgenabled:'D'}]);
  console.log(JSON.stringify({originalDefectsReproduced:original.filter(r=>!r.pass).length,checks:repaired.length,passed:repaired.filter(r=>r.pass).length,fixturesRolledBack:true,analyticsTriggerDisabled:true,productionConnected:false}));
 } finally {await db.close();}
})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,300)}));process.exitCode=1;});
