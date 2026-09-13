# NDASH-156 — Expense Overview Payment Source / Draft capability

Severity: High. Status: candidate verified; deployment/live verification pending.

## Reproduction and root cause

On live NDASH-155, Expense Report This Year / All Offices with other filters All: applying Payment Source Gusto twice left Total Expenses, Gusto Payroll Funding and AmEx headline fingerprints identical to unfiltered results, while chart data changed. Applying Status Draft twice retained processed Gusto Payroll Funding and bank/payroll category groups. Reset restored defaults. Source Gusto Payroll and Posted status control cases changed results; these controls are preserved.

`expenseReportService.js` summary fallback condition omits payment sources, and Gusto facts / processed payroll reads do not apply Draft status. The combined Overview therefore cannot safely represent those selections. No source authority or accounting changes are inferred from this test.

## Targeted repair

`src/pages/financial-analytics/ExpenseReport.jsx`: extend the existing applied-filter Overview limitation guard to non-All Payment Source and Draft status. Explain reset and filtered Transactions alternatives. Preserve Department/Category guard, Source filter, Posted status, loading/error behavior, pending edits and every transaction query. This exposes unsupported combinations; it does not implement combined-source allocation or certify default financial totals.

## Validation

Six focused source-executed tests: three fail before repair. All 825 frontend tests pass after repair, including retained NDASH-155 Overview/tab guards. Production build and exact-live scoped artifact validation recorded at closure. No business-data or configuration changes. NDASH-042/066 excluded.
