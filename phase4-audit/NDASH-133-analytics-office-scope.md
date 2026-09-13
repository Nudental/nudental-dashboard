# NDASH-133 — Analytics modes widen selected offices to All Offices

Severity: High. Status: reproduced; targeted source correction under verification.

On live132, Trend, Comparative Analysis and Forecasting all show All Offices production/collection values when Barnegat and Brick are selected. Trend repeated: exact24dots/two line paths unchanged (339914f5) between All and pair. November2025 tooltip pair repeats All net550c0bbe/collections557ccf8b; read-only scoped source requires pair1e7cd9b8/db369199. Comparative Jan-Jun2026 selected values repeat All f3439488/832fcb70; pair source7bff9ac2/290396b8. Forecast June2026 current and full-month forecast repeat All8fc4d894/4c1960df; pair sourceafd0ac40/fa051bf4. All reproduction output is fingerprints only, no business records or values retained. Multi-month forecast guard correctly blocks Jan-Jun and remains unchanged.

Root cause: all three financial read paths resolve2+ selected offices to a null location argument, which means All Offices. Subtab repairs129–132 do not cover these separate chart readers.

Targeted fix: one financial-only reader in dentrixNormalizedService.js aggregates signed production/collections from validated, deduplicated selected office IDs. All and single scopes retain their existing API response. Connect only the eight financial calls in financial-analytics/index.jsx and components/ChartVisualization.jsx. Preserve periods, chart/forecast/comparison calculations and all prior repairs. No backend or business-data changes. Unused trend patient metadata and separate goal/filter/error-handling concerns remain outside this repair.

Tests/build/Rocket/scoped artifact/deployment/live verification: pending.

Pre-release verification: 632 frontend tests PASS (11 new tests), build PASS37.95s. Rocket reports all three files updated and a successful build. Actual compiled helper signed-sum/scope/failure checks PASS; eight call sites verified (trend2/comparison4/forecast2), full reversal to132 and seven retained dependency modules PASS. No production/API changes yet.
