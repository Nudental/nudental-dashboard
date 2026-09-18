# Phase 6 active checkpoint

Updated 2026-09-18T12:20:04.491683+00:00. Phase 6 remains IN PROGRESS. Continue autonomously under Dr. G's explicit Bâ€“E/client/API approval; no new phase and no financial corrections.

## Current production

**Current verified state:** API `d5c6da689852e41eaa3087d42ef274a7e654bdda`; production frontend `9509cba3-dd00-4084-9c14-e64ffd7ff390`; QA `559189b1-5a28-4cea-90ba-c0e00bbe2a5e`. Expense release PASS. Next: remaining RCM/financial/diagnostic/provider route review, final regression and normal main integration. No accounting corrections.

## RCM selected-office status repair — deployed

Frontend source `f3e427f7b94c96eb44424e7791c10051f30817cd` is live in production `08f84700-056f-4af4-8f13-526a66ad8187` and isolated QA `707f2962-0ed0-406e-baa5-25cc49f40bc4`. The Data Source Status widget now forwards the selected office to the daily-summary service; unknown offices fail before making a request. Existing all-office behavior and the parent request isolation remain intact. Five new tests reproduced the defect before the two-file repair.

All 1,654 frontend tests (zero skips), six compiled Expense isolation checks and three compiled RCM checks in each environment PASS. Both builds and environment-isolation checks PASS. Production entry `index-DHO0teuA.js` is 8,833,301 bytes (previous 8,833,241); QA entry `index-CUhTuMEX.js` is 8,832,132 bytes. No speedup claim is made for this 60-byte scope repair.

Live production RCM / Eatontown / Last Month renders all eight sections, today's September 18 daily summary and an available payment breakdown; captured errors and alerts are empty. QA layout and banner render with financial reads intentionally disabled by `product_api_ready=false`. Production/QA HTTP and API health PASS. Four production/collections metric comparisons for August 1–31, all offices and Eatontown, are unchanged. All 17,363 guarded original rows are preserved, backend source is unchanged and business writes are zero. The bounded last-150-line journal query contained no matching daily-summary request; no transport-log claim is made.

Immediate frontend rollback: `a81545bf-4463-4dc3-9b33-3cad855888d7`, tag `backup/production-before-phase6-rcm-scope-20260918`, snapshot `core-client-frontend-backup-20260918T093908Z`. Earlier recovery points remain. This completes the client dependency only; core-read API identity activation and final main integration remain pending.

## Expense read boundary and query encoding — deployed

Source `d5c6da689852e41eaa3087d42ef274a7e654bdda` applied at 2026-09-18T12:16:35.660036+00:00; main SHA256 `681aa6a12f0b9b7fbef6e914d47b82bf441dbbfa0a3fd7f4e48af1923a9b3cce`. Seven existing Expense GET routes require a current approved human, all-office authority and their parent/child page grants. All-office authority is required because existing Summary/Payroll/Filters/Wells responses contain global components or metadata; no report filter is misrepresented as isolation. Current Regional Manager Overview dependencies remain available. Calculations, classifications, posted/archive rules and records are unchanged.

A synthetic actual-handler test reproduced malformed-date fragments removing a later office selector and an ampersand splitting a department value. Sixty interpolated filter values in five handlers now use literal URL encoding. Canonical AST preservation verified that only encoding and access-boundary plumbing changed. No malformed request was sent to production.

267 guarded native tests, 17 retained backend suites and 13 materializer tests PASS. The existing reconciliation-validator gained only its already-used `GET /v2/expenses/summary` route, retaining its current credential and expiry. Its dispatcher compatibility and unchanged response passed before the human gate activated. Other job identities/helpers remain unchanged. All seven missing identities return 401; off-scope reads and job writes return 403; permitted Summary and Payroll reads remain 200. The same-period Summary result is unchanged. All 78,471 guarded original Supabase rows and 83,961 SQLite rows are preserved. Production, QA and QA API health PASS. Frontend/provider configuration and the frozen accounting register remain unchanged.

Live signed-in Expense (This Year / All Offices) reloads without alerts, permission/load warnings or captured console errors. Filters and Overview render. Live positives used Super Admin; restricted/other roles were tested synthetically. No provider, export, financial, clinical or approval action occurred.

Recovery: `backup/api-before-phase6-expense-reads-20260918`, `api-expense-read-backup-20260918T121559Z`. Private backup files stay on the server. Restore only the freshly captured current job configuration; never reinstate the previously revoked credential. Remaining API review, final regression and canonical-main integration are still open.

## Metric and legacy helper read boundary — deployed

Source `749d8ee3900c25169f7c59e467f764665c91329b` applied at 2026-09-18T11:37:25.643504+00:00; main SHA256 `bbfa92220cdc8ca29592393b69ea84dffa1943ea39a1eaf9bc6b60b9f6c789a0`. Eight remaining metric/helper reads now require current human identity and their existing page/office authority. KPI hygiene and the provider alias retain actual scoped readers; Finance filter options validate the numeric multi-location parameter the handler consumes. Provider-email access follows existing compensation authority. Raw legacy diagnostics without a current frontend/job caller require the existing all-office administrative reader. Startup's stream reference is echo-only. No new background-job scope was granted.

253 guarded native tests, 17 retained backend suites and 13 materializer tests PASS. The original shared-key-only bypass was reproduced in three actual handlers using synthetic data. All route bodies and 27 unrelated materialized files are unchanged. Candidate/live missing identities return 401 on all eight routes; unattended job reads are denied 403. Existing scoped summary/payroll reads remain 200, summary content is unchanged and job writes remain 403. All 78,465 guarded original business/audit rows and 83,957 SQLite rows are preserved. Provider/configuration/job/frontend checks and production/QA HTTP/API health PASS.

Live signed-in KPI Main and Specialty views and Financial Analytics render without unavailable/permission warnings, alerts or captured console errors. Live positive checks used the existing Super Admin session. Raw legacy reads and provider-email lookup were not exercised against real records; their positive/negative cases passed natively. No provider sync, export, email, purchase, approval, clinical write or financial correction was executed.

Recovery: `backup/api-before-phase6-metric-reads-20260918`, `api-metric-read-backup-20260918T113657Z`. Private source/configuration recovery files remain on the server. Do not restore the revoked reconciliation-validator credential from an older backup. Remaining financial/RCM/provider route review, final regression and normal main integration are still pending.

## Core aggregate read identity and office boundary — deployed

Source `14933358e819deb11559daa1703f23aa7a0ea427` applied at 2026-09-18T11:03:00.050385+00:00; main SHA256 `23f8ec28eb5e2c63dadea80cf34bf97a7f32c2d4c8ee8bf1b800675073aa3eb4`. Sixteen aggregate GET routes now require current human identity, actual page grants and the office selector used by the handler. Global-only handlers require all-office authority; unknown/conflicting selectors fail closed. Existing exact GET-only job identities and expiry remain unchanged. Goal writes retain their separate maintenance policy. No calculation body, schema, business rule or provider connection changed.

237 guarded native tests, 17 retained backend suites and materializer verification PASS. All route bodies and 26 unrelated materialized files are unchanged. Candidate and public production missing-identity checks return 401 on all 16 reads; invalid identity returns 401, approved scoped validator summary and payroll reads return 200, and job writes return 403. The saved summary result is unchanged. All 78,455 guarded original business/audit rows and 83,957 original SQLite rows are preserved; current configuration, credentials, jobs and frontend remain unchanged. Production and QA HTTP/API health PASS.

Signed-in production Expense (including Last Month / Eatontown and five unchanged displayed ratios), KPIs, Executive Overview, Financial Reports and RCM pass read-only UI checks with no captured console errors or alerts. RCM source status shows September 18 and an available payment breakdown. Live human checks used the existing Super Admin session; other role/office positives and negatives used synthetic native identities. No real report export, workflow action, provider sync, email or financial correction was executed.

Recovery: `backup/api-before-phase6-core-reads-20260918`, `api-core-read-backup-20260918T110234Z`. Private source/configuration recovery files remain server-side; never reinstate the revoked reconciliation-validator credential. Automatic approval review initially rejected activation for unclear scope; the same action was approved after the exact existing user authorization and test evidence were supplied. No extra user approval or workaround was used. Remaining route review, final regression and normal main integration remain pending.

## Expense denominator office-scope repair — deployed

Frontend source `7f9502208cd261684f064bc76e16ecb79b1d561c` is live in production `9509cba3-dd00-4084-9c14-e64ffd7ff390` and QA `559189b1-5a28-4cea-90ba-c0e00bbe2a5e`. Selected offices are validated and deduplicated before denominator reads. Multiple selected offices receive separate scoped requests; their results are combined only when all required numeric values are present. Unknown offices fail before fetching. Existing single-office/all-office parsing and calculations are preserved. Four new tests failed on the old implementation before the small repair.

All 1,660 frontend tests (zero skips), both builds and production/QA configuration-isolation checks PASS. Compiled checks: six retained Expense request-isolation cases, six new office-scope cases per environment, and three preserved RCM cases per environment PASS. Production entry `index-CmE5HSJ_.js` is 8,833,924 bytes; QA entry `index-D04awMLd.js` is 8,832,755 bytes. This is a 623-byte increase from the prior scope release; no speedup claim is made.

Live production Expense Report / Last Month / Eatontown completes and renders denominator ratios without captured console errors or alerts. Production has no QA banner; QA visibly retains its banner and intentionally disabled product API. Multiple-office request behavior is covered in compiled tests; the live administrator filter offers one office at a time. All six August 1–31 production/collections comparisons (all offices, Eatontown and Brick) are unchanged, all 17,363 guarded original rows are preserved, and backend source is unchanged. Business writes: zero. Existing accounting caveats and the frozen residual register are unchanged; displayed diagnostic totals are not claimed as reconciled accounting totals.

Recovery: prior production `08f84700-056f-4af4-8f13-526a66ad8187`, tag `backup/production-before-phase6-expense-scope-20260918`, snapshot `expense-client-frontend-backup-20260918T105236Z`. This completes the frontend prerequisite. The separately tested core-read API gate is not yet claimed live by this entry; remaining API review and canonical main integration are pending.

## Existing validator read compatibility — deployed

Source `471290102ae1c28bcd08170529cbc97adcfdbb10` applied at 2026-09-18T10:13:00.519802+00:00. The existing dashboard and reconciliation validators now have only their reviewed additional GET routes; the existing data validator has its own separate exact read-only identity. Schedules, provider configuration, calculation logic and human access are unchanged. All application route bodies and 27 unrelated materialized files match the preceding release.

220 native identity/framework/helper tests and 13 materializer checks PASS. The 17 retained business suites are reused from the identical maintenance implementation, not claimed as rerun. Three live validator reads return 200 with unchanged responses; off-scope reads and writes return 403. No full job, provider action, financial write or schema change was executed. All 78,449 guarded original rows and 83,957 SQLite rows are preserved. Production/QA health PASS; current frontend remains `08f84700-056f-4af4-8f13-526a66ad8187`.

A release-script variable collision exposed the existing reconciliation-validator credential in tool output. It was replaced privately; the prior token now returns 401, the replacement read returns 200 and off-scope/write attempts return 403. Its routes and December 16 expiry are unchanged. Other job credentials are unchanged. Receipt handling was repaired and private original evidence preserved. Never reinstate the exposed credential when restoring an earlier configuration snapshot.

Recovery: `backup/api-before-phase6-core-jobs-20260918`, `api-core-jobs-backup-20260918T100733Z`, plus the equivalent-rotation record `core-job-equivalent-rotation-20260918T101520Z`. Source and private configuration backups remain on the server. Only the sanitized receipt is copied locally; automatic approval review rejected local transfer of credential-bearing recovery files. The human core-read gate is the next separate candidate; Phase 6 and main integration remain in progress.

## Legacy goal and EOD maintenance boundary â€” deployed

Source `288fdf7dc9feff34685ee169acef872ca5e1d7d5` applied at 2026-09-18T09:12:02.345983+00:00; main SHA256 `c3e8cce7e212b3d56e043e98cab682745ed402346f646074edb467286d90b333`. POST legacy goals now requires current active approved Super Admin/all-office authority, matching Management. Backend-only EOD queue sync requires Super Admin or Admin with the existing Sync grant and all-office authority. Ordinary EOD viewers and read-only job identities cannot execute either operation. Existing goal GET, ordinary EOD reads and every route body remain unchanged.

207 native API tests, 17 retained backend suites and 13 materializer tests PASS. The first local materializer attempt could not access its private temporary folders under the sandbox; the same tests passed with the required local access. The native suites recorded zero blocked network/business-data attempts. All 25 unrelated materialized files are unchanged. Candidate/live missing/invalid requests return 401 and existing read-only job identities return 403. Payroll validator remains 200. No real goal write or queue synchronization was executed; production mutation probes used only denied identities, an empty goal body and dry_run=true.

All 78,445 guarded original business/audit rows, including 36 legacy goals and 128 office goals, and all 83,957 original SQLite clinical/reference rows are preserved. No schema, provider/config/job/frontend change. Production/QA health PASS. The signed-in Sync Dashboard renders 29 jobs with no captured errors/alerts; no job was triggered. Recovery: `backup/api-before-phase6-maintenance-20260918`, `api-maintenance-backup-20260918T091128Z`. Private rollback copy preserved locally and remotely. Phase 6 and main integration remain in progress.

## Completed work â€” do not rerun

Groups Aâ€“E are applied and verified. Their SQL hashes, row guards, role/audit tests and recovery directories are in the [full report](../production-release/CLOSURE.md) and [inventory](../production-release/release-inventory.json). B's first stale-count verifier attempt rolled back; the unchanged SQL passed with fresh guards. Group C rollback must preserve deletion history.

API protection releases are verified for payroll, report export, compensation, OTP administration, signed Plaid webhook, administration, RCM contacts, Huddle/EOD reads, legacy Amazon requests/history, directory/patient/appointment reads and legacy goal/EOD maintenance. Detailed route scope and per-release evidence are in API-ACCESS.md and the separate API-* documents. Do not rerun these releases or expose scoped credentials. Three scoped identities now exist, with expiry 2026-12-16T22:55:05.380984+00:00. The exposed reconciliation credential has been revoked; never restore it from older backups.

Dated Payroll Comparison completed for August 2â€“15, 2026: live UI and read-only source response agree on 13 rows. Never reopen the crash-prone native date picker. Native comparison used read-only SQLite and two Supabase GETs; no provider calls/writes. No matching HTTP access log existed; transport identity is separately verified.

MCP ingress review passed: the existing downstream FastMCP verifier requires its dedicated credential, missing/invalid local requests are 401 and public requests 403. OAuth metadata does not authorize downstream access. No Collaboration configuration or tools were changed/executed.

## Remaining execution

1. Complete the remaining API route classification and justified bounded protections: core/RCM/Expense reads and actual office filtering; compatibility for each current unattended reader; remaining Amazon cart/purchase/sync/setup operations; Gusto/Amazon setup callbacks. The 159 declarations in `remaining-api-route-inventory.json` are inventory, not a vulnerability count.
2. Preserve existing schedules/provider integrations. `dashboard-api-callers-review.json` and `scheduled-api-dependencies-v2.json` capture read-only consumer review. The latter inspected 63 scheduled/dependent scripts, without running or changing them. Dashboard validators, Plaid readers, cache prewarming, payroll balance/morning brief readers and Collaboration daily reports need exact compatibility. The Collaboration app itself is outside this release's edit scope.
3. Finish final read-only production/QA regression and data/config checks. Fetch/recheck canonical main, then normally fast-forward verified intended production source and push. Main remains `820970ede7727830d95d8d03d518d02119da1acd` at last check. Preserve any newer legitimate work, the Phase 6 branch and all tags. No force push.

Next: core/RCM/Expense read permissions, actual office filtering and scoped-job compatibility, then remaining provider/setup/execution boundaries. The RCM status selected-office client dependency is now live and verified; job compatibility is now deployed. Prepare the separate human core-read gate from `prepare-core-read-candidate.py`, after confirming its receipt and the credential revocation. RcmDashboardTab already remounts on office/date/refresh changes. The core-read gate is deployed and verified from `14933358e819deb11559daa1703f23aa7a0ea427`. Its receipt and five-page live regression pass. Do not repeat deployment. Before activation confirm no old data-validator process is running. Its patch regression must use the original validator in the core-jobs backup, because the live helper is now patched. The current static frontend consumer inventory is `frontend-read-consumers.json`; follow services/hooks to actual tab grants, because literals/comments alone are not authorization proof. The patient fallback office filter is now repaired and verified; retain its bounded fetch behavior. Existing role resolution now retains both enabled and explicitly disabled permissions. Completion permissions include legitimate KPI/Reports consumers.

Gusto callback currently ignores state and persists before confirming token success; bounded inspection found no pending Gusto state or named authorization script. Amazon only checks state when saved state exists and can expose state in errors. Inspect legitimate setup consumers before the minimal state/token-persistence repair; no real OAuth flow or provider configuration may be changed during tests.

## Recovery and production safety

Current private API backup is `/home/openclaw/.cache/nudashboard-phase6-20260917/api-core-jobs-backup-20260918T100733Z` with the corresponding Git rollback tag above. All earlier snapshots/tags remain. Frontend rollback is `277f68be-3819-410c-8ca6-6aa5ffa2a95e`, tag `backup/production-before-phase6-frontend-20260918`, snapshot `frontend-backup-20260918T045834Z`.

One Huddle page initialized an unsubmitted September 18 draft at 04:18:07 UTC, with 19 blank checklist and four blank provider children. Preserve it and avoid auto-initializing another; use history/review or read-only KPI/Reports consumers. Existing EOD freshness warning is not permission to trigger sync. Counts differ between fresh snapshots as intervening records appear; each deployment preserved its original rows, with no attribution of unrelated changes.

Financial follow-up is frozen: no record/classification/archive/card metadata changes, reconciliation searches, bank logins, provider syncs, emails, purchases, approvals, clinical writes or real workflow execution. TwiML is an existing intentionally external static call flow and remains separate. Do not alter Collaboration Platform or begin another phase.

Current browser: production tab 68 on Expense Report, This Year / All Offices, verified after the Expense gate; no alerts or captured errors. QA tab 69 remains available.
