# NDASH-156 — Expense Overview Payment Source / Draft capability

Severity: High. Status: candidate verified; deployment/live verification pending.

## Reproduction and root cause

On live NDASH-155, Expense Report This Year / All Offices with other filters All: applying Payment Source Gusto twice left Total Expenses, Gusto Payroll Funding and AmEx headline fingerprints identical to unfiltered results, while chart data changed. Applying Status Draft twice retained processed Gusto Payroll Funding and bank/payroll category groups. Reset restored defaults. Source Gusto Payroll and Posted status control cases changed results; these controls are preserved.

`expenseReportService.js` summary fallback condition omits payment sources, and Gusto facts / processed payroll reads do not apply Draft status. The combined Overview therefore cannot safely represent those selections. No source authority or accounting changes are inferred from this test.

## Targeted repair

`src/pages/financial-analytics/ExpenseReport.jsx`: extend the existing applied-filter Overview limitation guard to non-All Payment Source and Draft status. Explain reset and filtered Transactions alternatives. Preserve Department/Category guard, Source filter, Posted status, loading/error behavior, pending edits and every transaction query. This exposes unsupported combinations; it does not implement combined-source allocation or certify default financial totals.

## Validation

Six focused source-executed tests: three fail before repair. All 825 frontend tests pass after repair, including retained NDASH-155 Overview/tab guards. Production build and exact-live scoped artifact validation recorded at closure. No business-data or configuration changes. NDASH-042/066 excluded.

## CLOSED — live PASS
Source commit 225ac04. Deployment 9096d2d9-b8a5-4e03-99cb-523a5a887d8a; entry index-4e0380c3b6da.js, SHA256 4e0380c3b6da886ad5861142578e0427f0a336944850ebc5ae56415fef395a5f, 21,740,566 bytes. Build 36.69s; 825 tests PASS; Rocket886. Compiled guard cases, component reversal, full reversal to155 and all seven dependent modules PASS. Exact live artifact, unchanged backend148 and three services healthy. Payment/Draft alerts with zero cards/charts PASS; Transactions accessible. Posted and Gusto Source results exactly match pre-repair references. Reset restores all18cards/5charts; pending edits preserve the applied overview. Zero new browser errors. No business-data/configuration changes. Unsupported combined filtering remains explicit.
