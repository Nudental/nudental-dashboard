# NDASH-091 — Analytics date presets include an extra day

Section: Huddle Analytics. Status: verification in progress.

Reproduced after NDASH090 was deployed and verified: Barnegat Last30 chart spans Aug13–Sep12; Last7 spans Sep5–Sep12. The latter has seven records because Sep6 has no huddle, but its query covers eight calendar dates. Source getDateRange subtracts the full preset count while getHuddlesForAnalytics uses inclusive gte/lte boundaries.

One source line in src/pages/huddle-analytics/index.jsx now subtracts days-1 using UTC calendar arithmetic, aligned with the helper's existing ISO date output. The end date, inclusive service query, office scope, request-generation guards, chart formulas, and production data are unchanged.

Nine focused tests exercise all four presets, year/month/leap-year and DST boundary timestamps, and retained inclusive office/date filtering. Eight failed before. All395 frontend tests pass after; production build27.00s PASS. No typecheck script. Rocket and compiled deployment verification pending.

Rocket confirmed the exact single-line change. Actual compiled helper passes all eight window cases; the complete entry reverses exactly to090;090requestgeneration/089zero-ratio/088scopekey preserved. Seven dependencies only relink the entry; no payroll code changed. Candidate index-99ead9f6b1f6.js; live verification pending.

CLOSED PASS. Deployment4903228d-2910-45fc-b2af-bd0bba410d1f/index-99ead9f6b1f6.js. LiveinitialBar30=25/chartAug14–Sep12;Bar7=6/chartSep7–Sep12(Sep6hasnoexistingrecord);All7=24;rapid60-to30All=100;rapidAll-to-Bar30=25;Refresh25. Oldcharts0duringloading,errors0. Frontend/API200/three servicesactive/backend085unchanged.090rollbackretained. No business writes.
