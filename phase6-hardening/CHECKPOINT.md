# Phase 6 active checkpoint

Updated 2026-09-18T08:12:23.050814+00:00. Phase 6 remains IN PROGRESS. Continue autonomously under Dr. G's explicit B–E/client/API approval; no new phase and no financial corrections.

## Current production

Frontend `a81545bf-4463-4dc3-9b33-3cad855888d7` from `145adebb5e9367d3854fe96edd913464fd33053e`; entry `index-BnAyRbiv.js`, SHA256 `3b395fa391d7b95f909644c528ef8b2290536fabef95a2edaaea7c929f09d715`, 8,833,241 bytes. Fresh 1,648 tests, build and six compiled checks PASS. No subsequent frontend changes. QA frontend/API remain unchanged, with isolated `product_api_ready=false`.

## Huddle/EOD read and record-office boundary — deployed

Source `1456c8684f955bb359b21a4d9b56e33b6611a858` applied at 2026-09-18T08:08:51.798392+00:00; main SHA256 `242ced3002edd136a68548e5448454fb53d6586bd2f364e4ffe6821a4380cb11`. Six read route declarations now verify current identity, existing page permissions and the actual office selector. Completion preserves existing KPI/Reports consumers. Contact history checks the stored queue office before fetching contacts; assignees require active, approved accounts. Explicit false role permissions override relevant existing fallback grants. No execution or sync capability was added.

164 native tests and 17 retained backend suites PASS under network/business-data guards; 21 unrelated materialized files and all unrelated route bodies are unchanged. Candidate/live missing or invalid identities return 401 and read-only jobs return 403. The existing payroll validator remains 200. All 78,146 fresh guarded original rows are preserved, including 6,476 treatment queue and 50,798 procedure rows. Source/config/job/frontend checks and production/QA health PASS. Signed-in production KPIs, including Treatment Acceptance Rate, render with no captured errors. No Huddle initialization, real submission, workflow execution, provider action or accounting correction was performed.

Recovery: `backup/api-before-phase6-workflow-20260918`, `api-workflow-backup-20260918T080821Z`. Private rollback evidence exists locally and on the server. Remaining route review and final main integration are pending.


## Completed work — do not rerun

Groups A–E are applied and verified. Their SQL hashes, row guards, role/audit tests and recovery directories are in the [full report](../production-release/CLOSURE.md) and [inventory](../production-release/release-inventory.json). B's first stale-count verifier attempt rolled back; the unchanged SQL passed with fresh guards. Group C rollback must preserve deletion history.

API protection releases are verified for payroll, report export, compensation, OTP administration, signed Plaid webhook, administration, RCM contacts and Huddle/EOD reads. Detailed route scope and per-release evidence are in API-ACCESS.md and the separate API-* documents. Do not rerun these releases or regenerate the existing scoped validator credentials (expiry 2026-12-16T22:55:05.380984+00:00).

Dated Payroll Comparison completed for August 2–15, 2026: live UI and read-only source response agree on 13 rows. Never reopen the crash-prone native date picker. Native comparison used read-only SQLite and two Supabase GETs; no provider calls/writes. No matching HTTP access log existed; transport identity is separately verified.

MCP ingress review passed: the existing downstream FastMCP verifier requires its dedicated credential, missing/invalid local requests are 401 and public requests 403. OAuth metadata does not authorize downstream access. No Collaboration configuration or tools were changed/executed.

## Remaining execution

1. Complete the remaining API route classification and justified bounded protections: core/RCM/Expense reads and actual office filtering; compatibility for each current unattended reader; legacy Amazon operational actions; Gusto/Amazon setup callbacks; goal/EOD sync controls. The 159 declarations in `remaining-api-route-inventory.json` are inventory, not a vulnerability count.
2. Preserve existing schedules/provider integrations. `dashboard-api-callers-review.json` and `scheduled-api-dependencies-v2.json` capture read-only consumer review. The latter inspected 63 scheduled/dependent scripts, without running or changing them. Dashboard validators, Plaid readers, cache prewarming, payroll balance/morning brief readers and Collaboration daily reports need exact compatibility. The Collaboration app itself is outside this release's edit scope.
3. Finish final read-only production/QA regression and data/config checks. Fetch/recheck canonical main, then normally fast-forward verified intended production source and push. Main remains `820970ede7727830d95d8d03d518d02119da1acd` at last check. Preserve any newer legitimate work, the Phase 6 branch and all tags. No force push.

Next bounded review is legacy Amazon operational identity/office/review control. No follow-on candidate is deployed yet. Core-read review found that the direct-API fallback in get_patients does not apply its office filter, while the SQLite path does; address before relying on that selector. Existing role resolution now retains both enabled and explicitly disabled permissions. Completion permissions include legitimate KPI/Reports consumers.

Gusto callback currently ignores state and persists before confirming token success; bounded inspection found no pending Gusto state or named authorization script. Amazon only checks state when saved state exists and can expose state in errors. Inspect legitimate setup consumers before the minimal state/token-persistence repair; no real OAuth flow or provider configuration may be changed during tests.

## Recovery and production safety

Current private backup is `/home/openclaw/.cache/nudashboard-phase6-20260917/api-workflow-backup-20260918T080821Z` with the corresponding Git rollback tag above. All earlier snapshots/tags remain. Frontend rollback is `277f68be-3819-410c-8ca6-6aa5ffa2a95e`, tag `backup/production-before-phase6-frontend-20260918`, snapshot `frontend-backup-20260918T045834Z`.

One Huddle page initialized an unsubmitted September 18 draft at 04:18:07 UTC, with 19 blank checklist and four blank provider children. Preserve it and avoid auto-initializing another; use history/review or read-only KPI/Reports consumers. Existing EOD freshness warning is not permission to trigger sync. Counts differ between fresh snapshots as intervening records appear; each deployment preserved its original rows, with no attribution of unrelated changes.

Financial follow-up is frozen: no record/classification/archive/card metadata changes, reconciliation searches, bank logins, provider syncs, emails, purchases, approvals, clinical writes or real workflow execution. TwiML is an existing intentionally external static call flow and remains separate. Do not alter Collaboration Platform or begin another phase.

Current browser: production tab 68 on `/kpis`, signed in; headings/metric rendering PASS, no captured errors. Use current tab inventory if handles become stale. Server prefix `/home/openclaw/.cache/nudashboard-phase6-20260917`; repo `work/phase6/release`.
