# NDASH-138 — Statistical Summary widens multiple selected offices to All

Severity: High. Status: repaired, deployed and live verified PASS.

Live136 and137 Jan1-Jun30,2026 Barnegat+Brick each displayed All-office Statistical Summary gross/net fingerprints6851d7ad/52f5821a, while the correctly scoped Pivot displayed the pair total net7bff9ac2 (cents fingerprint). Independent source comparisons from133 confirm those distinct All/pair totals. Original test repeated on fresh137 before editing.

Root cause: StatisticalSummary resolves a location only for exactly one selected office; two or more produce null and both financial API calls return All. Targeted fix: import the already verified fetchFinancialReportForOffices reader and replace only the two production/collections request expressions with the full officeKey split. Preserve every statistical formula, null/unavailable distinction, date and request guard. No backend, configuration or business-data changes.



Pre-release: 676 frontend tests PASS, including5new full-scope, All/single, unavailable, zero and retained-race tests. Production build38.85s; Rocket867 one-file correction/build PASS. Actual compiled two-call scope/date checks PASS; one containing array region plus seven dependency relinks; full reversal137 and prior modules unchanged.


Release source19ee6b7; deployment5c467e5d-659a-4041-8638-511160159448; entryindex-7b66fa26bbd3.js SHA7b66fa26bbd36a53fcec1cd37dc7117be509005cb0f5fc239e552e144bc6b79e (21735450bytes). Exact published artifact/API/services/backend131 PASS. Prior137 retained;042/066 excluded.

Live PASS: fresh138Jan-Jun2026 All net52f5821a, Barnegat7ba68c32, paira4487135 match independent source and selected Pivot totals. All six Statistical Summary financial fields match the single/pair Pivot at displayed whole-dollar precision. RepeatedApply returns the same six pair values after loading; no new browser errors. Goal136pairJanuarycontext22605275 and Trend133pairpath65a52a42/24dots retained. No business records, API configuration or calculation formulas changed.
