# NDASH-039 — Comparison requests without required period dates

Status: repaired and tested; deployment pending. Severity: Medium.

Opening Comparison and Clear Filters send an incomplete API request and display API error422. Starting with only one date also fails. Current deployed backend contract requires startDate and endDate; direct read-only comparison request without dates returns422 missing both query fields, while Aug3–16,2026 returns200 and13 rows. No financial totals or provider records included in the saved contract evidence.

Root cause: useGustoComparison sends on mount/every filter change without date validation. Blank initial dates cannot satisfy the API contract. Prior counts are retained on error and an older response can restore data after dates are cleared.

Repair scope: require a complete valid ordered date range; show a clear date-selection message; clear old comparison results and reject late responses when selection changes. Preserve all valid query parameters, including Gusto period dates, check date and provider filters. No payroll math, Ascend shift, API contracts, mappings or business data changes.

Browser testing note: date fill alone updated DOM without committing React state. Native ArrowUp then ArrowDown commits the same final value; use that sequence for valid live date tests. This automation behavior is not classified as an app defect.

Changed only useGustoComparison.js and ComparisonRoot.jsx. Eight focused tests had seven failures before repair; all eight source and actual release-hook scenarios now PASS. Full retained suite143 PASS; production source build PASS39.56s. Five scoped production-main regions changed; seven dependent files only relinked to the new main, with complete prior graph preserved. No source/API/configuration or payroll calculation change. Rocket version771 completed the same correction.
