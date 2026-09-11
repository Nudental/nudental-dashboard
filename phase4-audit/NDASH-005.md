# NDASH-005 — KPI office goal progress missing and benchmark displays NaN

Reproduced on /kpis, August 2026 / All Locations, and after full refresh. All four collection benchmark cells showed NaN%; production/collection goal-progress percentages were missing despite populated actuals and goals.

Root cause: kpiService.fetchGoalVsActual computed collectionRateActual but omitted collectionPct and three goal-progress fields consumed by GoalVsActualTable. BenchmarkCell tested null but allowed undefined/nonfinite values into its calculation.

Fix: add the four expected row fields, using existing actuals/goals and preserving missing-data/zero-goal behavior. BenchmarkCell computes only from finite actuals. No API, financial data, goal, authentication or source calculation changed.

Tests: six actual source row/benchmark regression tests fail before and pass after; 19 cumulative tests PASS. Actual candidate object/guard contract tests 4/4 PASS, bundle syntax PASS. Only those two corresponding production expressions changed; reversing them recovers the full prior bundle. Other asset files and all previous repairs preserved.

Candidate asset index-8d9aea49a6d5.js; SHA256 8d9aea49a6d566d541d4badb5d22113055b11d05bc4da0b3628036ba0787f47b.
Prior deployment fed81b66-df3d-4257-8116-ccbc8587fddf; rollback /home/openclaw/.cache/nudashboard-audit-20260910/ndash003-dist.

Production build, deployment and live verification recorded after execution. No business records changed.
