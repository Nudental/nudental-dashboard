# NDASH-031 — Missing separately loaded application files

Section: Gusto subviews, Help Manual and client export dependencies. Severity: High.
Status: reproduced, root cause verified, candidate tested; not deployed yet.

Live reproduction: Benefits fails with a network-error panel and Retry repeats the failure. Browser reports failed dynamic import of GustoBenefits-crX-xJ9D.js. All four Gusto code-file URLs return200 text/html rather than JavaScript; static fallback masks the missing assets.

Root cause: the original preserved deployment contains only its main JavaScript and stylesheet, plus images. All eight relative dynamic imports are absent: Benefits, Pay Schedules, Import History, Time & Attendance, Help Manual, date-fns, Canvg and DOMPurify. The current release preserves that original omission; original Rocket asset URLs also return404.

Repair candidate: restore only the eight rebuilt code files from the preserved frontend source.119 shared export interfaces match the currently deployed main script after normalizing local variable names and instrumentation. Keep the functioning main implementation and stylesheet; change only its eight missing-file references. Added files import the resulting main script and receive unique release names, so older browser sessions cannot accidentally import a second main script. No provider calls, business writes, backend, authentication or infrastructure changes.

Tests: all eight code files parse and have a complete dependency graph; five screen modules link and render in isolation with zero business-data requests.119 shared interfaces match. Exact reference-patch reversal restores the current main script. Source build and100 frontend tests from030 remain valid; source application code is unchanged.

The existing deployment helper now verifies added-asset checksums and refuses missing relative JavaScript dependencies. Original and current deployments remain preserved for rollback. Benefits data/error/export behavior still requires its functional audit after the code-loading defect is repaired.
