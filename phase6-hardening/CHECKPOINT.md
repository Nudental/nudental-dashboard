# Phase 6 active checkpoint

Updated 2026-09-18T08:32:34.093909+00:00. Phase 6 remains IN PROGRESS. Continue autonomously under Dr. G's explicit B–E/client/API approval; no new phase and no financial corrections.

## Current production

Frontend `a81545bf-4463-4dc3-9b33-3cad855888d7` from `145adebb5e9367d3854fe96edd913464fd33053e`; entry `index-BnAyRbiv.js`, SHA256 `3b395fa391d7b95f909644c528ef8b2290536fabef95a2edaaea7c929f09d715`, 8,833,241 bytes. Fresh 1,648 tests, build and six compiled checks PASS. No subsequent frontend changes. QA frontend/API remain unchanged, with isolated `product_api_ready=false`.

## Legacy Amazon request identity/office boundary — deployed

Source `34e9f2f008dad5bccdd2ed0c75ff8f3ee8c16c59` applied at 2026-09-18T08:27:00.919486+00:00; main SHA256 `00c18f7187717386f51c1d11af0d9dbd54047e82d202f6ebd505a2e7d5a83457`. Five request/history route declarations now verify current human identity and existing request/page/review grants. Creation binds actor and canonical office. Review requires Regional Manager/Admin/Super Admin, pending state, the stored office and no self-review. Conditional updates guard concurrent office/requester/state changes. Read filters are encoded. Existing schema fields replace the previously nonexistent reviewer columns; rejection attribution is in the existing service journal, not a newly claimed database/UI audit trail.

177 native tests and 17 retained backend suites PASS under network/business-data guards; 23 unrelated materialized files and all unrelated route bodies are unchanged. Candidate/live missing or invalid identities return 401; read-only job credentials return 403. The existing payroll validator remains 200. All 78,277 fresh guarded original rows are preserved, including zero legacy order requests and 129 order-history records. RLS on the request table remains enabled with no ordinary policies. No schema/policy, provider/config/job/frontend change was needed. Production/QA health PASS. The signed-in Front Desk Amazon Order History view displays 129 records with no captured errors; its existing Supabase client is unchanged.

No real order, request, approval, rejection, cart, purchase, provider authorization or sync was executed. Cart/purchase/sync/OAuth APIs remain separate pending groups. Recovery: `backup/api-before-phase6-orders-20260918`, `api-order-backup-20260918T082630Z`. The private backup is preserved locally and on the server. Phase 6 and main integration remain in progress.

## Completed work — do not rerun

Groups A–E are applied and verified. Their SQL hashes, row guards, role/audit tests and recovery directories are in the [full report](../production-release/CLOSURE.md) and [inventory](../production-release/release-inventory.json). B's first stale-count verifier attempt rolled back; the unchanged SQL passed with fresh guards. Group C rollback must preserve deletion history.

API protection releases are verified for payroll, report export, compensation, OTP administration, signed Plaid webhook, administration, RCM contacts, Huddle/EOD reads and legacy Amazon requests/history. Detailed route scope and per-release evidence are in API-ACCESS.md and the separate API-* documents. Do not rerun these releases or regenerate the existing scoped validator credentials (expiry 2026-12-16T22:55:05.380984+00:00).

Dated Payroll Comparison completed for August 2–15, 2026: live UI and read-only source response agree on 13 rows. Never reopen the crash-prone native date picker. Native comparison used read-only SQLite and two Supabase GETs; no provider calls/writes. No matching HTTP access log existed; transport identity is separately verified.

MCP ingress review passed: the existing downstream FastMCP verifier requires its dedicated credential, missing/invalid local requests are 401 and public requests 403. OAuth metadata does not authorize downstream access. No Collaboration configuration or tools were changed/executed.

## Remaining execution

1. Complete the remaining API route classification and justified bounded protections: core/RCM/Expense reads and actual office filtering; compatibility for each current unattended reader; remaining Amazon cart/purchase/sync/setup operations; Gusto/Amazon setup callbacks; goal/EOD sync controls. The 159 declarations in `remaining-api-route-inventory.json` are inventory, not a vulnerability count.
2. Preserve existing schedules/provider integrations. `dashboard-api-callers-review.json` and `scheduled-api-dependencies-v2.json` capture read-only consumer review. The latter inspected 63 scheduled/dependent scripts, without running or changing them. Dashboard validators, Plaid readers, cache prewarming, payroll balance/morning brief readers and Collaboration daily reports need exact compatibility. The Collaboration app itself is outside this release's edit scope.
3. Finish final read-only production/QA regression and data/config checks. Fetch/recheck canonical main, then normally fast-forward verified intended production source and push. Main remains `820970ede7727830d95d8d03d518d02119da1acd` at last check. Preserve any newer legitimate work, the Phase 6 branch and all tags. No force push.

Next: core/RCM/Expense read permissions, actual office filtering and scoped-job compatibility, then remaining provider/setup/execution boundaries. No follow-on candidate is deployed yet. The current static frontend consumer inventory is `frontend-read-consumers.json`; follow services/hooks to actual tab grants, because literals/comments alone are not authorization proof. Core-read review found that the direct-API fallback in get_patients does not apply its office filter, while the SQLite path does; address before relying on that selector. Existing role resolution now retains both enabled and explicitly disabled permissions. Completion permissions include legitimate KPI/Reports consumers.

Gusto callback currently ignores state and persists before confirming token success; bounded inspection found no pending Gusto state or named authorization script. Amazon only checks state when saved state exists and can expose state in errors. Inspect legitimate setup consumers before the minimal state/token-persistence repair; no real OAuth flow or provider configuration may be changed during tests.

## Recovery and production safety

Current private backup is `/home/openclaw/.cache/nudashboard-phase6-20260917/api-order-backup-20260918T082630Z` with the corresponding Git rollback tag above. All earlier snapshots/tags remain. Frontend rollback is `277f68be-3819-410c-8ca6-6aa5ffa2a95e`, tag `backup/production-before-phase6-frontend-20260918`, snapshot `frontend-backup-20260918T045834Z`.

One Huddle page initialized an unsubmitted September 18 draft at 04:18:07 UTC, with 19 blank checklist and four blank provider children. Preserve it and avoid auto-initializing another; use history/review or read-only KPI/Reports consumers. Existing EOD freshness warning is not permission to trigger sync. Counts differ between fresh snapshots as intervening records appear; each deployment preserved its original rows, with no attribution of unrelated changes.

Financial follow-up is frozen: no record/classification/archive/card metadata changes, reconciliation searches, bank logins, provider syncs, emails, purchases, approvals, clinical writes or real workflow execution. TwiML is an existing intentionally external static call flow and remains separate. Do not alter Collaboration Platform or begin another phase.

Current browser: production tab 68 on `/inventory-dashboard?tab=front-desk`, Amazon Order History selected. 129 records are shown, no captured errors; no action was submitted. Use current tab inventory if handles become stale. Server prefix `/home/openclaw/.cache/nudashboard-phase6-20260917`; repo `work/phase6/release`.
