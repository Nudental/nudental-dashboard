# NuDental Dashboard release inventory â€” current status

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

## Provider access and OAuth callbacks - deployed

Source `78cc78da4affc54f4308a4731551a46f30854e17` applied at 2026-09-18T14:36:16.903788+00:00; API main SHA256 `7b85a17d6a9bac738bb4239b83326199c99957b499d14335e7d6934a95607917`. All 22 previously remaining provider declarations are reviewed: 20 existing control/read declarations require current human identity, and two public redirect callbacks require a valid short-lived, one-use administrator-created intent. A minimal authenticated Gusto authorization-URL route provides the missing intent initiation, making 21 control/read declarations. Catalog/status use the existing Front Desk grant; global provider controls require the active approved Super Admin. Existing request/review permissions remain unchanged.

Gusto no longer exchanges a missing-state callback or overwrites its token file after a failed exchange. Amazon no longer accepts callback state when no intent was saved. Intent hashes are held separately from provider credentials and process locking prevents replay. Existing credentials, scopes, redirect destinations and refresh logic are preserved. Positive provider tests used synthetic transports only; no real authorization, sync, delivery or purchase was executed.

Separate `plaid-sync`, `morning-brief` and `payroll-balance-watch` identities retain only their existing exact GETs. Fixed loopback origins and redirect rejection prevent credential forwarding. Their schedule and business-processing AST remain unchanged. Four prior identities and their credentials/expiry are preserved. All seven identities retain the existing December 16 renewal deadline; never restore the revoked reconciliation-validator token.

**Verification:** 324 guarded native tests, 17 retained backend suites, 13 materializer tests and two exact external-caller checks PASS. Live missing/invalid identity checks return 401; unrelated jobs and writes return 403; both callbacks reject missing intent before a provider call. Same-period Summary/RCM results remain unchanged. All 79,171 guarded original Supabase rows and 83,991 original SQLite rows are preserved. Schemas, provider configuration, scheduled jobs and financial source records are unchanged.

Final read-only parity at 2026-09-18T14:52:28.766982+00:00: all 36 materialized files and both external caller adapters match. Production/QA/API HTTP health PASS; QA retains `product_api_ready=false`. Frontend artifacts remain production `index-DRITFcr0.js` (8,835,047 bytes) and QA `index-BXvFvJGj.js` (8,833,878 bytes). No new speedup claim is made.

Recovery: `backup/api-before-phase6-provider-reads-20260918`, `api-provider-read-backup-20260918T143542Z`. Full source/config/caller recovery copies stay private on the server. Existing frontend rollback deployments and all earlier tags remain.

**Remaining:** Two report-dependent human gates await the Collaboration restart/scheduler decision. Independent regression and source closure are complete; Phase 6 remains incomplete pending that activation decision. No Collaboration source, credential, process or scheduler was changed. Accounting follow-up remains frozen.

Updated 2026-09-18T10:21:05.247164+00:00 from saved evidence. Phase 6 is IN PROGRESS; Groups Aâ€“E and the approved frontend are deployed and verified.

The original comparison remains main `61c224b1bf9ec53d91ab69a8eb00e563204bf76d` versus QA `2859ae6416e59918af4487e781e343f790ab770a`: 487 classified paths, including 79 promoted frontend paths and 42 database candidates. Those original classifications are preserved in `release-inventory.json`. Its `phase6_release` and per-repair `phase6_review` fields hold current status; a reviewed candidate is not an applied migration.

Classes: A application repair; B performance/UX; C deliberate database/security migration; D QA-only or test infrastructure; E frozen financial/accounting correction. Phase 6 priorities P1/P2/P3/P4 are a separate classification. Group letters Aâ€“E are deployment groups, not release classes.

## Phase 6 release layer

| Change / group | Release class | Current disposition |
|---|---|---|
| Group A â€” profiles, user-office RPC, tasks, notifications | C â€” deliberate database/security adaptation | DEPLOYED and verified. Seven functions, two policies, five triggers; 4,425 rows unchanged. Office-assignment client is active in the new production frontend. |
| Payroll identity and two validator identities | A â€” application/security repair | DEPLOYED. Eight GET routes require verified identity/permissions; two distinct expiring read-only job scopes. Existing calculations, schedules and provider settings unchanged. |
| Verified report-export identity and audit attribution | A â€” application/security repair | DEPLOYED and live-verified; existing calculations, grants, configurations and export audit preserved. 75 native tests + 17 retained suites PASS. |
| Verified provider-compensation identity | A â€” application/security repair | DEPLOYED; existing allowlist/calculations preserved, no emails or real exports. 88 native tests + 17 retained suites PASS. |
| Current active/approved OTP administrator | A â€” application/security repair | DEPLOYED; login, devices and settings unchanged. 99 native tests PASS, all 20,790 guarded rows preserved. |
| Signed Plaid webhook and item boundary | A â€” application/security repair | DEPLOYED; 124 native tests + 17 retained suites PASS. No provider/connection/configuration changes or real sync/email. |
| Administrative diagnostic/maintenance identity | A â€” application/security repair | DEPLOYED; 10 routes, 136 native tests, 17 retained suites, 13 materializer checks and live Sync Dashboard PASS. No maintenance actions executed. |
| RCM contact actor and office boundary | A â€” application/security repair | DEPLOYED; four routes, 149 native tests, 17 retained suites, QA identity and live Patient AR Follow-Up PASS. No real contact writes. |
| Huddle/EOD API read/record office boundary | A â€” application/security repair | DEPLOYED; six reads, 164 native tests, 17 retained suites, live KPIs PASS. No real workflow action. |
| Legacy Amazon request identity/office boundary | A â€” application/security repair | DEPLOYED; five routes, 177 native tests, 17 retained suites. Front Desk history shows 129 records, no real order action. |
| Directory/patient/appointment read boundary | A â€” application/security repair | DEPLOYED; eight routes, 194 native tests, 17 retained suites; patient fallback office leak repaired; KPI rendering PASS. |
| Legacy goal/EOD maintenance gate | A â€” application/security repair | DEPLOYED; two writes, 207 native tests, 17 retained suites; no real action executed. |
| Group B â€” Huddle/EOD | C | DEPLOYED; native role/row guards and representative UI checks PASS. |
| Group C â€” implant/bone history and access | C | DEPLOYED; native role/row guards and representative UI checks PASS. Preserve deletion history during any rollback. |
| Group D â€” supplies, Front Desk, urgent requests | C | DEPLOYED; native role/row guards and representative UI checks PASS. RM/Admin/Super Admin only for review; no self-approval. |
| Group E â€” insurance and service-goal access | C | DEPLOYED; native role/row guards and representative UI checks PASS. |
| Independent financial/RCM readers | A — application/security repair | DEPLOYED; 23 routes, 304 native tests, 17 retained suites, live RCM Dashboard PASS. Two report gates pending integration activation. |
| RCM snapshot/eAssist human and office boundary | A — application/security repair | DEPLOYED; six routes, 283 native tests, 17 retained suites, four affected-table guards and live eAssist PASS. |
| RCM A/R and eAssist request scope | A — application repair | DEPLOYED production/QA; 1,678 frontend tests, compiled checks, selected-office UI and unchanged metrics PASS. |
| Legacy status reader authority | A — application/security repair | DEPLOYED; three administrative read gates, 271 native tests, unchanged handlers/jobs/configuration; live denials and health PASS. |
| Expense identity and literal query filters | A — application/security repair | DEPLOYED; seven reads, 267 native tests, 17 retained suites, 13 materializer checks; Expense live PASS, calculations unchanged. |
| Metric/helper identity and exact selector scope | A — application/security repair | DEPLOYED; eight reads, 253 native tests, 17 retained suites, 13 materializer checks; KPI and Finance live PASS. |
| Core aggregate read identity/office scope | A — application/security repair | DEPLOYED; 16 reads, 237 native tests, 17 retained suites and five live page checks PASS. |
| Existing validator core-read compatibility | A — application/security repair | DEPLOYED; 220 native tests, exact GET scopes, three live unchanged read results. Exposed reconciliation credential revoked and equivalently rotated. |
| Expense denominator selected-office reads | A — application repair | DEPLOYED in production and QA; 1,660 frontend tests and compiled checks PASS; six live metrics unchanged. |
| RCM status selected-office propagation | A — application repair | DEPLOYED in production and QA; 1,654 frontend tests, six compiled isolation and six compiled RCM cases PASS. |
| Phase 6 client changes | A | DEPLOYED to production after Aâ€“E verification; atomic office/draft/receipt clients and restricted review route active. |
| QA environment, synthetic offices/actors, simulations and QA storage/security | D | Excluded from production. QA remains isolated. |
| Frozen accounting corrections and metadata proposals | E | Excluded and unchanged. No reconciliation searches, corrections, imports or reclassification authorized here. |

Production frontend is `dcf8bc42-1a06-45f6-8010-80c1db7595be`, source `009005b03767dc3dc9facdbfc5f9fa81fa001d49`. API source is now `ab7d6a1fa1f9be5ba1e62ec20b944be84cc12d85`; broader API review is open. The previous main was `820970ede7727830d95d8d03d518d02119da1acd` pending final integration. QA is `ae279546-abd2-4720-a052-a9a34aa2d60b`; its isolation is preserved.

## Preserved application batches â€” earlier production promotion

The following rows describe the already-promoted Phase 4/5 application delta. They do not mark subsequent edits to the same files as deployed. Phase 6 changes to emailService, supplyRequestService, FrontDeskInventoryTab, Routes, navConfig and the new Front Desk review page are now live in the approved Phase 6 frontend.

### Original 79 frontend paths

| Path | Class | Batch |
|---|---|---|
| src/components/QaEnvironmentBanner.jsx | A | 1-core (deployed) |
| src/components/layout/Header.jsx | A | 1-core (deployed) |
| src/components/layout/MainLayout.jsx | B | 1-core (deployed) |
| src/components/payroll/comparison/ComparisonRoot.jsx | A | 1-core (deployed) |
| src/config/dashboardEnvironment.js | A | 1-core (deployed) |
| src/config/environmentPolicy.js | A | 1-core (deployed) |
| src/config/qaHeaders.js | A | 1-core (deployed) |
| src/contexts/AuthContext.jsx | A | 1-core (deployed) |
| src/hooks/gusto/useGustoComparison.js | A | 1-core (deployed) |
| src/hooks/gusto/useGustoContractors.js | A | 1-core (deployed) |
| src/hooks/gusto/useGustoEmployees.js | A | 1-core (deployed) |
| src/hooks/gusto/useGustoPayrollRuns.js | A | 1-core (deployed) |
| src/hooks/gusto/useGustoSummaryTotals.js | A | 1-core (deployed) |
| src/index.jsx | A | 1-core (deployed) |
| src/lib/dashboardFetch.js | A | 1-core (deployed) |
| src/lib/gusto/gustoImportHelpers.js | A | 1-core (deployed) |
| src/lib/supabase.js | A | 1-core (deployed) |
| src/pages/alert-center/index.jsx | A | 2-operations (deployed) |
| src/pages/bone-and-tissue-inventory/components/EntryModal.jsx | A | 2-operations (deployed) |
| src/pages/bone-and-tissue-inventory/components/InventoryTable.jsx | A | 2-operations (deployed) |
| src/pages/bone-and-tissue-inventory/components/MobileEntryModal.jsx | A | 2-operations (deployed) |
| src/pages/daily-entry-form/components/DailyBulkImportTab.jsx | A | 2-operations (deployed) |
| src/pages/daily-entry-form/components/ReconciliationPanel.jsx | A | 2-operations (deployed) |
| src/pages/daily-entry-form/components/TreatmentPlanCompletionTab.jsx | A | 2-operations (deployed) |
| src/pages/daily-entry-form/components/UnscheduledTreatmentTab.jsx | A | 2-operations (deployed) |
| src/pages/daily-entry-form/index.jsx | A | 2-operations (deployed) |
| src/pages/daily-morning-huddle/components/ChecklistSection.jsx | A | 2-operations (deployed) |
| src/pages/executive-overview/components/RevenueSummarySection.jsx | A | 1-core (deployed) |
| src/pages/financial-analytics/ExpenseReport.jsx | A | 1-core (deployed) |
| src/pages/huddle-approvals/index.jsx | A | 2-operations (deployed) |
| src/pages/implant-inventory-management/components/AddImplantModal.jsx | A | 2-operations (deployed) |
| src/pages/implant-inventory-management/components/ImplantBulkImportWizard.jsx | A | 2-operations (deployed) |
| src/pages/implant-inventory-management/components/ImplantReportsTab.jsx | A | 2-operations (deployed) |
| src/pages/implant-inventory-management/components/ImplantUsageLogTab.jsx | A | 2-operations (deployed) |
| src/pages/insurance-verify/components/NewVerificationRequestForm.jsx | A | 2-operations (deployed) |
| src/pages/inventory-dashboard/components/FrontDeskAmazonOrderHistory.jsx | A | 2-operations (deployed) |
| src/pages/inventory-dashboard/components/FrontDeskCurrentInventory.jsx | A | 2-operations (deployed) |
| src/pages/inventory-dashboard/components/FrontDeskInventoryTab.jsx | A | 2-operations (deployed) |
| src/pages/inventory-dashboard/components/supply/FulfillmentImportTab.jsx | A | 2-operations (deployed) |
| src/pages/inventory-dashboard/components/supply/FulfillmentLogTab.jsx | A | 2-operations (deployed) |
| src/pages/inventory-dashboard/components/supply/MobileCatalogView.jsx | A | 2-operations (deployed) |
| src/pages/inventory-dashboard/components/supply/MobileReceiveSuppliesModal.jsx | A | 2-operations (deployed) |
| src/pages/inventory-dashboard/components/supply/SupplyCatalogTab.jsx | A | 2-operations (deployed) |
| src/pages/inventory-dashboard/components/supply/UrgentRequestTab.jsx | A | 2-operations (deployed) |
| src/pages/management/CostDriversManagement.jsx | A | 2-operations (deployed) |
| src/pages/management/ServiceCategoriesManagement.jsx | A | 2-operations (deployed) |
| src/pages/payroll/components/ProviderCompensationNew.jsx | A | 1-core (deployed) |
| src/pages/pending-approvals/index.jsx | A | 2-operations (deployed) |
| src/pages/rcm/components/VerifiedArTrendChart.jsx | A | 1-core (deployed) |
| src/pages/sync-dashboard/index.jsx | A | 1-core (deployed) |
| src/pages/team-assignments/index.jsx | A | 2-operations (deployed) |
| src/pages/users-management/components/BulkActionsBar.jsx | A | 2-operations (deployed) |
| src/pages/users-management/components/EditUserModal.jsx | A | 2-operations (deployed) |
| src/pages/users-management/components/InviteUserModal.jsx | A | 2-operations (deployed) |
| src/pages/users-management/components/UserFilters.jsx | A | 2-operations (deployed) |
| src/services/actionItemsService.js | A | 2-operations (deployed) |
| src/services/ascendApi.js | A | 1-core (deployed) |
| src/services/boneTissueService.js | A | 2-operations (deployed) |
| src/services/bulkImportService.js | A | 2-operations (deployed) |
| src/services/dailyEntryBulkImportService.js | A | 2-operations (deployed) |
| src/services/emailService.js | A | 1-core (deployed) |
| src/services/eodReportService.js | A | 1-core (deployed) |
| src/services/eodTreatmentService.js | A | 1-core (deployed) |
| src/services/expenseReportService.js | A | 1-core (deployed) |
| src/services/frontDeskInventoryService.js | A | 2-operations (deployed) |
| src/services/fulfillmentImportService.js | A | 2-operations (deployed) |
| src/services/huddleService.js | A | 2-operations (deployed) |
| src/services/implantInventoryService.js | C | 2-operations (dependencies applied) |
| src/services/insuranceVerifyService.js | A | 2-operations (deployed) |
| src/services/kpiService.js | A | 1-core (deployed) |
| src/services/managementService.js | A | 2-operations (deployed) |
| src/services/notificationsService.js | A | 1-core (deployed) |
| src/services/operationsService.js | A | 1-core (deployed) |
| src/services/otpAuthService.js | A | 1-core (deployed) |
| src/services/rcmService.js | A | 1-core (deployed) |
| src/services/reportExportService.js | A | 1-core (deployed) |
| src/services/serviceCategoryGoalsService.js | A | 2-operations (deployed) |
| src/services/supplyRequestService.js | C | 2-operations (dependencies applied) |
| vite.config.mjs | A | 1-core (deployed) |

## Individual database review â€” all 42 original entries

Only the two baseline adaptations (016/030) and adapted Phase 6 Group A are currently applied. Never apply original QA SQL packages wholesale.

| QA repair | Original class | Phase 6 priority | Group | Current disposition |
|---|---|---|---|---|
| 001-profile-access-boundary.sql | C | P1 | A | DEPLOYED_VERIFIED: Adapted production Group A applied; row fingerprints and existing owners/grants preserved; native permission and representative UI checks pass. |
| 002-office-workflow-boundary.sql | C | P1 | A / B | PARTIAL_A_LIVE_B_PENDING: Task foundation is live in A; Huddle/checklist portion in B passed QA but awaits approval and deployment. |
| 003-eod-audit-coverage.sql | C | P1 | B | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group B passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 004-eod-insert-boundary.sql | C | P1 | B | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group B passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 005-eod-workflow-integrity.sql | C | P1 | B | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group B passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 006-eod-history-identity.sql | C | P1 | B | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group B passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 007-huddle-child-audit-coverage.sql | C | P1 | B | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group B passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 008-task-page-permission.sql | C | P1 | A | DEPLOYED_VERIFIED: Adapted production Group A applied; row fingerprints and existing owners/grants preserved; native permission and representative UI checks pass. |
| 009-task-field-permission.sql | C | P1 | A | DEPLOYED_VERIFIED: Adapted production Group A applied; row fingerprints and existing owners/grants preserved; native permission and representative UI checks pass. |
| 010-notification-audit-coverage.sql | C | P1 | A | DEPLOYED_VERIFIED: Adapted production Group A applied; row fingerprints and existing owners/grants preserved; native permission and representative UI checks pass. |
| 011-huddle-review-permission.sql | C | P1 | B | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group B passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 012-implant-office-boundary.sql | C | P1 | C | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group C passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 013-task-identity-boundary.sql | C | P1 | A | DEPLOYED_VERIFIED: Adapted production Group A applied; row fingerprints and existing owners/grants preserved; native permission and representative UI checks pass. |
| 014-task-row-audit.sql | C | P1 | A | DEPLOYED_VERIFIED: Adapted production Group A applied; row fingerprints and existing owners/grants preserved; native permission and representative UI checks pass. |
| 015-implant-lookup-audit.sql | C | P2 | C | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group C passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 016-implant-stock-transaction.sql | C | Already live | â€” | BASELINE_ALREADY_LIVE: Preserve the September 17 production adaptation; no reapply or historical backfill. |
| 017-implant-delete-audit.sql | C | P2 | C | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group C passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 018-user-office-assignment-transaction.sql | C | P1 | A | DATABASE_LIVE_CLIENT_PENDING: Atomic office-assignment RPC is live in A. Client activation is still in the frontend candidate dependent on A and D. |
| 019-office-goal-read-boundary.sql | C | P1 | E | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group E passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 020-insurance-access-boundary.sql | C | P1 | E | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group E passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 021-bone-inventory-access-boundary.sql | C | P1 | C | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group C passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 022-bone-role-active-profile.sql | C | P1 | C | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group C passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 023-bone-delete-audit-history.sql | C | P2 | C | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group C passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 024-supply-synthetic-offices.sql | D | P4 | â€” | QA_ONLY_EXCLUDED: Synthetic offices or execution simulation; never promote. |
| 025-supply-request-access-boundary.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 026-supply-draft-transaction.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 027-supply-submission-simulation.sql | D | P4 | â€” | QA_ONLY_EXCLUDED: Synthetic offices or execution simulation; never promote. |
| 028-supply-fulfillment-access-boundary.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 029-supply-fulfillment-audit.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 030-supply-receipt-columns.sql | C | Already live | â€” | BASELINE_ALREADY_LIVE: Preserve the September 17 production adaptation; no reapply or historical backfill. |
| 031-front-desk-synthetic-offices.sql | D | P4 | â€” | QA_ONLY_EXCLUDED: Synthetic offices or execution simulation; never promote. |
| 032-front-desk-catalog-access.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 033-front-desk-catalog-audit.sql | C | P2 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 034-front-desk-order-access.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 035-clinical-stock-access.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 036-clinical-stock-create-history.sql | C | P2 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 037-supply-receipt-transaction.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 038-urgent-request-audit-simulation.sql | D | P4 as packaged | D | QA_PACKAGE_EXCLUDED_AUDIT_EXTRACTION_PENDING: Original simulation package stays excluded. Only independent audit coverage is adapted into D; D is not deployed. |
| 039-urgent-request-access-boundary.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 040-front-desk-review-boundary.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 041-insurance-completed-form-lock.sql | C | P1 | E | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group E passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 042-service-goal-read-boundary.sql | C | P1 | E | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group E passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |

For A, native permission/row guards and representative production UI checks PASS. For Bâ€“E, QA and rollback-only production preflight PASS; fresh snapshots, explicit approval, actual production apply and live checks remain pending. For 018 the database function is live but its atomic client is not; for 002 only the A task portion is live. For 038 the QA simulation package remains excluded even though its independent audit portion is adapted into pending D.

Storage: production policies/photo permissions remain unchanged. QA-only storage work is not promoted. Existing production-safe UI handling remains part of the earlier release. Accounting class E and PH5-EXP-001 remain exactly as previously preserved; no financial correction is applied.

See [full report](CLOSURE.md), [active checkpoint](../phase6-hardening/CHECKPOINT.md), [role matrix](../phase6-hardening/README.md), and [API scope/limits](../phase6-hardening/API-ACCESS.md). The JSON retains all original file and database fields; added review fields do not rewrite the original evidence.
