# NuDental Dashboard — full release report

Updated 2026-09-18T06:45:21.934486+00:00 from saved deployment and live verification evidence.

**Phase 6 IN PROGRESS: Groups A–E and the approved frontend are live. Remaining API route review, final regression and canonical-main integration remain open.** Dr. G explicitly approved B–E and the client activation; no migration approval is pending.

## Current production

| Item | State |
|---|---|
| URL | https://nudashboard.com |
| Frontend deployment | `a81545bf-4463-4dc3-9b33-3cad855888d7` |
| Frontend source | `145adebb5e9367d3854fe96edd913464fd33053e` |
| Previous deployment | `277f68be-3819-410c-8ca6-6aa5ffa2a95e` |
| Canonical main | `820970ede7727830d95d8d03d518d02119da1acd` — final Phase 6 integration pending |
| Branch | `phase6/nudashboard-production-hardening-20260917` |
| API source | `78cdc3c1994ac27dd3ac177abf1fd434984a8f06`; payroll/report/compensation identity and OTP administrative restrictions live |
| API main SHA256 | `cfd39140f772dd59a1fec46d4b22c1971cf1f6394ba0e600af275bed6df7d711` |
| QA deployment | `c3c958d8-fede-4be7-85e6-c7a61b635af9` — unchanged |

## Applied migration groups

| Group | Production result | Guarded rows | Recovery directory |
|---|---|---:|---|
| A | DEPLOYED / native permission and UI checks PASS | 4,425 | `production-a-20260917T215054Z` |
| B | DEPLOYED / native permission and UI checks PASS | 18,929 | `production-b-20260918T043032Z` |
| C | DEPLOYED / native permission and UI checks PASS | 4,428 | `production-c-20260918T043735Z` |
| D | DEPLOYED / native permission and UI checks PASS | 5,701 | `production-d-20260918T044339Z` |
| E | DEPLOYED / native permission and UI checks PASS | 5,072 | `production-e-20260918T045042Z` |

Each apply preserved all guarded original rows, owners and grants. These table scopes overlap and must not be summed. B–E each used current counts for 13 active accounts and checked the expected role visibility inside the locked apply transaction. Native health, exact candidate catalog, role visibility and representative live UI checks passed. Fresh backups and rollback SQL remain local and on the existing server.

Group B's first apply was safely rolled back after an old absolute-count reference failed. Investigation showed ordinary intervening records, not a policy expansion. The unchanged approved migration was then reapplied with a fresh per-deployment role reference. The failed attempt and exact rollback remain in `production-b-20260918T041614Z`. Group C rollback preserves deletion history; historical audit rows must never be deleted to restore the old foreign key.

## Frontend, tests and live checks

The production build now activates atomic office assignment, atomic supply drafts/receipts, and the Regional Manager/Admin/Super Admin Front Desk review route with no self-approval. QA keys, identities, synthetic records, adapters, banners and storage configuration were excluded.

- Fresh 1,648 frontend tests PASS, zero failures/skips; production build PASS; six compiled request-isolation checks PASS. Production source matches the copied build inputs.
- Hosted QA native contracts remain A 12 / B 11 / C 10 / D 15 / E 10, all PASS against the exact deployed SQL. Write, denied-write, retry, audit and bypass cases used rolled-back synthetic QA fixtures.
- Retained payroll release evidence: 52 local tests, 58 native runtime/FastAPI tests, 17 backend suites and 13 materializer checks PASS. No accounting calculation change.
- Production Huddle history/review, EOD, implant/bone inventory, Front Desk history/catalog, clinical supply overview, Insurance and Service Goals PASS. No approvals, clinical stock changes, insurance submissions or financial actions were executed.
- New live Front Desk Approvals route PASS on the new asset: three visible Front Desk requests, two pending; no self-approval guidance present; no action submitted. No captured console errors.
- Dated Payroll Comparison now renders August 2–15, 2026 with 13 rows; date-required guard absent. Keyboard events succeeded without using the native picker. The exact native route response independently returned the same selected dates and 13 rows using read-only SQLite and two Supabase GETs. No matching HTTP access-log record was available; employee-level amounts were not exported.
- Production and QA frontend/API health PASS. Production and QA live asset hashes match their own manifests; QA retains `product_api_ready=false`.

## Bounded report-export API repair — deployed

Source `fa1730c752c4f26956c4d79b21e025e035a69f55` deployed at 2026-09-18 05:53:57 UTC. Export permission and audit attribution now use the verified signed-in identity rather than body-supplied role/email/ID. All currently authorized exporters retain their existing grants. Internal reads forward only that identity to the fixed local API, without redirects. Jobs cannot export.

64 local tests, 75 native Python/FastAPI tests and all 17 retained backend suites PASS. All 28 report calculation/rendering/audit-writer functions are unchanged. Live missing/invalid sessions return 401; read-only job returns 403; existing payroll validator remains 200. No real export was executed. Authorized report generation was tested with the actual handler, synthetic data and an in-memory audit.

Fresh guards preserved 15,927 expense rows, 535 Gusto expense-fact rows, 663 expense-fact rows and all 93 export-audit rows. Configuration, existing job files and service units are unchanged. Production Reports still renders all eight sections/four export controls with no captured console errors. Production and QA health PASS. Recovery: `backup/api-before-phase6-reports-20260918`, private snapshot `api-report-backup-20260918T055345Z`.

## Bounded provider-compensation API repair — deployed

Source `a0454b2e243cce5be407bf8e900df1e066ffb61c` deployed at 2026-09-18T06:19:07.343197+00:00. Three compensation access/report/send routes now authorize only the verified signed-in account against its existing role/permission, all-office scope and unchanged existing email allowlist. A caller-supplied email cannot impersonate another user. Existing report calculations and send implementation are unchanged. No real export or email was executed.

70 local tests, 88 native Python/FastAPI tests and 17 retained backend suites PASS. Candidate and live rejection checks return 401 for missing/invalid identities and 403 for read-only jobs; the existing payroll validator remains 200. All 17,218 original guarded financial/report-audit rows, configuration, job files, service units and frontend bytes are unchanged. Live Payroll and Provider Compensation render without access errors; no captured Payroll console errors. Production/QA health PASS. Recovery: `backup/api-before-phase6-compensation-20260918`, snapshot `api-compensation-backup-20260918T061853Z`.

## Bounded OTP administrative restriction — deployed

Source `78cdc3c1994ac27dd3ac177abf1fd434984a8f06` deployed at 2026-09-18T06:35:08.187866+00:00. OTP configuration and management of another user's trusted devices now require the account to remain active and approved, in addition to its existing administrative role. The one-file change does not alter ordinary login, OTP challenges, cookies, credentials or settings. All route bodies are unchanged.

11 focused local and 99 native tests PASS. The other 20 materialized files match the compensation release; its 17 retained suites remain applicable to the unchanged main/service code. Candidate/live missing or invalid identities receive 401, jobs receive 403, and the existing payroll validator remains 200. All 20,790 guarded original rows are unchanged, including 186 trusted devices, one site-settings row and 3,385 authentication audit rows. No OTP, device revocation or setting change was performed. Production/QA health and refreshed Payroll UI PASS, no captured console errors. Backup: `api-otp-backup-20260918T063451Z`; tag: `backup/api-before-phase6-otp-admin-20260918`.

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

### Verified production release — September 17, 2026

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

#### Live production regression — PASS

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
