# NuDental Dashboard â€” full release report

## Phase 6 COMPLETE — September 20, 2026

The final two reviewed report-read gates are active and live-verified: `/v2/rcm/ar-aging-official` and `/v2/rcm/ar-location-health`. This completes the approved Phase 6 hardening scope. No next phase is authorized or started. Earlier pending-status statements below describe historical checkpoints and are superseded by this closure.

Only the reviewed `api_financial_read_policy.py` was deployed from `19cfc40081b3b6cfd1422073c4fed66dad9adc45` at 2026-09-20T05:20:45.804119+00:00. Its canonical template, materializer manifest and focused regression tests were updated with it. The two pending exclusions were removed; route handlers, calculations and all other executable policy behavior were preserved. Of 36 materialized runtime files, exactly one changed and 35 remained identical. Final source/process/asset parity passed at `2026-09-20T05:28:30.170683+00:00`.

| Final live check | Result |
|---|---|
| Real signed-in human, both routes on production and candidate | PASS: four HTTP 200 results |
| Missing or invalid human identity | PASS: HTTP 401 |
| Installed `collab-daily-report` identity | PASS: HTTP 200 for exactly the two approved GETs |
| Unrelated job identity, report-job access outside scope, POST/PUT/PATCH/DELETE | PASS: HTTP 403; no write executed |
| Signed-in production RCM Dashboard and Official A/R panel | PASS; no captured browser errors |
| Production API, candidate API, Collaboration and QA health | PASS: HTTP 200 |
| Production and QA frontend hashes | PASS: unchanged |
| QA database isolation and execution restrictions | PASS: retained |

Fresh verification: **328 guarded native API tests, 13 materializer tests, 34 live denial/job checks and four real-human report checks PASS**. Guards recorded no blocked network/business-write attempts. Earlier 1,678 frontend tests, both frontend builds and 17 retained backend suites remain preserved passing evidence; they were not rerun for this one-policy activation. Positive financial/provider write execution was intentionally not tested live. The temporary human verification session signed out with HTTP 204 and its local helper was stopped; no password or token was saved.

Only the two existing Dashboard API processes restarted: candidate 974384 → 1462638 and production 974401 → 1462955. Collaboration PID 1444861 stayed unchanged in this activation. The earlier separately approved Collaboration restart and exact report-caller adapter are preserved. No frontend restart or deployment occurred.

Production remains Pages `dcf8bc42-1a06-45f6-8010-80c1db7595be`, asset `/assets/index-DRITFcr0.js`, 8,835,047 bytes, SHA256 `25917d222e808abba8861d054c048cac90f7a6677743e9837d8c9023821a55fc`. QA remains Pages `ae279546-abd2-4720-a052-a9a34aa2d60b`, asset `/assets/index-BXvFvJGj.js`, 8,833,878 bytes, SHA256 `48716bfc332598a4462e23fa5cb92cf59a934c3f7eff475195ad4890ac05d8c8`. QA still has `product_api_ready=false`, a connected isolated QA database, blocked internet sockets and a hidden production home. No speedup is claimed for this activation.

Canonical development branch: `main`. Previous main: `0fb2de80ed3901d187dab8b2a9a80c552cde7681`. Integration is a normal fast-forward containing runtime source `19cfc40081b3b6cfd1422073c4fed66dad9adc45` plus this documentation closure; the exact resulting main SHA is recorded in `outputs/nudental-dashboard-current-release.json` and the saved source-closure receipt after push. Preserve `phase6/nudashboard-production-hardening-20260917` and all earlier branches/tags; no force push.

Rollback: annotated tag `backup/api-before-phase6-report-gates-20260920` and private server snapshot `/home/openclaw/.cache/nudashboard-phase6-20260917/api-report-gates-backup-20260920T051649Z`. The snapshot includes the current API source/configuration, process identities and current restricted-job registry. All eight installed identities and their exact scopes were preserved; the existing renewal deadline is 2026-12-16T22:55:05.380984+00:00. Never restore the previously revoked reconciliation-validator token from an older backup.

No database schema, financial source records, classifications, archives, accounting proposals, provider credentials, scheduled-job definitions, frontend assets or QA configuration changed in this activation. No provider sync, financial write, workflow execution, email delivery or purchase was run. Phase 5 residual accounting registers remain frozen and unchanged.

Nonblocking follow-up remains separate: the preexisting Collaboration trash-retention foreign-key failure on a referenced expired draft is unchanged; no purge or schema change was attempted. Preserve the earlier unsubmitted September 18 Huddle draft (19 blank checklist and four blank provider children). Job-identity renewal remains due by the existing December deadline. No additional Phase 6 implementation remains queued.

Evidence: `phase6-hardening/REPORT-GATES-CLOSURE-20260920.json`, local final-verification/human/native/UI receipts and the private server rollback directory. Prior detailed release evidence follows where present.

## Historical release evidence — earlier status statements superseded

## Independent Phase 6 release closure

All independent Dashboard work is deployed and verified. Groups A-E, frontend dependencies, dated Payroll Comparison and all route reviews are dispositioned. Six final production pages pass read-only UI checks: Executive Overview, Financial Analytics, Reports, Inventory, Huddle History and Insurance; prior RCM/Expense/dated Payroll checks remain preserved. API/production/QA health, source parity, artifact hashes and original-row guards PASS. Additional scheduled-script inspection found no unadapted literal provider consumer in the inspected script/calendar directories. No real provider call or scheduled job was executed for validation.

Canonical integration uses a normal fast-forward from `820970ede7727830d95d8d03d518d02119da1acd` to the Phase 6 closure commit containing this report. Application source is `78cc78da4affc54f4308a4731551a46f30854e17`; subsequent changes in this closure are documentation only. Recovery tag: `backup/main-before-phase6-independent-closure-20260918`. The exact resulting main SHA is recorded in the saved release pointer and final Git verification receipt after push. Preserve the Phase 6 branch and all prior tags; no force push.

**Phase 6 is NOT complete.** Only two already-reviewed human gates await the pending Collaboration activation decision: `/v2/rcm/ar-aging-official` and `/v2/rcm/ar-location-health`. Its cached report helper needs a process restart; startup immediately ticks the scheduler and may dispatch due work. No answer authorizing that side effect is recorded. Choose a planned restart/deferment or explicitly allow restart and normal scheduled work. Dashboard releases and source closure do not authorize that action. All other currently available independent work is complete. Accounting residuals remain separate and frozen.

Updated 2026-09-18T14:57:45.285536+00:00 from saved deployment and verification evidence.

**Phase 6 IN PROGRESS: Groups A-E, frontend and all independent API groups are live and verified.** Two report-dependent human gates await the Collaboration restart/scheduler decision. Independent regression and source closure are complete; Phase 6 remains incomplete pending that activation decision.

## Current production

| Item | State |
|---|---|
| URL | https://nudashboard.com |
| Frontend deployment | `dcf8bc42-1a06-45f6-8010-80c1db7595be` |
| Frontend source | `009005b03767dc3dc9facdbfc5f9fa81fa001d49` |
| Previous deployment | `9509cba3-dd00-4084-9c14-e64ffd7ff390` |
| Canonical main | `main`, normal fast-forward to this verified Phase 6 closure; exact SHA in saved release pointer |
| Branch | `phase6/nudashboard-production-hardening-20260917` |
| API source | `78cc78da4affc54f4308a4731551a46f30854e17`; provider access and OAuth callbacks deployed |
| API main SHA256 | `7b85a17d6a9bac738bb4239b83326199c99957b499d14335e7d6934a95607917` |
| QA deployment | `ae279546-abd2-4720-a052-a9a34aa2d60b` |

## Provider access and OAuth callbacks - deployed

Source `78cc78da4affc54f4308a4731551a46f30854e17` applied at 2026-09-18T14:36:16.903788+00:00; API main SHA256 `7b85a17d6a9bac738bb4239b83326199c99957b499d14335e7d6934a95607917`. All 22 previously remaining provider declarations are reviewed: 20 existing control/read declarations require current human identity, and two public redirect callbacks require a valid short-lived, one-use administrator-created intent. A minimal authenticated Gusto authorization-URL route provides the missing intent initiation, making 21 control/read declarations. Catalog/status use the existing Front Desk grant; global provider controls require the active approved Super Admin. Existing request/review permissions remain unchanged.

Gusto no longer exchanges a missing-state callback or overwrites its token file after a failed exchange. Amazon no longer accepts callback state when no intent was saved. Intent hashes are held separately from provider credentials and process locking prevents replay. Existing credentials, scopes, redirect destinations and refresh logic are preserved. Positive provider tests used synthetic transports only; no real authorization, sync, delivery or purchase was executed.

Separate `plaid-sync`, `morning-brief` and `payroll-balance-watch` identities retain only their existing exact GETs. Fixed loopback origins and redirect rejection prevent credential forwarding. Their schedule and business-processing AST remain unchanged. Four prior identities and their credentials/expiry are preserved. All seven identities retain the existing December 16 renewal deadline; never restore the revoked reconciliation-validator token.

**Verification:** 324 guarded native tests, 17 retained backend suites, 13 materializer tests and two exact external-caller checks PASS. Live missing/invalid identity checks return 401; unrelated jobs and writes return 403; both callbacks reject missing intent before a provider call. Same-period Summary/RCM results remain unchanged. All 79,171 guarded original Supabase rows and 83,991 original SQLite rows are preserved. Schemas, provider configuration, scheduled jobs and financial source records are unchanged.

Final read-only parity at 2026-09-18T14:52:28.766982+00:00: all 36 materialized files and both external caller adapters match. Production/QA/API HTTP health PASS; QA retains `product_api_ready=false`. Frontend artifacts remain production `index-DRITFcr0.js` (8,835,047 bytes) and QA `index-BXvFvJGj.js` (8,833,878 bytes). No new speedup claim is made.

Recovery: `backup/api-before-phase6-provider-reads-20260918`, `api-provider-read-backup-20260918T143542Z`. Full source/config/caller recovery copies stay private on the server. Existing frontend rollback deployments and all earlier tags remain.

**Remaining:** Two report-dependent human gates await the Collaboration restart/scheduler decision. Independent regression and source closure are complete; Phase 6 remains incomplete pending that activation decision. No Collaboration source, credential, process or scheduler was changed. Accounting follow-up remains frozen.

## Independent financial and RCM read boundary — deployed

Source `ab7d6a1fa1f9be5ba1e62ec20b944be84cc12d85` applied at 2026-09-18T14:09:31.452282+00:00; API main SHA256 `cc058c5e9b4dc86d3fb0cb0ad3f3d887f58c3a57eac908550c372f4f53da8eb5`. Twenty-three GET readers require current human identity, their existing page grants and the actual office selector. Unknown/conflicting/ignored selectors fail closed. Existing RCM Dashboard, Operations A/R/Payors and Executive Overview dependencies are preserved. Legacy extra field keys cannot elevate a non-Super-Admin or a job. REST literal encoding preserves Marketing/outreach scope; office-scoped statements withhold the company-wide total. Financial calculation ASTs, source records and posted/archive rules are unchanged.

304 guarded native tests, 17 retained backend suites and 13 materializer tests PASS. A local rerun initially hit Windows sandbox temporary-directory permissions; the unchanged suite passed with normal filesystem access. Retained v1/v2 main and service bytes are identical. Other main functions and 28 materialized files are unchanged.

Existing three validator credentials and expiries are preserved; only their already-used exact financial GET scopes were added. A separate cache-prewarmer identity is bound to its two existing loopback reads. Real credential validation passed with synthetic downstream handlers; no complete job was run. Missing/invalid identities return 401, off-scope jobs and writes return 403. Live same-period Summary and RCM Dashboard responses are unchanged; Payroll compatibility remains 200.

All 79,171 guarded original Supabase rows and 83,983 original SQLite rows are preserved. Production/QA/API HTTP health PASS. Live signed-in RCM Dashboard / Brick / Last Month renders all six major panels with no alert, access failure, loading state or captured console error. Restricted/other-role positives and negatives were verified synthetically. Frontend deployments, provider configuration, financial records, schemas and schedules are unchanged.

**Pending integration decision:** `/v2/rcm/ar-aging-official` and `/v2/rcm/ar-location-health` human gates remain inactive because the existing Collaboration API caches its daily-report helper and restarting it immediately ticks its scheduler. Dr. G has been asked whether to defer those two gates to a planned restart or allow restart and normal scheduled work. No Collaboration source, credential, process or scheduler was changed. The proposed source adapter is prepared only.

Recovery: `backup/api-before-phase6-financial-reads-20260918`, `api-financial-read-backup-20260918T140856Z`. Private backups stay server-side; preserve current credential generation and never restore the revoked reconciliation token. The provider declarations are now dispositioned by the later provider release; the two report-dependent gates remain pending. Phase 6 is NOT complete; accounting follow-up remains frozen.

## RCM snapshot and eAssist read boundary — deployed

API source `91cb7ab8b9c45c359d1fdc6513480007f1c72278` applied at 2026-09-18T13:31:39.774530+00:00; main SHA256 `21b7b3b958394af37d14b127f22ba36161a95d3a19930ed1c04d8cf68fb0d188`. Six GET routes require current human RCM/administrative authority and actual office scope. Office-scoped legacy snapshots no longer disclose company totals or reconciliation metadata; all-office calculations and values are preserved. eAssist literal query encoding prevents date fragments dropping later scope filters. Scoped status queries read only the requested office and skip global logs/staging counts. No job grant, credential, schedule, provider configuration, schema or financial source change.

283 guarded native tests, all 17 retained suites and 13 materializer tests PASS. The old pagination harness's six unchanged tests passed with the new synthetic request/query context; the original failure remains preserved. Other route bodies and 29 materialized files are unchanged. Live missing/invalid identities return 401, unrelated jobs return 403, existing Summary/Payroll reads remain 200 and the saved Summary is unchanged.

All 79,171 original guarded Supabase rows and 83,970 SQLite rows are preserved. Production/QA/API health PASS. Signed-in Super Admin eAssist / Brick renders without visible access failures, alerts or captured console errors. Other role/office positives and negatives, and legacy snapshot positive behavior, were tested with synthetic native handlers. The bounded journal query contained no matching access entry; no transport-log claim is made. No business/provider action was executed.

Recovery: `backup/api-before-phase6-rcm-snapshots-20260918`, `api-rcm-snapshot-backup-20260918T133108Z`. Private backups stay server-side; never restore the revoked reconciliation credential. Remaining RCM/financial/provider route review, final regression and canonical-main integration remain pending. Phase 6 is NOT complete.

## RCM A/R and eAssist request scope — deployed

Frontend `009005b03767dc3dc9facdbfc5f9fa81fa001d49` is live in production `dcf8bc42-1a06-45f6-8010-80c1db7595be` and QA `ae279546-abd2-4720-a052-a9a34aa2d60b`. Selected A/R offices generate distinct validated requests; global or incomplete scoped replies fail closed. eAssist status carries the selected office, report filters honor the parent office, and parent scope changes isolate earlier responses. Existing calculations are unchanged. The later snapshot/eAssist API activation is documented above.

All 1,678 frontend tests PASS with zero skips, both builds and environment isolation PASS. Each compiled environment passes six A/R scope, six Expense request isolation, six retained Expense denominator and three RCM status checks. Production entry is 8,835,047 bytes; no speedup claim. Live production eAssist Eatontown/Brick selection and settled Brick A/R Aging PASS with no captured errors, alerts or scope warnings. QA layout/banner PASS; its financial API remains intentionally disabled.

Six August 1–31 read-only metric comparisons are unchanged. All 17,363 original guarded rows are preserved; backend source is unchanged and business writes are zero. Recovery: `9509cba3-dd00-4084-9c14-e64ffd7ff390`, tag `backup/production-before-phase6-rcm-read-scope-20260918`, snapshot `rcm-read-client-frontend-backup-20260918T130751Z`. Remaining RCM/financial/provider API review, final regression and normal main integration remain open.

## Legacy status readers — deployed

Source `0b108413241076358123eb0e4e1e87197c132ffb` applied at 2026-09-18T12:30:15.853167+00:00. Three entries in the existing administrative policy now protect Sync status, Supabase table status and Gusto import status. There is no current frontend/scheduled consumer requiring anonymous access. All-office Admin/Super Admin or the exact existing Sync/Data Health page grant is required. Public health and static Compliance responses remain unchanged. Main source SHA256 remains `681aa6a12f0b9b7fbef6e914d47b82bf441dbbfa0a3fd7f4e48af1923a9b3cce`; no handler or calculation changed.

271 guarded native tests and 13 materializer tests PASS. All 17 retained backend suites from the immediately preceding Expense candidate passed; their main/service inputs are byte-identical. All 30 other materialized files are unchanged. Live missing/invalid identities return 401, job access to these routes returns 403, and existing Summary/Payroll reads remain 200 with unchanged Summary data. All 78,473 original guarded Supabase rows and 83,962 SQLite rows are preserved. Current credentials, job scopes, configuration, frontend and provider connections are unchanged. Production/QA/API health PASS. Signed-in Expense reloads without alerts, warnings or captured browser errors. Positive status-handler tests were synthetic because no active UI uses these legacy paths.

Recovery: `backup/api-before-phase6-status-reads-20260918`, `api-status-read-backup-20260918T122943Z`. Private recovery files remain server-side. Do not restore the revoked reconciliation credential. RCM/financial/provider route review, final regression and canonical-main integration remain pending; Phase 6 is not complete.

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

## RCM selected-office status repair — deployed

Frontend source `f3e427f7b94c96eb44424e7791c10051f30817cd` is live in production `08f84700-056f-4af4-8f13-526a66ad8187` and isolated QA `707f2962-0ed0-406e-baa5-25cc49f40bc4`. The Data Source Status widget now forwards the selected office to the daily-summary service; unknown offices fail before making a request. Existing all-office behavior and the parent request isolation remain intact. Five new tests reproduced the defect before the two-file repair.

All 1,654 frontend tests (zero skips), six compiled Expense isolation checks and three compiled RCM checks in each environment PASS. Both builds and environment-isolation checks PASS. Production entry `index-DHO0teuA.js` is 8,833,301 bytes (previous 8,833,241); QA entry `index-CUhTuMEX.js` is 8,832,132 bytes. No speedup claim is made for this 60-byte scope repair.

Live production RCM / Eatontown / Last Month renders all eight sections, today's September 18 daily summary and an available payment breakdown; captured errors and alerts are empty. QA layout and banner render with financial reads intentionally disabled by `product_api_ready=false`. Production/QA HTTP and API health PASS. Four production/collections metric comparisons for August 1–31, all offices and Eatontown, are unchanged. All 17,363 guarded original rows are preserved, backend source is unchanged and business writes are zero. The bounded last-150-line journal query contained no matching daily-summary request; no transport-log claim is made.

Immediate frontend rollback: `a81545bf-4463-4dc3-9b33-3cad855888d7`, tag `backup/production-before-phase6-rcm-scope-20260918`, snapshot `core-client-frontend-backup-20260918T093908Z`. Earlier recovery points remain. This completes the client dependency only; core-read API identity activation and final main integration remain pending.

## Administrative API boundary â€” deployed

Source `cf9cff66d030b7c14943f60d10f51e895a9cc650` applied at 2026-09-18T07:26:41.952563+00:00; main SHA256 `8b057829ac239c2d4aa4b9815b6823ea114fb90a3885829c669235728655e8ef`. Ten diagnostic/maintenance routes now require verified human identity, existing role/page permission and all-office scope. Jobs are denied. Existing route bodies are unchanged. 136 native tests, 17 retained backend suites and 13 materializer checks PASS. Candidate and production denial probes PASS; the existing payroll validator remains 200.

Fresh guards preserved all 20,868 original rows; provider configuration, job credentials, schedules, service settings and frontend artifact are unchanged. Live Sync Dashboard renders API Proxy Online and 29 job entries, with no captured console errors. No sync, recomputation, seed or other maintenance action was triggered. Production and QA HTTP/API health PASS. Recovery: `backup/api-before-phase6-admin-20260918`, `api-admin-backup-20260918T072624Z`. The full private backup is preserved locally and on the existing server.

These row counts are per-deployment snapshots. Intervening records existed before this release; no cause is attributed and accounting follow-up remains frozen.

## RCM contact-record identity and office boundary â€” deployed

Source `209d518538390c1384e2c9505993be80d38f3bc1` applied at 2026-09-18T07:43:24.066901+00:00; main SHA256 `734a190e8f5558fe103e25186e9f960da33c77c7713e6034ae3a14440c709372`. Four manual-contact routes now verify the current account, Statements permission and actual office scope. Created actor/name and office name cannot be forged. Updates bind to the existing record's checked office; request filters are encoded. Nullable legacy office records remain editable only by all-office users. No delivery functionality changed.

149 native tests and 17 retained suites PASS; isolated QA Super Admin/Office Manager/Regional Manager identity resolution and invalid-session checks PASS. Inactive/unapproved QA sessions were expired, so live negatives were not rerun; native negatives remain covered. All 20,870 fresh guarded original rows and configuration/jobs are preserved; the production contact-attempt table remained empty. Candidate and production missing/invalid 401 and job 403 probes PASS, existing payroll validator 200. Live Patient AR Follow-Up rendered 30 rows with no contact-summary warning/error. Positive creates/edits used synthetic native storage only; zero real contact records or provider actions were performed. Production/QA health PASS.

Recovery: `backup/api-before-phase6-contacts-20260918`, `api-contact-backup-20260918T074308Z`. Private backups are preserved locally and on the server. Final main integration remains pending the remaining route review and regression.

## Huddle/EOD read and record-office boundary â€” deployed

Source `1456c8684f955bb359b21a4d9b56e33b6611a858` applied at 2026-09-18T08:08:51.798392+00:00; main SHA256 `242ced3002edd136a68548e5448454fb53d6586bd2f364e4ffe6821a4380cb11`. Six read route declarations now verify current identity, existing page permissions and the actual office selector. Completion preserves existing KPI/Reports consumers. Contact history checks the stored queue office before fetching contacts; assignees require active, approved accounts. Explicit false role permissions override relevant existing fallback grants. No execution or sync capability was added.

164 native tests and 17 retained backend suites PASS under network/business-data guards; 21 unrelated materialized files and all unrelated route bodies are unchanged. Candidate/live missing or invalid identities return 401 and read-only jobs return 403. The existing payroll validator remains 200. All 78,146 fresh guarded original rows are preserved, including 6,476 treatment queue and 50,798 procedure rows. Source/config/job/frontend checks and production/QA health PASS. Signed-in production KPIs, including Treatment Acceptance Rate, render with no captured errors. No Huddle initialization, real submission, workflow execution, provider action or accounting correction was performed.

Recovery: `backup/api-before-phase6-workflow-20260918`, `api-workflow-backup-20260918T080821Z`. Private rollback evidence exists locally and on the server. Remaining route review and final main integration are pending.

## Legacy Amazon request identity/office boundary â€” deployed

Source `34e9f2f008dad5bccdd2ed0c75ff8f3ee8c16c59` applied at 2026-09-18T08:27:00.919486+00:00; main SHA256 `00c18f7187717386f51c1d11af0d9dbd54047e82d202f6ebd505a2e7d5a83457`. Five request/history route declarations now verify current human identity and existing request/page/review grants. Creation binds actor and canonical office. Review requires Regional Manager/Admin/Super Admin, pending state, the stored office and no self-review. Conditional updates guard concurrent office/requester/state changes. Read filters are encoded. Existing schema fields replace the previously nonexistent reviewer columns; rejection attribution is in the existing service journal, not a newly claimed database/UI audit trail.

177 native tests and 17 retained backend suites PASS under network/business-data guards; 23 unrelated materialized files and all unrelated route bodies are unchanged. Candidate/live missing or invalid identities return 401; read-only job credentials return 403. The existing payroll validator remains 200. All 78,277 fresh guarded original rows are preserved, including zero legacy order requests and 129 order-history records. RLS on the request table remains enabled with no ordinary policies. No schema/policy, provider/config/job/frontend change was needed. Production/QA health PASS. The signed-in Front Desk Amazon Order History view displays 129 records with no captured errors; its existing Supabase client is unchanged.

No real order, request, approval, rejection, cart, purchase, provider authorization or sync was executed. Cart/purchase/sync/OAuth APIs remain separate pending groups. Recovery: `backup/api-before-phase6-orders-20260918`, `api-order-backup-20260918T082630Z`. The private backup is preserved locally and on the server. Phase 6 and main integration remain in progress.

## Directory, patient and appointment read boundary â€” deployed

Source `c255989905a562e295ce0ed7fc64963716dc323c` applied at 2026-09-18T08:52:18.592198+00:00; main SHA256 `2f95be52354db8cdb47a960fbecce8ef3dce0d1742232738f4cf7bf19dfaa72b`. Eight route declarations now verify current human identity and their existing page/admin grants. Reference directories remain available to active approved signed-in pickers. Aggregate reads enforce actual office selectors, including supported CSV selections, and respect explicit disabled permissions. Raw patient/appointment lists and unscoped provider schedules require existing all-office administrative read authority.

The patient-service fallback reproduced returning a foreign-office synthetic record. The targeted repair filters mapped records before response limiting/cache; the SQLite path and unrelated service/route bodies remain unchanged. Existing bounded provider fetch limits are not increased. No real provider call was used in reproduction or tests.

194 native tests and 17 retained suites PASS with zero network/business-data guard attempts. The actual call-site inventory confirms none of the eight routes has an existing unattended caller; no job scope changed. Candidate/live missing or invalid identity requests return 401, read-only job credentials return 403, and the existing payroll validator remains 200. All 78,279 guarded business/audit rows and 83,957 original SQLite clinical/reference rows are preserved. No schema, configuration, job, provider-connection or frontend change. Production/QA health PASS.

The signed-in production KPI page renders its patient, appointment and treatment summary labels with no captured errors or alerts. This is read-only UI verification; no patient detail, workflow, provider sync or financial write was executed. Recovery: `backup/api-before-phase6-clinical-reads-20260918`, `api-clinical-read-backup-20260918T085142Z`; private backup preserved locally and on the server. Phase 6 and main integration remain in progress.

## Legacy goal and EOD maintenance boundary â€” deployed

Source `288fdf7dc9feff34685ee169acef872ca5e1d7d5` applied at 2026-09-18T09:12:02.345983+00:00; main SHA256 `c3e8cce7e212b3d56e043e98cab682745ed402346f646074edb467286d90b333`. POST legacy goals now requires current active approved Super Admin/all-office authority, matching Management. Backend-only EOD queue sync requires Super Admin or Admin with the existing Sync grant and all-office authority. Ordinary EOD viewers and read-only job identities cannot execute either operation. Existing goal GET, ordinary EOD reads and every route body remain unchanged.

207 native API tests, 17 retained backend suites and 13 materializer tests PASS. The first local materializer attempt could not access its private temporary folders under the sandbox; the same tests passed with the required local access. The native suites recorded zero blocked network/business-data attempts. All 25 unrelated materialized files are unchanged. Candidate/live missing/invalid requests return 401 and existing read-only job identities return 403. Payroll validator remains 200. No real goal write or queue synchronization was executed; production mutation probes used only denied identities, an empty goal body and dry_run=true.

All 78,445 guarded original business/audit rows, including 36 legacy goals and 128 office goals, and all 83,957 original SQLite clinical/reference rows are preserved. No schema, provider/config/job/frontend change. Production/QA health PASS. The signed-in Sync Dashboard renders 29 jobs with no captured errors/alerts; no job was triggered. Recovery: `backup/api-before-phase6-maintenance-20260918`, `api-maintenance-backup-20260918T091128Z`. Private rollback copy preserved locally and remotely. Phase 6 and main integration remain in progress.

## Applied migration groups

| Group | Production result | Guarded rows | Recovery directory |
|---|---|---:|---|
| A | DEPLOYED / native permission and UI checks PASS | 4,425 | `production-a-20260917T215054Z` |
| B | DEPLOYED / native permission and UI checks PASS | 18,929 | `production-b-20260918T043032Z` |
| C | DEPLOYED / native permission and UI checks PASS | 4,428 | `production-c-20260918T043735Z` |
| D | DEPLOYED / native permission and UI checks PASS | 5,701 | `production-d-20260918T044339Z` |
| E | DEPLOYED / native permission and UI checks PASS | 5,072 | `production-e-20260918T045042Z` |

Each apply preserved all guarded original rows, owners and grants. These table scopes overlap and must not be summed. Bâ€“E each used current counts for 13 active accounts and checked the expected role visibility inside the locked apply transaction. Native health, exact candidate catalog, role visibility and representative live UI checks passed. Fresh backups and rollback SQL remain local and on the existing server.

Group B's first apply was safely rolled back after an old absolute-count reference failed. Investigation showed ordinary intervening records, not a policy expansion. The unchanged approved migration was then reapplied with a fresh per-deployment role reference. The failed attempt and exact rollback remain in `production-b-20260918T041614Z`. Group C rollback preserves deletion history; historical audit rows must never be deleted to restore the old foreign key.

## Frontend, tests and live checks

The production build now activates atomic office assignment, atomic supply drafts/receipts, and the Regional Manager/Admin/Super Admin Front Desk review route with no self-approval. QA keys, identities, synthetic records, adapters, banners and storage configuration were excluded.

- Fresh 1,648 frontend tests PASS, zero failures/skips; production build PASS; six compiled request-isolation checks PASS. Production source matches the copied build inputs.
- Hosted QA native contracts remain A 12 / B 11 / C 10 / D 15 / E 10, all PASS against the exact deployed SQL. Write, denied-write, retry, audit and bypass cases used rolled-back synthetic QA fixtures.
- Retained payroll release evidence: 52 local tests, 58 native runtime/FastAPI tests, 17 backend suites and 13 materializer checks PASS. No accounting calculation change.
- Production Huddle history/review, EOD, implant/bone inventory, Front Desk history/catalog, clinical supply overview, Insurance and Service Goals PASS. No approvals, clinical stock changes, insurance submissions or financial actions were executed.
- New live Front Desk Approvals route PASS on the new asset: three visible Front Desk requests, two pending; no self-approval guidance present; no action submitted. No captured console errors.
- Dated Payroll Comparison now renders August 2â€“15, 2026 with 13 rows; date-required guard absent. Keyboard events succeeded without using the native picker. The exact native route response independently returned the same selected dates and 13 rows using read-only SQLite and two Supabase GETs. No matching HTTP access-log record was available; employee-level amounts were not exported.
- Production and QA frontend/API health PASS. Production and QA live asset hashes match their own manifests; QA retains `product_api_ready=false`.

## Bounded report-export API repair â€” deployed

Source `fa1730c752c4f26956c4d79b21e025e035a69f55` deployed at 2026-09-18 05:53:57 UTC. Export permission and audit attribution now use the verified signed-in identity rather than body-supplied role/email/ID. All currently authorized exporters retain their existing grants. Internal reads forward only that identity to the fixed local API, without redirects. Jobs cannot export.

64 local tests, 75 native Python/FastAPI tests and all 17 retained backend suites PASS. All 28 report calculation/rendering/audit-writer functions are unchanged. Live missing/invalid sessions return 401; read-only job returns 403; existing payroll validator remains 200. No real export was executed. Authorized report generation was tested with the actual handler, synthetic data and an in-memory audit.

Fresh guards preserved 15,927 expense rows, 535 Gusto expense-fact rows, 663 expense-fact rows and all 93 export-audit rows. Configuration, existing job files and service units are unchanged. Production Reports still renders all eight sections/four export controls with no captured console errors. Production and QA health PASS. Recovery: `backup/api-before-phase6-reports-20260918`, private snapshot `api-report-backup-20260918T055345Z`.

## Bounded provider-compensation API repair â€” deployed

Source `a0454b2e243cce5be407bf8e900df1e066ffb61c` deployed at 2026-09-18T06:19:07.343197+00:00. Three compensation access/report/send routes now authorize only the verified signed-in account against its existing role/permission, all-office scope and unchanged existing email allowlist. A caller-supplied email cannot impersonate another user. Existing report calculations and send implementation are unchanged. No real export or email was executed.

70 local tests, 88 native Python/FastAPI tests and 17 retained backend suites PASS. Candidate and live rejection checks return 401 for missing/invalid identities and 403 for read-only jobs; the existing payroll validator remains 200. All 17,218 original guarded financial/report-audit rows, configuration, job files, service units and frontend bytes are unchanged. Live Payroll and Provider Compensation render without access errors; no captured Payroll console errors. Production/QA health PASS. Recovery: `backup/api-before-phase6-compensation-20260918`, snapshot `api-compensation-backup-20260918T061853Z`.

## Bounded OTP administrative restriction â€” deployed

Source `78cdc3c1994ac27dd3ac177abf1fd434984a8f06` deployed at 2026-09-18T06:35:08.187866+00:00. OTP configuration and management of another user's trusted devices now require the account to remain active and approved, in addition to its existing administrative role. The one-file change does not alter ordinary login, OTP challenges, cookies, credentials or settings. All route bodies are unchanged.

11 focused local and 99 native tests PASS. The other 20 materialized files match the compensation release; its 17 retained suites remain applicable to the unchanged main/service code. Candidate/live missing or invalid identities receive 401, jobs receive 403, and the existing payroll validator remains 200. All 20,790 guarded original rows are unchanged, including 186 trusted devices, one site-settings row and 3,385 authentication audit rows. No OTP, device revocation or setting change was performed. Production/QA health and refreshed Payroll UI PASS, no captured console errors. Backup: `api-otp-backup-20260918T063451Z`; tag: `backup/api-before-phase6-otp-admin-20260918`.

## Signed Plaid webhook boundary â€” deployed

Source `bad155018f53baaf129f0f8681481bea62b6b634` deployed at 2026-09-18T06:56:25.484273+00:00. The existing callback now verifies the provider signature, timestamp, exact request body and existing item mapping before dispatching its unchanged behavior. The unsigned request defect was reproduced with an intercepted subprocess. 124 native tests and all 17 retained backend suites PASS; valid positive dispatch was tested only with synthetic signatures and intercepted sync/email calls.

Candidate/live unsigned and malformed callbacks return 401; read-only jobs return 403. The existing payroll validator remains 200. Harmless live probes performed zero provider-key lookups, syncs or emails. All 20,835 rows in the fresh snapshot are preserved, including 15,970 expense rows, 535 Gusto facts, 663 expense facts, 93 export audits, 186 trusted devices, one settings row and 3,387 authentication audit rows. Plaid connection files, job configuration, service units and frontend bytes are unchanged. Production/QA health and live Executive Overview PASS, with no captured console errors. Snapshot `api-webhook-backup-20260918T065608Z`; tag `backup/api-before-phase6-webhook-20260918`.

The pre-release snapshot already contained 43 more expense rows and two more authentication audit rows than the previous OTP snapshot. Those additions preceded this webhook deployment; these checks do not attribute their cause. Release preservation claims apply to each fresh before/after snapshot, not a claim that ordinary production activity stopped throughout Phase 6. No financial correction is authorized or applied.

## Data, audit and performance limits

No financial records, classifications, archives, provider connections, frozen accounting proposals or goal values were modified. The common audit writer records actor-role context. Specialized inventory/supply history lacks immutable historical role fields; current profile roles are not historical proof.

Opening Morning Huddle during validation invoked its pre-existing get-or-create behavior: one draft dated September 18 was initialized at 04:18:07 UTC with 19 blank checklist children and four blank provider blocks. It was not submitted or deleted. Original rows were preserved. Later Huddle checks used history/review screens. Therefore this report does not claim zero incidental operational inserts across all browser navigation.

Production entry: `index-BnAyRbiv.js`, 8,833,241 bytes, SHA256 `3b395fa391d7b95f909644c528ef8b2290536fabef95a2edaaea7c929f09d715`. Previous entry: 8,836,680 bytes. The earlier reduction from approximately 21.7 MB remains preserved. No new percentage speedup is claimed. EOD's existing data-freshness warning remains; no provider sync was triggered.

## Recovery and remaining work

Frontend rollback: Pages `277f68be-3819-410c-8ca6-6aa5ffa2a95e`, annotated tag `backup/production-before-phase6-frontend-20260918`, fresh directory `frontend-backup-20260918T045834Z`. Group A and payroll API rollback points and all earlier branches/tags remain preserved. Two validator credentials expire December 16, 2026 at 22:55 UTC; renew privately under the approved scopes.

Continue the remaining API access review using actual downstream checks, current permissions/office scope and existing caller inventory. Preserve external integrations and schedules. Complete final read-only regression and then normally fast-forward verified intended production source into main. Do not force-push or reopen accounting. See [inventory](INVENTORY.md) and [checkpoint](../phase6-hardening/CHECKPOINT.md).

---

## Preserved historical application-release report (before Phase 6)

The following is the original completed application-promotion report. Its unchanged-QA/backend/policy statements describe that release's verification time, before the later Phase 6 changes above.

### Verified production release â€” September 17, 2026

Production application update is deployed and live regression passes. Residual accounting work is unchanged and is not part of this release.

| Item | Result |
|---|---|
| Previous production | `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601` |
| Core batch | `6965614a-f8e2-43d8-b8b7-206617796646`, source `23204be68b098980726cc17ba8a01f741be8c921` |
| Final operational batch | `277f68be-3819-410c-8ca6-6aa5ffa2a95e`, application source `bac8407c55ed684ffb2ec5dc3dd639cc0a736b4b` |
| Previous main | `61c224b1bf9ec53d91ab69a8eb00e563204bf76d` |
| Release branch | `release/nudashboard-production-20260917` |
| QA preserved | Branch `feature/nudental-dashboard-qa-phase5` at `2859ae6416e59918af4487e781e343f790ab770a`; deployment `7e91a103-ef44-4f3a-a667-447e112e6997` |
| Main update | Normal fast-forward after live verification; closure documentation changes no application bytes |

#### Verification

- 1,630 frontend tests PASS, zero failures/skips. Includes 128 retained Phase 4 suites and 90 Phase 5 suites; historical artifact supplied for preservation checks.
- Core and final production builds PASS. Six compiled request-isolation checks PASS for each artifact.
- 17 retained backend suites PASS; 13 materializer checks PASS.
- 49 offline database/permission suites PASS; 14 production-specific migration checks PASS, including idempotence, oversell rejection/transaction rollback and historical-field preservation.
- Financial/clinical production writes, approvals, provider sync, imports, emails and destructive actions intentionally excluded from live regression. Production authorization policies were not changed; live UI checks used the existing administrator session.

#### Live production regression â€” PASS

Executive Overview, office filters, Production, Collections, A/R, RCM, Insurance, Reports, Huddle, EOD, Tasks, implant inventory, inventory hub, Front Desk, Clinical Supply/fulfillment history, Users, Providers, Offices, Profile, Payroll, imported Gusto overview and Expense rendering were checked in the actual production browser.

Observed readbacks include four Production/A/R office rows, A/R filtered to Eatontown then restored, 50 RCM rows, two insurance requests, 480 fulfillment-history rows, 25 users on the current page, 214 provider rows, four offices, 14 payroll rows and 32 report rows. These are UI regression observations, not accounting certifications. No browser error messages were observed during the section checks.

The August 2026 / All Locations overview matches the baseline: gross production 595641, net production 280649, adjustments -314992, collections 264130, collection rate 94.1%, operating-expense display 277589, payroll display 92658, and office net-production figures ET 94198 / SI 9521 / Brick 72424 / Barnegat 104505. Values are unchanged application displays; residual accounting limitations remain in force.

#### Data, configuration and performance

44,868 original rows across 13 financial/operational tables retain identical fingerprints, with zero missing, changed or added rows in the post-release comparison. For the additive receipt migration, original columns are compared; the two new historical fields remain null. Backend source hashes are unchanged. All 11 frozen residual-accounting evidence files retain their original SHA-256 values.

Production/API and QA HTTP health PASS. Production serves `index-BBYhCGiP.js` with production Supabase/API inputs, no QA banner. QA retains its own database project, synthetic QA actor/banner, connected QA database, `product_api_ready=false`, disabled external execution, blocked Internet sockets, and hidden production/root homes. No QA environment was copied into production.

Entry asset: 21,742,079 bytes before; 8,836,680 bytes after. The Executive Overview now has one DOM page mount instead of two. Navigation and data rendering completed across the tested sections without errors. No percentage speedup or native browser timing claim is made. Full network-request profiling was not available through the browser inspection interface; duplicate page mounting was directly checked and its retained regression test passed.

#### Recovery and deferrals

- Annotated tags `backup/main-before-production-update-20260917` and `backup/production-before-operations-20260917` preserve the old main and the verified core release.
- Server evidence: `/home/openclaw/.cache/nudashboard-production-release-20260917` contains both previous artifacts, source/schema backups, original-row fingerprints, manifests, individual migration receipts and bounded publishing/rollback scripts. The original stock-trigger definition is separately recoverable. Retain additive receipt columns when rolling back the frontend to preserve any future data.
- Only production migrations 001/002 in this directory were applied. The other QA migrations and storage/security work are individually deferred/excluded as documented in `INVENTORY.md` and `README.md`. This release does not claim the deferred QA-only atomic RPCs, Front Desk review restriction or broader RLS findings have been promoted.
- Frozen accounting items, financial metadata approvals, benefit/reimbursement/duplicate proposals, tax support and bank/AmEx export limitations remain follow-up only. No financial correction is authorized or performed.

Production is ready for daily use within its existing supported workflows and the documented deferred limitations. Phase 4/5 branches and earlier tags remain recoverable; no force push is used.
