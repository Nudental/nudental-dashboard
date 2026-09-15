const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),a=crypto.randomUUID(),b=crypto.randomUUID(),target=crypto.randomUUID();
 const actors={admin:crypto.randomUUID(),super_admin:crypto.randomUUID(),staff:crypto.randomUUID(),office_manager:crypto.randomUUID(),inactive_admin:crypto.randomUUID()};
 const checks=[];const check=(name,ok)=>{assert.ok(ok,name);checks.push(name)};
 try{
  await db.exec("SET nudashboard.environment='qa';");
  const dir=path.join(__dirname,'repairs');
  for(const f of fs.readdirSync(dir).filter(f=>/^0(0[1-9]|1[0-7])-.+\.sql$/.test(f)).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
  await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / A'),($2,'QA / B')",[a,b]);
  for(const [role,id] of [...Object.entries(actors),['target',target]]){
   await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')",[id,`qa-${role}@nudashboard.example.test`]);
   await db.query("UPDATE user_profiles SET role=$2,office_id=$3,is_active=$4,is_approved=true,status='Active' WHERE id=$1",[id,role==='target'?'staff':role==='inactive_admin'?'admin':role,a,role!=='inactive_admin']);
  }
  await db.query('INSERT INTO user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[target,b]);
  async function access(){
   await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
   try{
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[target]);
    return (await db.query('SELECT public.user_can_access_office($1) AS a,public.user_can_access_office($2) AS b',[a,b])).rows[0];
   }finally{await db.exec('ROLLBACK;')}
  }
  async function state(){return{profile:(await db.query('SELECT office_id FROM user_profiles WHERE id=$1',[target])).rows[0],assignments:(await db.query('SELECT office_id,all_offices FROM user_office_assignments WHERE user_id=$1 ORDER BY office_id',[target])).rows}}
  async function assign(actor,ids,all=false,role='authenticated'){
   await db.exec('BEGIN; SET LOCAL ROLE '+role+';');
   try{
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[actor,role]);
    await db.query('SELECT * FROM public.dashboard_set_user_offices($1,$2::uuid[],$3)',[target,ids,all]);
    await db.exec('COMMIT;');
   }catch(error){await db.exec('ROLLBACK;');throw error}
  }
  check('original reassignment leaks former primary office',(await access()).a===true&&(await access()).b===true);
  await db.exec(fs.readFileSync(path.join(dir,'018-user-office-assignment-transaction.sql'),'utf8'));
  await assign(actors.super_admin,[b]);
  check('removed office access revoked',(await access()).a===false&&(await access()).b===true);
  check('primary office synchronized',(await state()).profile.office_id===b);
  await assign(actors.admin,[a,b]);
  check('retained primary office preserved',(await state()).profile.office_id===b&&(await state()).assignments.length===2);
  await assign(actors.admin,[]);
  check('empty assignment removes all office access',(await state()).profile.office_id===null&&!(await access()).a&&!(await access()).b);
  await assign(actors.admin,[],true);
  check('explicit all offices remains supported',(await state()).assignments.length===1&&(await state()).assignments[0].all_offices&&(await access()).a&&(await access()).b);
  await assign(actors.admin,[b,b]);await assign(actors.admin,[b,b]);
  check('repeat and duplicate input leave one assignment',(await state()).assignments.length===1&&(await state()).profile.office_id===b);
  for(const [label,who,ids,role,code] of [
   ['unknown office rollback',actors.admin,[a,crypto.randomUUID()],'authenticated','23503'],
   ['null office rollback',actors.admin,[null],'authenticated','22023'],
   ['staff cannot assign others',actors.staff,[a],'authenticated','42501'],
   ['staff cannot self grant',target,[a],'authenticated','42501'],
   ['office manager cannot assign',actors.office_manager,[a],'authenticated','42501'],
   ['inactive administrator cannot assign',actors.inactive_admin,[a],'authenticated','42501'],
   ['anonymous cannot assign',actors.admin,[a],'anon','42501'],
  ]){
   const before=await state();let got=null;
   try{await assign(who,ids,false,role)}catch(error){got=error.code}
   check(label,got===code&&JSON.stringify(before)===JSON.stringify(await state()));
  }
  const audit=(await db.query("SELECT count(*)::int AS n FROM audit_logs WHERE table_name='user_profiles' AND record_id=$1 AND user_id=$2",[target,actors.admin])).rows[0].n;
  check('administrator profile audit retained',audit>=4);
  check('function does not bypass row permissions',(await db.query("SELECT prosecdef FROM pg_proc WHERE proname='dashboard_set_user_offices'")).rows[0].prosecdef===false);
  console.log(JSON.stringify({checks:checks.length,passed:checks.length,productionConnected:false}));
 }finally{await db.close()}
})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,200)}));process.exitCode=1});
