# Dashboard production release inventory

All 487 changed paths are classified in release-inventory.json. A/B application changes are selected independently of QA infrastructure. C migrations were individually reviewed; only the two bounded adaptations listed below were applied. D files are excluded from production runtime. E accounting proposals are frozen and excluded.

## Application batches

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

## Individual database review

| QA repair | Class | Production purpose | Disposition |
|---|---|---|---|
| 001-profile-access-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 002-office-workflow-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 003-eod-audit-coverage.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 004-eod-insert-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 005-eod-workflow-integrity.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 006-eod-history-identity.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 007-huddle-child-audit-coverage.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 008-task-page-permission.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 009-task-field-permission.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 010-notification-audit-coverage.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 011-huddle-review-permission.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 012-implant-office-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 013-task-identity-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 014-task-row-audit.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 015-implant-lookup-audit.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 016-implant-stock-transaction.sql | C | required for repaired write functionality | APPLIED: production migration 001; rows/ACL/owner preserved |
| 017-implant-delete-audit.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 018-user-office-assignment-transaction.sql | C | required for repaired write functionality | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 019-office-goal-read-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 020-insurance-access-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 021-bone-inventory-access-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 022-bone-role-active-profile.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 023-bone-delete-audit-history.sql | C | required for repaired write functionality | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 024-supply-synthetic-offices.sql | D | QA-only | Exclude synthetic constraints/execution simulation |
| 025-supply-request-access-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 026-supply-draft-transaction.sql | C | required for repaired write functionality | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 027-supply-submission-simulation.sql | D | QA-only | Exclude synthetic constraints/execution simulation |
| 028-supply-fulfillment-access-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 029-supply-fulfillment-audit.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: requires production audit-namespace/permission adaptation; no QA namespace installed |
| 030-supply-receipt-columns.sql | C | required for repaired write functionality | APPLIED: production migration 002; historical quantity/time null; original 480 rows intact |
| 031-front-desk-synthetic-offices.sql | D | QA-only | Exclude synthetic constraints/execution simulation |
| 032-front-desk-catalog-access.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 033-front-desk-catalog-audit.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: requires production audit-namespace/permission adaptation; no QA namespace installed |
| 034-front-desk-order-access.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 035-clinical-stock-access.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 036-clinical-stock-create-history.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: requires production audit-namespace/permission adaptation; no QA namespace installed |
| 037-supply-receipt-transaction.sql | C | required for repaired write functionality | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 038-urgent-request-audit-simulation.sql | D | QA-only | Exclude synthetic constraints/execution simulation |
| 039-urgent-request-access-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |
| 040-front-desk-review-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: requires production audit-namespace/permission adaptation; no QA namespace installed |
| 041-insurance-completed-form-lock.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: requires production audit-namespace/permission adaptation; no QA namespace installed |
| 042-service-goal-read-boundary.sql | C | safe-hardening candidate requiring production role validation | DEFERRED: existing production policies preserved; role/office matrix and dependency rollout required |

Required does not mean automatically authorized to execute an unchanged QA SQL file. Each candidate will be adapted and verified separately. No synthetic record, provider connection, production accounting record, QA credential, test adapter or QA runtime flag is included. Current production PH5-EXP-001 source is already on canonical main and retained.

All 79 frontend paths are included in the two production builds. QA-gated RPC/simulation behavior remains inactive in production, not promoted functionality. See CLOSURE.md for results and README.md for individual migration dependencies.
