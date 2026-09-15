// Reproduce the exact permissive-policy bypass, then verify the targeted guard.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { openSchema } = require('./offline_database.cjs');

(async () => {
  const { db } = await openSchema();
  const officeA = crypto.randomUUID(), officeB = crypto.randomUUID();
  const actors = {};
  try {
    await db.exec("SET nudashboard.environment='qa';");
    for (const file of ['001-profile-access-boundary.sql','002-office-workflow-boundary.sql','003-eod-audit-coverage.sql']) {
      await db.exec(fs.readFileSync(path.join(__dirname,'repairs',file),'utf8'));
    }
    for (const [id,name] of [[officeA,'QA / EOD Office A'],[officeB,'QA / EOD Office B']]) {
      await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)',[id,name]);
    }
    for (const [name,role,active,approved] of [
      ['staff','staff',true,true],['manager','office_manager',true,true],
      ['regional','regional_manager',true,true],['inactive','staff',false,true],['unapproved','staff',true,false]
    ]) {
      const id = actors[name] = crypto.randomUUID();
      await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',
        [id,`qa-eod-${name}@nudashboard.example.test`,JSON.stringify({full_name:`QA EOD ${name}`})]);
      await db.query("UPDATE public.user_profiles SET role=$2::public.user_role,office_id=$3,is_active=$4,is_approved=$5,status='Active' WHERE id=$1",
        [id,role,officeA,active,approved]);
      await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)',[id,officeA]);
    }
    const cases = [
      ['staff own office','staff',officeA,'staff',true],
      ['manager own office','manager',officeA,'manager',true],
      ['staff cross office','staff',officeB,'staff',false],
      ['staff impersonation','staff',officeA,'manager',false],
      ['inactive staff','inactive',officeA,'inactive',false],
      ['unapproved staff','unapproved',officeA,'unapproved',false],
      ['regional manager cross office','regional',officeB,'regional',true],
    ];
    async function run() {
      const results = [];
      for (const [name,actor,office,submitter,want] of cases) {
        const id = crypto.randomUUID();
        let allowed = false;
        await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
        try {
          await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actors[actor]]);
          await db.query("INSERT INTO public.daily_entries(id,office_id,submitted_by,entry_date,status,notes) VALUES($1,$2,$3,'2026-09-12','pending','QA TEMP EOD insert boundary')",[id,office,actors[submitter]]);
          await db.exec('RESET ROLE;');
          const rows = (await db.query('SELECT id FROM public.daily_entries WHERE id=$1',[id])).rows;
          const audit = (await db.query("SELECT action,user_id FROM public.audit_logs WHERE table_name='daily_entries' AND record_id=$1",[id])).rows;
          assert.equal(rows.length,1);
          assert.deepEqual(audit,[{action:'INSERT',user_id:actors[actor]}]);
          allowed = true;
        } catch (error) {
          if (error.code !== '42501') throw error;
        } finally { await db.exec('ROLLBACK;'); }
        results.push({test:name,allowed,pass:allowed===want});
      }
      return results;
    }
    const original = await run();
    assert.equal(original.filter(result=>!result.pass).length,4);
    await db.exec(fs.readFileSync(path.join(__dirname,'repairs','004-eod-insert-boundary.sql'),'utf8'));
    const repaired = await run();
    assert.ok(repaired.every(result=>result.pass));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.daily_entries')).rows[0].n,0);
    console.log(JSON.stringify({originalDefectsReproduced:4,repairedChecks:repaired.length,repairedPassed:repaired.filter(result=>result.pass).length,results:repaired,productionConnected:false,fixturesRolledBack:true}));
  } finally { await db.close(); }
})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,170)}));process.exitCode=1;});
