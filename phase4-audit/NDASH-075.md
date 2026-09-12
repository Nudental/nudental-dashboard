# NDASH-075 — Count comparison changes are formatted as money

Section: RCM / Daily Comparison and shared MTD delta badges. Severity: Low. Status: repaired, deployed, live verification PASS.

Reproduction twice before editing on074, selected2026-09-12: the New Patients, Completed Appts and Claims Submitted rows show a same-weekday comparison of0 and a delta badge of—$0. The monetary Gross Production row correctly shows$0/—$0. Normal MTD -> Daily navigation reproduces all three incorrect count units.

Root cause: DeltaBadge unconditionally uses fmtCurrency when delta_pct is unavailable. The existing metric definitions already specify number/currency/pct, and the comparison value uses those definitions, but the badge does not receive the metric format.

Smallest shared repair in DailyComparisonTab.jsx: accept format with a currency default; use existing formatValue for the absolute-delta fallback; pass metric.format at the three Daily/MTD badge calls. Percentage formatting/priority, arrows, N/A and financial calculations remain unchanged. No backend or data changes.

Tests: actual JSX badge and three actual call sites with synthetic values reproduce3failures before;7checks PASS after, covering count0/12, signed money, percentage priority, N/A and default monetary fallback. Full334frontend tests and production source build37.73s PASS. Rocket804 matches the five changed lines. Actual compiled shared badge1298bytes, seven existing helper functions and three actual callers PASS for counts/money/percentage/N/A. Full reversal to074, prior repairs and seven dependency relinks PASS.

Live plan: all three count rows lose the dollar sign, monetary fallback and percentage deltas remain correct, MTD opens, today-default/historical selection and previous repairs remain intact. Preserve074 rollback and backend070; exclude blocked042/066; no full recovered source build deployment, business-data writes or exports.


Candidate: /assets/index-cfb58e8e9684.js / SHA cfb58e8e968417ed9a6696948f3e45430d95a5d06ec577826dfe699a0465c75c, based on565a5cc1-7644-4734-9364-655442f7253e.

Live closure: deployment07f9235c-d6d5-4cb8-bbe6-443d23dd1e0c / index-cfb58e8e9684.js. NewPatients/CompletedAppts/ClaimsSubmitted zero badgesnow—0; GrossProduction remains—$0; percentageexample—100% remains correctlyshown as down100.0%. BothMTDcountcomparisoncolumns haveproperunits/percentages. MTDgross230436.40/net125812.11/adjustments-104624.29,insurance10607.30+patient53580.15=collections64187.45,ratio51.0%,newpatients67/completed375/claims12/refunds3805.27/writeoffsabs108796.49matchAPIandUIrounding. FullreloadTodaySep12 preserved; returnMTD->DailyrepeatscountPASS. Backend070unchanged, alerts/capturederrors0. No business-data writes or exports. Prior074release retained.