# NDASH-142 — Failed monthly reads become zero financial trend points

Severity: High. Status: CLOSED PASS.

Healthy live141 Barnegat Jan1-Jun30 trend retains the independently verified path18da9bd2. Exact released141 monthly effect reproduced with healthy controls and controlled financial failures: full failure renders twelve zero months; one failed month produces one zero point; collections failure renders twelve zero collection values. No live outage or business write induced.

Root cause: production/collections catch-to-null defaults hide required financial failures; allSettled filters can omit rejected months and there is no chart error state.

Fix limited to Financial Analytics index.jsx and ChartVisualization.jsx: require successful finite net-production/collection totals for every requested month, propagate failures, preserve optional patient metadata fallback, set a guarded error state, and render an alert before chart/empty branches. Preserve zeroes, aliases, signed aggregation and existing display formulas, dates, office scope, and obsolete-request protection. Existing empty-state wording is retained; unpublished042/066 are excluded.

Verification:714 frontend tests PASS (eleven new availability/recovery/render cases); production build35.53s PASS; Rocket871 complete. Four scoped regions plus seven dependency relinks; actual compiled healthy/full-failure/partial-failure/malformed/zero/race/alert-render checks PASS. The existing embedded calendar-period helper is preserved. Complete reversal equals live141; all seven prior modules preserved; JavaScript syntax PASS. Deployment/live verification pending.

Closure: source933df11; deploymentda3dbdbd-f54a-41b1-80a6-400062c1be6b; index-51143cd49507.js SHA25651143cd49507d4022f883689d89ce6501c52012342f98e3665158428faa2161b. Fresh live142 Jan1-Jun30 All/Barnegat/pair Line paths339914f5/18da9bd2/65a52a42 match previous independently verified results. June Bar source net1b24b61c/collections32ce8d3c and pairafd0ac40/fa051bf4 match plotted values. Bar24 rectangles; Scatter12 points, June pair marketing093e0883/netafd0ac40; Line restored. No new browser errors. Exact deployed asset, Dashboard/API health, three services and unchanged backend131 PASS. No business writes/configuration changes;042/066 excluded; previous141 preserved. Failure paths were controlled compiled tests, not a live outage.
