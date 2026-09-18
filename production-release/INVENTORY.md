# NuDental Dashboard release inventory — current status

Updated 2026-09-18T08:12:23.050814+00:00 from saved evidence. Phase 6 is IN PROGRESS; Groups A–E and the approved frontend are deployed and verified.

The original comparison remains main `61c224b1bf9ec53d91ab69a8eb00e563204bf76d` versus QA `2859ae6416e59918af4487e781e343f790ab770a`: 487 classified paths, including 79 promoted frontend paths and 42 database candidates. Those original classifications are preserved in `release-inventory.json`. Its `phase6_release` and per-repair `phase6_review` fields hold current status; a reviewed candidate is not an applied migration.

Classes: A application repair; B performance/UX; C deliberate database/security migration; D QA-only or test infrastructure; E frozen financial/accounting correction. Phase 6 priorities P1/P2/P3/P4 are a separate classification. Group letters A–E are deployment groups, not release classes.

## Phase 6 release layer

| Change / group | Release class | Current disposition |
|---|---|---|
| Group A — profiles, user-office RPC, tasks, notifications | C — deliberate database/security adaptation | DEPLOYED and verified. Seven functions, two policies, five triggers; 4,425 rows unchanged. Office-assignment client is active in the new production frontend. |
| Payroll identity and two validator identities | A — application/security repair | DEPLOYED. Eight GET routes require verified identity/permissions; two distinct expiring read-only job scopes. Existing calculations, schedules and provider settings unchanged. |
| Verified report-export identity and audit attribution | A — application/security repair | DEPLOYED and live-verified; existing calculations, grants, configurations and export audit preserved. 75 native tests + 17 retained suites PASS. |
| Verified provider-compensation identity | A — application/security repair | DEPLOYED; existing allowlist/calculations preserved, no emails or real exports. 88 native tests + 17 retained suites PASS. |
| Current active/approved OTP administrator | A — application/security repair | DEPLOYED; login, devices and settings unchanged. 99 native tests PASS, all 20,790 guarded rows preserved. |
| Signed Plaid webhook and item boundary | A — application/security repair | DEPLOYED; 124 native tests + 17 retained suites PASS. No provider/connection/configuration changes or real sync/email. |
| Administrative diagnostic/maintenance identity | A — application/security repair | DEPLOYED; 10 routes, 136 native tests, 17 retained suites, 13 materializer checks and live Sync Dashboard PASS. No maintenance actions executed. |
| RCM contact actor and office boundary | A — application/security repair | DEPLOYED; four routes, 149 native tests, 17 retained suites, QA identity and live Patient AR Follow-Up PASS. No real contact writes. |
| Huddle/EOD API read/record office boundary | A — application/security repair | DEPLOYED; six reads, 164 native tests, 17 retained suites, live KPIs PASS. No real workflow action. |
| Group B — Huddle/EOD | C | DEPLOYED; native role/row guards and representative UI checks PASS. |
| Group C — implant/bone history and access | C | DEPLOYED; native role/row guards and representative UI checks PASS. Preserve deletion history during any rollback. |
| Group D — supplies, Front Desk, urgent requests | C | DEPLOYED; native role/row guards and representative UI checks PASS. RM/Admin/Super Admin only for review; no self-approval. |
| Group E — insurance and service-goal access | C | DEPLOYED; native role/row guards and representative UI checks PASS. |
| Phase 6 client changes | A | DEPLOYED to production after A–E verification; atomic office/draft/receipt clients and restricted review route active. |
| QA environment, synthetic offices/actors, simulations and QA storage/security | D | Excluded from production. QA remains isolated. |
| Frozen accounting corrections and metadata proposals | E | Excluded and unchanged. No reconciliation searches, corrections, imports or reclassification authorized here. |

Production frontend is `a81545bf-4463-4dc3-9b33-3cad855888d7`, source `145adebb5e9367d3854fe96edd913464fd33053e`. API source is now `1456c8684f955bb359b21a4d9b56e33b6611a858`; broader API review is open. Main remains `820970ede7727830d95d8d03d518d02119da1acd` pending final integration. QA remains `c3c958d8-fede-4be7-85e6-c7a61b635af9`.

## Preserved application batches — earlier production promotion

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

## Individual database review — all 42 original entries

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
| 016-implant-stock-transaction.sql | C | Already live | — | BASELINE_ALREADY_LIVE: Preserve the September 17 production adaptation; no reapply or historical backfill. |
| 017-implant-delete-audit.sql | C | P2 | C | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group C passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 018-user-office-assignment-transaction.sql | C | P1 | A | DATABASE_LIVE_CLIENT_PENDING: Atomic office-assignment RPC is live in A. Client activation is still in the frontend candidate dependent on A and D. |
| 019-office-goal-read-boundary.sql | C | P1 | E | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group E passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 020-insurance-access-boundary.sql | C | P1 | E | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group E passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 021-bone-inventory-access-boundary.sql | C | P1 | C | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group C passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 022-bone-role-active-profile.sql | C | P1 | C | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group C passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 023-bone-delete-audit-history.sql | C | P2 | C | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group C passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 024-supply-synthetic-offices.sql | D | P4 | — | QA_ONLY_EXCLUDED: Synthetic offices or execution simulation; never promote. |
| 025-supply-request-access-boundary.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 026-supply-draft-transaction.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 027-supply-submission-simulation.sql | D | P4 | — | QA_ONLY_EXCLUDED: Synthetic offices or execution simulation; never promote. |
| 028-supply-fulfillment-access-boundary.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 029-supply-fulfillment-audit.sql | C | P1 | D | QA_PASS_APPROVAL_PENDING_NOT_DEPLOYED: Adapted Group D passed isolated QA and native rollback-only preflight. Fresh backup, approval, actual apply and live verification remain required. |
| 030-supply-receipt-columns.sql | C | Already live | — | BASELINE_ALREADY_LIVE: Preserve the September 17 production adaptation; no reapply or historical backfill. |
| 031-front-desk-synthetic-offices.sql | D | P4 | — | QA_ONLY_EXCLUDED: Synthetic offices or execution simulation; never promote. |
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

For A, native permission/row guards and representative production UI checks PASS. For B–E, QA and rollback-only production preflight PASS; fresh snapshots, explicit approval, actual production apply and live checks remain pending. For 018 the database function is live but its atomic client is not; for 002 only the A task portion is live. For 038 the QA simulation package remains excluded even though its independent audit portion is adapted into pending D.

Storage: production policies/photo permissions remain unchanged. QA-only storage work is not promoted. Existing production-safe UI handling remains part of the earlier release. Accounting class E and PH5-EXP-001 remain exactly as previously preserved; no financial correction is applied.

See [full report](CLOSURE.md), [active checkpoint](../phase6-hardening/CHECKPOINT.md), [role matrix](../phase6-hardening/README.md), and [API scope/limits](../phase6-hardening/API-ACCESS.md). The JSON retains all original file and database fields; added review fields do not rewrite the original evidence.
