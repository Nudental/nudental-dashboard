# NDASH-136 — Daily target plotted against monthly totals and incorrect office scope

Severity: High. Status: reproduced; targeted repair under verification.

Live135 Line and Bar each display a Daily Target reference line against monthly financial values. The two-office Barnegat+Brick selection shows exactly the Barnegat goal (identical daily/monthly fingerprints) after refresh completion. Read-only January2026 office_goals aggregates verify four distinct office records; pair and All totals differ from every single-office figure.

Root cause: FinancialAnalytics uses appliedOffices[0] or the first accessible office; goalData is not cleared on filter changes or failures. ChartVisualization plots dailyTarget (the production goal divided by calendar days) as a constant line across 12 monthly totals. The unqualified legend omits which office/month the goal covers. This is a production goal, not a collections goal.

Targeted correction: retain goals as a separately labeled production-goal summary for the start month and exact selected accessible offices. Read existing office goals, validate all expected records, sum deduplicated scopes, preserve explicit zero and legacy monthly-target fallback, cap reads at four, and suppress stale/incomplete results. Remove only the two daily reference lines. Display loading/unavailable states and explicit month/office labels; retain the daily pace as clearly labeled calendar-day context. No goal writes, accounting changes, collection reads or configuration changes.

Files: goalsService.js (new scoped goal-context reader), financial-analytics/index.jsx (guarded goal-context loader), ChartVisualization.jsx (remove daily overlay; label context).

Tests/build/Rocket/deployment/live verification pending. No business data changed.

Pre-release: 656 frontend tests PASS (11 new goal scope, metadata, fallback, zero, error, concurrency and stale-response regressions); production build38.36s. Rocket865 completed the same three-file correction and build. Actual compiled scope/error/stale-goal tests PASS; five targeted regions plus seven dependency relinks; full reversal135 and prior seven modules PASS. No backend change.
