# PH5-AUDIT-001 — EOD row audit, September 15, 2026

Environment: NuDental Dashboard QA only, Supabase `hvtxjfayenqnwtaisoaw`,
frontend `https://nudashboard-qa.pages.dev`. Production was not deployed or changed.

Reproduction: the existing labeled synthetic office-manager submission persisted
with zero `audit_logs` entries. The copied schema also reproduced that gap.
The form inserts `daily_entries`, but that table lacked the existing generic
row-audit trigger; the form did not create an audit record separately.

Smallest repair: `repairs/003-eod-audit-coverage.sql` adds one AFTER INSERT,
UPDATE, DELETE trigger calling the unchanged `public.fn_audit_trigger()`.
It requires the isolated QA schema and environment marker. No existing rows
were changed or backfilled, and no policies, provider configuration or financial
analytics behavior changed. The original schema snapshot remains intact.

Deployment: applied in the confirmed QA SQL editor. Catalog readback returned
exactly one enabled `trg_audit_daily_entries` trigger.

Verification: six offline checks passed, including an original-schema negative
control, exact old/new values and actor identity, denied ordinary-manager delete,
privileged fixture cleanup, audit retention and unchanged disabled analytics sync.

Live browser: the existing synthetic office manager submitted a clearly labeled
September 14 attestation and received “Entry Submitted Successfully” with pending
status. After a page refresh, `verify_hosted_eod_audit.py` passed all seven checks:
one persisted submission, one INSERT audit, persisted authorized edit, one UPDATE
audit with old/new values and actor, denied manager delete, exact-fixture cleanup,
and preservation of all three audit events including privileged cleanup.

Temporary fixture `a245e86a-c0ee-49e6-b2de-9ecf0220dcee` was removed. Its audit
events were retained intentionally. The earlier separately labeled EOD fixture
remains for the ongoing audit. No duplicate submission was created.

Scope limit: `eod_status_history` is a separate feature and its initial-submission
coverage is still under review. The remaining API routes, full role matrix and
broader workflow audit are incomplete. This report does not declare Phase 5 done.
