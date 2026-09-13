# NDASH-133 — Analytics modes widen selected offices to All Offices

Severity: High. Status: CLOSED — PASS.

On live132, Trend, Comparative Analysis and Forecasting all show All Offices production/collection values when Barnegat and Brick are selected. Trend repeated: exact24dots/two line paths unchanged (339914f5) between All and pair. November2025 tooltip pair repeats All net550c0bbe/collections557ccf8b; read-only scoped source requires pair1e7cd9b8/db369199. Comparative Jan-Jun2026 selected values repeat All f3439488/832fcb70; pair source7bff9ac2/290396b8. Forecast June2026 current and full-month forecast repeat All8fc4d894/4c1960df; pair sourceafd0ac40/fa051bf4. All reproduction output is fingerprints only, no business records or values retained. Multi-month forecast guard correctly blocks Jan-Jun and remains unchanged.

Root cause: all three financial read paths resolve2+ selected offices to a null location argument, which means All Offices. Subtab repairs129–132 do not cover these separate chart readers.

Targeted fix: one financial-only reader in dentrixNormalizedService.js aggregates signed production/collections from validated, deduplicated selected office IDs. All and single scopes retain their existing API response. Connect only the eight financial calls in financial-analytics/index.jsx and components/ChartVisualization.jsx. Preserve periods, chart/forecast/comparison calculations and all prior repairs. No backend or business-data changes. Unused trend patient metadata and separate goal/filter/error-handling concerns remain outside this repair.

Tests/build/Rocket/scoped artifact/deployment/live verification: pending.

Pre-release verification: 632 frontend tests PASS (11 new tests), build PASS37.95s. Rocket reports all three files updated and a successful build. Actual compiled helper signed-sum/scope/failure checks PASS; eight call sites verified (trend2/comparison4/forecast2), full reversal to132 and seven retained dependency modules PASS. No production/API changes yet.


Deployment: 200121ea-4d38-4df6-814d-3263b1f96349, assetindex-d215602532bd.js, SHA256d215602532bd4505ae0a54f51e6401a40a5b249f04b1a55953c186cd80c926d6; source997be3f. Exact published streamed hash/browser-loaded asset PASS; frontend/API200, three services active, backend131unchanged.

Live results so far: TrendAll/single/pair November2025 tooltip values match their respective independent API fingerprints. Pair curve now65a52a42;24line dots and24bar marks preserve the12periods andtwo source-backed series. ComparativeJan-Junselected net/collections match pair7bff9ac2/290396b8. Forecastmulti-month guard preserved; June current/full-month forecast matches pairafd0ac40/fa051bf4 and repeats onApply. Adjacent daily/payment checks pending before closure.


Closure: retained129/130/131combined-office headline/filter/payment13row fingerprints PASS;132Dailycollections zero readback retained. New browsererrors0. No business data/configuration/provider changes or test records. Old132andearliergraphs preserved; unreleased042/066excluded.
