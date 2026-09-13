# NDASH-146 — Performance trends collapse selected offices into All

Severity: High. Status: reproduced and tested; deployment/live verification pending.

Live145 Operations > Performance, Last Month: Barnegat+Brick twice displays legend all and the same collection/adjustment paths c2edf0c7/3b9f5e05 as All Locations. August collection tooltip fingerprint83acfdc1 matches the independent All source. Barnegat alone already works: paths47c2342b/bfad2cfe and August collection fingerprintdfc1982e. Direct source reads confirm Barnegat UUID and its Dentrix ID produce identical aggregates; no single-office source defect is claimed.

Root cause: the monthly trend block maps every multi-office selection to null and writes one office_id all record per month. Smallest fix: keep a deduplicated, validated office list and one monthly record per explicitly selected office, using the existing per-office chart structure. Empty/All retains the combined series. Reuse existing LOCATION_ID_MAP; retain completed-month window, production/collection fields, null handling, chart formulas, KPI goals, heatmap, provider lookup and case-acceptance unavailable gate.

Eight actual-source monthly-block tests: five failures reproduced before editing, with All, single and calendar controls passing. All745 frontend tests PASS after the fix; production build31.31s PASS. Actual compiled block passes All/single/pair/four-office/duplicate/invalid cases. One scoped awaited block plus seven dependency relinks reverses exactly to145; prior modules and syntax PASS. The artifact retains two now-unused existing local declarations outside the replaced block, avoiding any unrelated compiled rewrite. Rocket875 completed the matching one-file change and build. No business records, exports, provider sync or backend/configuration changes.

Independent August source percentage fingerprints at the existing one-decimal display precision: All collection83acfdc1/adjustment04911393; Barnegat dfc1982e/467f8d36; Brick cea89304/61a261f5. Use these for live tooltip verification; do not print financial amounts.
