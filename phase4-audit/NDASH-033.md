# NDASH-033 — Inconsistent benefit monthly and annual estimates

Section: Payroll / Gusto Overview and Benefits. Severity: Medium. Status: candidate verified; release pending.

Reproduced live before editing: Overview labels625.00 as monthly. Benefit plan cards show1250.00 monthly and15000.00 annually. Table totals show625.00 per paycheck and16250.00 annually. The imported pay schedule is Every other week (nonidentifying schedule-type query). Source schema/import helpers preserve numeric per-paycheck contributions and optional percentage flags. HEAD-only counts found no explicit true percentage flags:4 false and34 null for each flag. No employee rows were retrieved by source audit queries. Independent database SUM aggregation is unavailable; observed totals are UI aggregates, not independently source-sum verified.

Root cause: Overview omitted pay-frequency conversion; plan cards used2 checks/month (24/year), while the table/CSV use26/year. Gusto documents legacy company_contribution as per-pay-period. Source: https://docs.gusto.com/app-integrations/reference/post-v1-employees-employee_id-employee_benefits .

Small fix: both monthly estimates use per-check contributions*26/12. Annual table/CSV arithmetic stays unchanged. Labels disclose26-check estimate assumption in plan cards, annual columns/CSV headers and Overview subtext. Files: GustoBenefits.jsx, useGustoSummaryTotals.js, GustoKPICards.jsx. No financial data, payroll schedule, import or provider changes.

Verification:111 frontend regression tests PASS; production build35.53s. Six focused source tests (five failed before) PASS. Four actual Benefits-module scenarios plus four actual main-expression scenarios PASS; the three nonzero baseline scenarios failed. Synthetic fixtures only, no business requests or downloads. Rocket version765 completed the same scoped changes.

Limit: these are annualized estimates, not actual year/month expenses. Actual pay counts can vary; source frequency is displayed as biweekly and labels now disclose26. Existing null percentage metadata has not been backfilled or reinterpreted; no explicit percentage enrollments were found. Query-failure behavior remains a separate investigation.
