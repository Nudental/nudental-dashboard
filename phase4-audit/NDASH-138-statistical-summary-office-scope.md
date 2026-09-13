# NDASH-138 — Statistical Summary widens multiple selected offices to All

Severity: High. Status: reproduced; repair under verification.

Live136 and137 Jan1-Jun30,2026 Barnegat+Brick each displayed All-office Statistical Summary gross/net fingerprints6851d7ad/52f5821a, while the correctly scoped Pivot displayed the pair total net7bff9ac2 (cents fingerprint). Independent source comparisons from133 confirm those distinct All/pair totals. Original test repeated on fresh137 before editing.

Root cause: StatisticalSummary resolves a location only for exactly one selected office; two or more produce null and both financial API calls return All. Targeted fix: import the already verified fetchFinancialReportForOffices reader and replace only the two production/collections request expressions with the full officeKey split. Preserve every statistical formula, null/unavailable distinction, date and request guard. No backend, configuration or business-data changes.

Tests/build/Rocket/deployment/live verification pending.

Pre-release: 676 frontend tests PASS, including5new full-scope, All/single, unavailable, zero and retained-race tests. Production build38.85s; Rocket867 one-file correction/build PASS. Actual compiled two-call scope/date checks PASS; one containing array region plus seven dependency relinks; full reversal137 and prior modules unchanged.
