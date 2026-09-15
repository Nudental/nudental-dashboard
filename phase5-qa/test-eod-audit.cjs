// Audit behavior on the copied schema, synthetic rows, and ordinary-role writes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { openSchema } = require('./offline_database.cjs');

(async () => {
  const { db } = await openSchema();
  const actor = crypto.randomUUID(), office = '9219b493-5765-5da0-939f-221c7f9944d9';
  const results = [];
  try {
    await db.query('INSERT INTO public.offices(id,name) VALUES($1,$2)', [office, 'QA / Audit office']);
    await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',
      [actor, 'qa-eod-audit@nudashboard.example.test', JSON.stringify({ full_name: 'QA Audit Manager' })]);
    await db.query("UPDATE public.user_profiles SET role='office_manager',office_id=$2,is_active=true,is_approved=true,status='Active' WHERE id=$1", [actor, office]);
    await db.query('INSERT INTO public.user_office_assignments(user_id,office_id,all_offices) VALUES($1,$2,false)', [actor, office]);
    async function write(sql, params) {
      await db.exec('SET LOCAL ROLE authenticated;');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [actor]);
      const response = await db.query(sql, params);
      await db.exec('RESET ROLE;');
      return response;
    }
    async function probe(repaired) {
      const id = crypto.randomUUID();
      await db.exec('BEGIN;');
      try {
        await write("INSERT INTO public.daily_entries(id,office_id,entry_date,status,submitted_by,notes) VALUES($1,$2,'2026-09-15','pending',$3,'QA TEMP audit initial') RETURNING id", [id, office, actor]);
        let audit = (await db.query("SELECT action,user_id,new_values FROM public.audit_logs WHERE table_name='daily_entries' AND record_id=$1", [id])).rows;
        results.push({test:repaired?'create-audited-once':'original-gap-reproduced',pass:repaired ? audit.length===1 && audit[0].action==='INSERT' && audit[0].user_id===actor : audit.length===0});
        if (!repaired) return;
        await write("UPDATE public.daily_entries SET notes='QA TEMP audit revised' WHERE id=$1 RETURNING id", [id]);
        audit = (await db.query("SELECT action,user_id,old_values,new_values,changed_fields FROM public.audit_logs WHERE table_name='daily_entries' AND record_id=$1 AND action='UPDATE'", [id])).rows;
        results.push({test:'edit-old-new-and-actor-recorded',pass:audit.length===1 && audit[0].user_id===actor && audit[0].old_values.notes==='QA TEMP audit initial' && audit[0].new_values.notes==='QA TEMP audit revised' && audit[0].changed_fields.includes('notes')});
        const attemptedDelete = await write('DELETE FROM public.daily_entries WHERE id=$1 RETURNING id', [id]);
        results.push({test:'ordinary-manager-delete-remains-denied',pass:attemptedDelete.rows.length===0});
        // Controlled fixture cleanup uses the privileged test connection. The
        // original role restrictions remain intact and cleanup is not attributed
        // to the ordinary actor who was denied.
        await db.query("SELECT set_config('request.jwt.claim.sub','',true)");
        await db.query('DELETE FROM public.daily_entries WHERE id=$1 RETURNING id', [id]);
        const remaining = (await db.query('SELECT id FROM public.daily_entries WHERE id=$1', [id])).rows;
        audit = (await db.query("SELECT action,user_id,old_values FROM public.audit_logs WHERE table_name='daily_entries' AND record_id=$1", [id])).rows;
        results.push({test:'cleanup-retains-three-audit-events',pass:remaining.length===0 && audit.length===3 && audit.filter(a=>a.action==='DELETE' && a.user_id===null && a.old_values.notes==='QA TEMP audit revised').length===1});
        const trigger = (await db.query("SELECT tgenabled FROM pg_trigger WHERE tgname='trg_eod_approval_sync_analytics'")).rows;
        results.push({test:'analytics-trigger-remains-disabled',pass:trigger.length===1 && trigger[0].tgenabled==='D'});
      } finally { await db.exec('ROLLBACK;'); }
    }
    await probe(false);
    await db.exec("SET nudashboard.environment='qa';");
    await db.exec(fs.readFileSync(path.join(__dirname,'repairs/003-eod-audit-coverage.sql'),'utf8'));
    await probe(true);
    console.log(JSON.stringify({checks:results.length,passed:results.filter(r=>r.pass).length,results,productionConnected:false}));
    assert.ok(results.every(r=>r.pass));
  } finally { await db.close(); }
})().catch(error => { console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,160)})); process.exitCode=1; });
