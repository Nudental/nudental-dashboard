# Huddle/EOD read authorization

Deployed and verified from `1456c8684f955bb359b21a4d9b56e33b6611a858`.

Six read route declarations require the current active/approved human identity,
the existing page grant and the office selector actually consumed by the route.
Treatment-plan completion also serves the existing KPI and Reports consumers.
Explicitly disabled role grants override the existing relevant fallback grants.
Read-only job credentials do not authorize these routes; the EOD sync action is
outside this batch and remains under separate caller review.

The exact existing contact-history handler reproduced a cross-office response
against synthetic intercepted storage. The repair checks the stored queue office
before fetching contacts. Assignee lookup now requires active, approved accounts
with Active status. Existing response calculations and all other route bodies
are unchanged. No new execution capability or business record is introduced.

Verification: 164 native tests and 17 retained backend suites PASS, with the
network/business-data guard active and no blocked attempts. All 21 unrelated
materialized files are unchanged. Tests cover actual contact-history/assignee
handlers, explicit denials, office aliases/conflicts/duplicates, all-office
scope, role fallback overrides, malformed records and existing report consumers.

Production validation uses missing/invalid/job denial probes and read-only UI.
No Huddle initialization, sync, clinical write or workflow submission is allowed.
Preserve the pre-existing incidental September 18 unsubmitted Huddle draft.

## Huddle/EOD read and record-office boundary — deployed

Source `1456c8684f955bb359b21a4d9b56e33b6611a858` applied at 2026-09-18T08:08:51.798392+00:00; main SHA256 `242ced3002edd136a68548e5448454fb53d6586bd2f364e4ffe6821a4380cb11`. Six read route declarations now verify current identity, existing page permissions and the actual office selector. Completion preserves existing KPI/Reports consumers. Contact history checks the stored queue office before fetching contacts; assignees require active, approved accounts. Explicit false role permissions override relevant existing fallback grants. No execution or sync capability was added.

164 native tests and 17 retained backend suites PASS under network/business-data guards; 21 unrelated materialized files and all unrelated route bodies are unchanged. Candidate/live missing or invalid identities return 401 and read-only jobs return 403. The existing payroll validator remains 200. All 78,146 fresh guarded original rows are preserved, including 6,476 treatment queue and 50,798 procedure rows. Source/config/job/frontend checks and production/QA health PASS. Signed-in production KPIs, including Treatment Acceptance Rate, render with no captured errors. No Huddle initialization, real submission, workflow execution, provider action or accounting correction was performed.

Recovery: `backup/api-before-phase6-workflow-20260918`, `api-workflow-backup-20260918T080821Z`. Private rollback evidence exists locally and on the server. Remaining route review and final main integration are pending.
