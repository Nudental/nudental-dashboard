# NDASH-005 — KPI office goal progress missing and benchmark displays NaN

Reproduced on /kpis, August 2026 / All Locations, and after full refresh. All four collection benchmark cells showed NaN%; production/collection goal-progress percentages were missing despite populated actuals and goals.

Root cause: kpiService.fetchGoalVsActual computed collectionRateActual but omitted collectionPct and three goal-progress fields consumed by GoalVsActualTable. BenchmarkCell tested null but allowed undefined/nonfinite values into its calculation.

Fix: add the four expected row fields, using existing actuals/goals and preserving missing-data/zero-goal behavior. BenchmarkCell computes only from finite actuals. No API, financial data, goal, authentication or source calculation changed.

Tests: six actual source row/benchmark regression tests fail before and pass after; 19 cumulative tests PASS. Actual candidate object/guard contract tests 4/4 PASS, bundle syntax PASS. Only those two corresponding production expressions changed; reversing them recovers the full prior bundle. Other asset files and all previous repairs preserved.

Candidate asset index-8d9aea49a6d5.js; SHA256 8d9aea49a6d566d541d4badb5d22113055b11d05bc4da0b3628036ba0787f47b.
Prior deployment fed81b66-df3d-4257-8116-ccbc8587fddf; rollback /home/openclaw/.cache/nudashboard-audit-20260910/ndash003-dist.

Production build PASS (31.61 seconds). Deployment 3761ea17-03b2-4ce6-8023-e5268b66131e succeeded. Live verification PASS: NaN count zero; valid goal-progress values return (Eatontown 102.8% production and 93.5% collections), collection rates 86.4%, 63.9%, 87.6%, 108.4%, average 86.6%; zero patient goals still show no divided-by-zero progress. Dollar totals unchanged. The initial KPI refresh loaded slowly; API/frontend health 200, all three services active, 4,671 MiB available memory. No business records changed.
