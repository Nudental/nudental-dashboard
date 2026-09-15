# PH5-HUDDLE-005 — provider/checklist writes omitted audit history

Reproduced in hosted Dashboard QA as the ordinary office manager. Provider-name,
checklist-note and completed-state changes persisted through refresh. Main Huddle
note changes appeared in huddle_audit_log, but the three child changes appeared
in neither that log nor audit_logs. The copied schema confirmed both child tables
lacked the existing generic audit trigger, and their service save methods logged
no history themselves.

Smallest repair: 007-huddle-child-audit-coverage.sql adds two AFTER INSERT/UPDATE/
DELETE triggers calling the unchanged fn_audit_trigger function. No provider,
frontend, permission or existing-history changes; no backfill. Guarded for the
isolated QA schema/environment, plus exact QA installation/project validation
in the deployment query. Migration SHA256
dfc61d12ab21250abf94d1d0c0d1685e2636c0044a6a0022edad2d462ec539f2.

Deployment: confirmed QA Supabase editor, both catalog triggers enabled and query
saved. Production was not changed. Ten offline checks PASS: both original gaps,
creation/edit with correct actor and old/new values, cross-office denial, cleanup
and retained audit history. An initial test-fixture naming collision was corrected
before running these assertions; production source behavior was not involved.

Eleven live Auth/PostgREST checks PASS. The repeated UI provider edit logged once;
the note and checklist completion changes logged once each with the correct actor.
New temporary child records logged creation and deletion. Other-office updates
were denied without new history. The extra child records and Office B parent were
cleaned, with generic audit history retained. The tracked Office A Huddle remains
for subsequent workflow checks. Current frontend still bdf04822 from 15be4ed;
no frontend or API deployment required. Last frontend suite: 1206 PASS.

Scope: this reuses the existing function's failure-handling and retention behavior.
It does not turn the separate Huddle narrative log into a second duplicate child
audit log or change its visibility policy.
