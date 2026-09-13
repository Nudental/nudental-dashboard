# NDASH-157 — Expense category pie completeness

Severity: Medium. Status: candidate verified; deployment/live verification pending.

## Reproduction and root cause

Live NDASH-156: All Sources shows only ten category slices. Supported Source Gusto Payroll reveals Benefit Paid; its tooltip value is positive. Restoring All Sources drops that category. Repeated the positive-category readback twice. The source aggregation retains positive categories; `ExpenseCharts.jsx` then silently slices to ten before Pie computes its percentage denominator.

## Targeted repair

Change only `categoryData` useMemo in `src/pages/financial-analytics/components/expense-report/ExpenseCharts.jsx`: retain the first ten mapped categories and append Remaining categories with the sum of the rest. Existing exclusion filtering runs first. Preserve existing leading labels/values, KPI calculations, source queries and all other charts. This corrects chart completeness; no source accounting assumption is changed or newly certified.

## Validation

Eight focused callback tests, five fail before repair. Complete sum/denominator, at-most-ten behavior, exclusions, numeric string totals, leading order/labels, zero tail and immutable inputs covered. All 833 frontend tests PASS. Build, actual compiled callback, reverse proof and live checks recorded at closure. No production fixtures, financial writes, configuration changes or provider sync.
