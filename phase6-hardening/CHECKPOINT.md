# Phase 6 active checkpoint

Updated 2026-09-18T09:16:53.837899+00:00. Phase 6 remains IN PROGRESS. Continue autonomously under Dr. G's explicit B–E/client/API approval; no new phase and no financial corrections.

## Current production

Frontend `a81545bf-4463-4dc3-9b33-3cad855888d7` from `145adebb5e9367d3854fe96edd913464fd33053e`; entry `index-BnAyRbiv.js`, SHA256 `3b395fa391d7b95f909644c528ef8b2290536fabef95a2edaaea7c929f09d715`, 8,833,241 bytes. Fresh 1,648 tests, build and six compiled checks PASS. No subsequent frontend changes. QA frontend/API remain unchanged, with isolated `product_api_ready=false`.

## Legacy goal and EOD maintenance boundary — deployed

Source `288fdf7dc9feff34685ee169acef872ca5e1d7d5` applied at 2026-09-18T09:12:02.345983+00:00; main SHA256 `c3e8cce7e212b3d56e043e98cab682745ed402346f646074edb467286d90b333`. POST legacy goals now requires current active approved Super Admin/all-office authority, matching Management. Backend-only EOD queue sync requires Super Admin or Admin with the existing Sync grant and all-office authority. Ordinary EOD viewers and read-only job identities cannot execute either operation. Existing goal GET, ordinary EOD reads and every route body remain unchanged.

207 native API tests, 17 retained backend suites and 13 materializer tests PASS. The first local materializer attempt could not access its private temporary folders under the sandbox; the same tests passed with the required local access. The native suites recorded zero blocked network/business-data attempts. All 25 unrelated materialized files are unchanged. Candidate/live missing/invalid requests return 401 and existing read-only job identities return 403. Payroll validator remains 200. No real goal write or queue synchronization was executed; production mutation probes used only denied identities, an empty goal body and dry_run=true.

All 78,445 guarded original business/audit rows, including 36 legacy goals and 128 office goals, and all 83,957 original SQLite clinical/reference rows are preserved. No schema, provider/config/job/frontend change. Production/QA health PASS. The signed-in Sync Dashboard renders 29 jobs with no captured errors/alerts; no job was triggered. Recovery: `backup/api-before-phase6-maintenance-20260918`, `api-maintenance-backup-20260918T091128Z`. Private rollback copy preserved locally and remotely. Phase 6 and main integration remain in progress.

## Completed work — do not rerun

Groups A–E are applied and verified. Their SQL hashes, row guards, role/audit tests and recovery directories are in the [full report](../production-release/CLOSURE.md) and [inventory](../production-release/release-inventory.json). B's first stale-count verifier attempt rolled back; the unchanged SQL passed with fresh guards. Group C rollback must preserve deletion history.

API protection releases are verified for payroll, report export, compensation, OTP administration, signed Plaid webhook, administration, RCM contacts, Huddle/EOD reads legacy Amazon requests/history directory/patient/appointment reads and legacy goal/EOD maintenance. Detailed route scope and per-release evidence are in API-ACCESS.md and the separate API-* documents. Do not rerun these releases or regenerate the existing scoped validator credentials (expiry 2026-12-16T22:55:05.380984+00:00).

Dated Payroll Comparison completed for August 2–15, 2026: live UI and read-only source response agree on 13 rows. Never reopen the crash-prone native date picker. Native comparison used read-only SQLite and two Supabase GETs; no provider calls/writes. No matching HTTP access log existed; transport identity is separately verified.

MCP ingress review passed: the existing downstream FastMCP verifier requires its dedicated credential, missing/invalid local requests are 401 and public requests 403. OAuth metadata does not authorize downstream access. No Collaboration configuration or tools were changed/executed.

## Remaining execution

1. Complete the remaining API route classification and justified bounded protections: core/RCM/Expense reads and actual office filtering; compatibility for each current unattended reader; remaining Amazon cart/purchase/sync/setup operations; Gusto/Amazon setup callbacks. The 159 declarations in `remaining-api-route-inventory.json` are inventory, not a vulnerability count.
2. Preserve existing schedules/provider integrations. `dashboard-api-callers-review.json` and `scheduled-api-dependencies-v2.json` capture read-only consumer review. The latter inspected 63 scheduled/dependent scripts, without running or changing them. Dashboard validators, Plaid readers, cache prewarming, payroll balance/morning brief readers and Collaboration daily reports need exact compatibility. The Collaboration app itself is outside this release's edit scope.
3. Finish final read-only production/QA regression and data/config checks. Fetch/recheck canonical main, then normally fast-forward verified intended production source and push. Main remains `820970ede7727830d95d8d03d518d02119da1acd` at last check. Preserve any newer legitimate work, the Phase 6 branch and all tags. No force push.

Next: core/RCM/Expense read permissions, actual office filtering and scoped-job compatibility, then remaining provider/setup/execution boundaries. Review found the RCM status widget calls daily summary without its selected office; align that client before enforcing the daily-summary office boundary. RcmDashboardTab already remounts on office/date/refresh changes. No follow-on candidate is deployed yet. The current static frontend consumer inventory is `frontend-read-consumers.json`; follow services/hooks to actual tab grants, because literals/comments alone are not authorization proof. The patient fallback office filter is now repaired and verified; retain its bounded fetch behavior. Existing role resolution now retains both enabled and explicitly disabled permissions. Completion permissions include legitimate KPI/Reports consumers.

Gusto callback currently ignores state and persists before confirming token success; bounded inspection found no pending Gusto state or named authorization script. Amazon only checks state when saved state exists and can expose state in errors. Inspect legitimate setup consumers before the minimal state/token-persistence repair; no real OAuth flow or provider configuration may be changed during tests.

## Recovery and production safety

Current private backup is `/home/openclaw/.cache/nudashboard-phase6-20260917/api-maintenance-backup-20260918T091128Z` with the corresponding Git rollback tag above. All earlier snapshots/tags remain. Frontend rollback is `277f68be-3819-410c-8ca6-6aa5ffa2a95e`, tag `backup/production-before-phase6-frontend-20260918`, snapshot `frontend-backup-20260918T045834Z`.

One Huddle page initialized an unsubmitted September 18 draft at 04:18:07 UTC, with 19 blank checklist and four blank provider children. Preserve it and avoid auto-initializing another; use history/review or read-only KPI/Reports consumers. Existing EOD freshness warning is not permission to trigger sync. Counts differ between fresh snapshots as intervening records appear; each deployment preserved its original rows, with no attribution of unrelated changes.

Financial follow-up is frozen: no record/classification/archive/card metadata changes, reconciliation searches, bank logins, provider syncs, emails, purchases, approvals, clinical writes or real workflow execution. TwiML is an existing intentionally external static call flow and remains separate. Do not alter Collaboration Platform or begin another phase.

Current browser: production tab 68 on `/sync-dashboard`; 29 jobs render with no captured errors or alerts; no job was triggered. Use current tab inventory if handles become stale. Server prefix `/home/openclaw/.cache/nudashboard-phase6-20260917`; repo `work/phase6/release`.
