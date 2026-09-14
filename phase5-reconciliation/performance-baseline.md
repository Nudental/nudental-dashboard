# Bounded Phase5 performance baseline

Production entry index-a6a4e36b8660.js is21,742,079 bytes (SHA256
a6a4e36b8660486de43e961184fc3c8c85cda00bc927d6de41bfd511dd245eb2).
The observed CDN gzip response was2,997,576 bytes. A local gzip calculation is
3,062,262 bytes; compression settings differ, so these are distinct measurements.

The reconciled source reference entry is8,820,106 bytes, gzip2,023,253, SHA256
386ff8ce3ff643e44233c518395a9d255a92df6a15273c61bc23aae7a992cbdb.
Historical Rocket component metadata accounts for approximately12.68MB of raw
entry differences, as explained in source-closure.md. This does not justify a
full production deployment by itself. No performance release was made.

The reference entry contains2668 modules. Routes.jsx has62 static imports and
one lazy declaration. Most section code and substantial spreadsheet (xlsx), QR
scanner (html5-qrcode), chart (Recharts) and PDF/canvas dependencies are eagerly
included. Original source sizes from the source map are evidence of inclusion,
not attributed compressed output sizes. The initial profiling script selected
a secondary index chunk; the corrected report resolves the entry from built
index.html and confirms the known entry hash.

Four read-only HTTP measurements from the existing server on2026-09-14:

| Request | Status | Total | Backend timing | Wire / decoded bytes |
| --- | --- | --- | --- | --- |
| Frontend HTML |200|0.101s|n/a|766 /1645|
| Production entry |200|0.562s|n/a|2,997,576 /21,742,079|
| API health |200|0.040s|0.001s|small health response|
| Expense summary |200|2.684s|2.646s|549 /1030|

These are server-vantage samples, not the user's network or browser metrics.
Browser-controlled reload took about41.5 seconds to reach account verification;
warm section navigation was about1–2 seconds. Tool waiting is not a precise
first-render measurement. Available browser inspection does not expose native
Performance entries or memory, and the tool's read-only scope returns no
performance object. Native first render, API waterfall/duplicates, largest API
payload ranking and chart rendering profiles remain unmeasured. Do not attribute
the overall delay to the Work computer's processor without that evidence.

After isolated QA is live, validate section-boundary lazy loading before any
production consideration; preserve loading/error behavior and all retained
regressions. The immediate high-confidence finding is excessive eager startup
code plus a measurable Expense API wait, not a need to redesign the application.
