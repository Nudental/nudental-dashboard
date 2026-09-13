# NDASH-136 — Daily target plotted against monthly totals and incorrect office scope

Severity: High. Status: repaired, deployed and live verified PASS.

Live135 Line and Bar each display a Daily Target reference line against monthly financial values. The two-office Barnegat+Brick selection shows exactly the Barnegat goal (identical daily/monthly fingerprints) after refresh completion. Read-only January2026 office_goals aggregates verify four distinct office records; pair and All totals differ from every single-office figure.

Root cause: FinancialAnalytics uses appliedOffices[0] or the first accessible office; goalData is not cleared on filter changes or failures. ChartVisualization plots dailyTarget (the production goal divided by calendar days) as a constant line across 12 monthly totals. The unqualified legend omits which office/month the goal covers. This is a production goal, not a collections goal.

Targeted correction: retain goals as a separately labeled production-goal summary for the start month and exact selected accessible offices. Read existing office goals, validate all expected records, sum deduplicated scopes, preserve explicit zero and legacy monthly-target fallback, cap reads at four, and suppress stale/incomplete results. Remove only the two daily reference lines. Display loading/unavailable states and explicit month/office labels; retain the daily pace as clearly labeled calendar-day context. No goal writes, accounting changes, collection reads or configuration changes.

Files: goalsService.js (new scoped goal-context reader), financial-analytics/index.jsx (guarded goal-context loader), ChartVisualization.jsx (remove daily overlay; label context).

No business data changed.

Pre-release: 656 frontend tests PASS (11 new goal scope, metadata, fallback, zero, error, concurrency and stale-response regressions); production build38.36s. Rocket865 completed the same three-file correction and build. Actual compiled scope/error/stale-goal tests PASS; five targeted regions plus seven dependency relinks; full reversal135 and prior seven modules PASS. No backend change.


Release source253d0a4; deploymentd2ed4d3c-f278-40d7-b6f6-7a5ce734a469; entryindex-a67eed8f7663.js SHAa67eed8f7663b32fc118c90ed6a58e73186c40dbf6c3ce464c3c1990ea0d6611 (21734549bytes). Exact published artifact and API200/services/backend131 PASS. Prior135 retained;042/066 excluded.

Live PASS: All Offices(4), Barnegat and Barnegat+Brick January2026 goal totals match independent read-only source fingerprints d7ba934f/e7d8c7c4/22605275. Context shows exact month and scope. Changing selection visibly clears previous amount and shows loading; Line and Bar have zero daily reference lines. Scatter hides goal context and still renders12points; June26 pair matches093e0883/afd0ac40. No new browser errors. Missing/error/stale-response behavior covered by controlled source and exact compiled tests, without inducing a production outage. No goal writes or business-data changes.
