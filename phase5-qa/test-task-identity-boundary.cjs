const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {openSchema}=require('./offline_database.cjs');
(async()=>{
 const {db}=await openSchema(),office=crypto.randomUUID(),other=crypto.randomUUID(),actors={};
 try{
  await db.exec("SET nudashboard.environment='qa';");
  for(const file of ['001-profile-access-boundary.sql','002-office-workflow-boundary.sql','008-task-page-permission.sql','009-task-field-permission.sql'])
   await db.exec(fs.readFileSync(path.join(__dirname,'repairs',file),'utf8'));
  for(const id of [office,other])await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)',[id,'QA / Task identity '+id.slice(0,8)]);
  for(const role of ['staff','office_manager','admin','super_admin','regional_manager','regional_clinical_manager']){
   const id=actors[role]=crypto.randomUUID();
   await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,`qa-${role}@nudashboard.example.test`,JSON.stringify({full_name:'QA '+role})]);
   await db.query("UPDATE public.user_profiles SET role=$2,office_id=$3,is_active=true,is_approved=true,status='Active' WHERE id=$1",[id,role,office]);
   await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[id,office]);
   await db.query("INSERT INTO public.role_permissions(role,permission,enabled) VALUES($1,'workflow.tasks.view',true)",[role]);
  }
  const stamp='2026-09-15T12:00:00Z',prior='2026-09-01T12:00:00Z';
  const cases=[
   ['staff creation','staff','insert',{}, {created_by:actors.staff},false],
   ['manager forged creator','office_manager','insert',{}, {created_by:actors.admin},false],
   ['manager omitted creator','office_manager','insert',{}, {created_by:null},false],
   ['manager completed insertion','office_manager','insert',{}, {task_status:'completed',completed_at:stamp,completed_by:actors.staff},false],
   ['manager premature lifecycle insertion','office_manager','insert',{}, {acknowledged_at:stamp,acknowledged_by:actors.office_manager},false],
   ['staff forged acknowledgment','staff','update',{}, {task_status:'acknowledged',acknowledged_at:stamp,acknowledged_by:actors.admin},false],
   ['staff acknowledgment rewrite','staff','update',{task_status:'acknowledged',acknowledged_at:prior,acknowledged_by:actors.staff},{acknowledged_at:stamp},false],
   ['staff acknowledgment clear','staff','update',{task_status:'acknowledged',acknowledged_at:prior,acknowledged_by:actors.staff},{acknowledged_at:null,acknowledged_by:null},false],
   ['staff metadata outside transition','staff','update',{}, {completed_at:stamp,completed_by:actors.staff},false],
   ['staff actor without timestamp','staff','update',{}, {task_status:'completed',completed_by:actors.staff},false],
   ['staff timestamp without actor','staff','update',{}, {task_status:'completed',completed_at:stamp},false],
   ['manager creator rewrite','office_manager','update',{}, {created_by:actors.admin},false],
   ['manager title edit','office_manager','update',{}, {action_required:'QA TEMP allowed title'},true],
   ['manager reassignment','office_manager','update',{}, {assigned_owner_id:actors.admin},true],
   ['staff protected title remains denied','staff','update',{}, {action_required:'QA TEMP forbidden title'},false],
   ['other-office staff remains denied','staff','update',{}, {task_status:'completed'},false,other],
   ['manager reopening retains earlier lifecycle','office_manager','update',{task_status:'completed',completed_at:prior,completed_by:actors.staff},{task_status:'submitted'},true],
   ['manager ordinary legacy pending insertion','office_manager','insert',{}, {task_status:'pending'},true],
  ];
  for(const stage of ['acknowledged','in_progress','completed'])
   cases.push(['staff valid '+stage,'staff','update',{}, {task_status:stage,[stage+'_at']:stamp,[stage+'_by']:actors.staff},true]);
  for(const role of ['office_manager','admin','super_admin','regional_manager','regional_clinical_manager'])
   cases.push([role+' ordinary task insertion',role,'insert',{}, {created_by:actors[role],assigned_owner_id:actors[role]},true]);
  async function run(){
   const results=[];
   for(const [name,role,op,initial,changes,expected,scope=office] of cases){
    const id=crypto.randomUUID();let allowed=false;
    const base={id,office_id:scope,assigned_owner_id:actors.staff,created_by:actors.office_manager,
     action_required:'QA TEMP task identity',priority_level:'medium',task_status:'submitted',...initial};
    async function insert(row){const keys=Object.keys(row);return db.query(`INSERT INTO public.action_items(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,Object.values(row));}
    await db.exec('BEGIN;');
    try{
     if(op==='update')await insert(base);
     await db.exec('SET LOCAL ROLE authenticated;');
     await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[role]]);
     if(op==='insert')allowed=(await insert({...base,...changes})).rows.length===1;
     else{
      const keys=Object.keys(changes);
      allowed=(await db.query(`UPDATE public.action_items SET ${keys.map((key,i)=>key+'=$'+(i+1)).join(',')} WHERE id=$${keys.length+1} RETURNING id`,[...Object.values(changes),id])).rows.length===1;
     }
    }catch(error){if(error.code!=='42501')throw error;}
    finally{await db.exec('ROLLBACK;');}
    results.push({test:name,allowed,pass:allowed===expected});
   }
   return results;
  }
  const original=await run();assert.equal(original.filter(row=>!row.pass).length,12);
  await db.exec(fs.readFileSync(path.join(__dirname,'repairs/013-task-identity-boundary.sql'),'utf8'));
  const repaired=await run();assert.ok(repaired.every(row=>row.pass),JSON.stringify(repaired.filter(row=>!row.pass)));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.action_items')).rows[0].n,0);
  console.log(JSON.stringify({originalBypasses:12,checks:repaired.length,passed:repaired.length,fixturesRolledBack:true,productionConnected:false}));
 }finally{await db.close();}
})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,400)}));process.exitCode=1;});
