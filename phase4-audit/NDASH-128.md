# NDASH-128 — Monthly Growth sparkline tooltip shows a point index

Severity: Low. Status: reproduced; verification pending.

Reproduced twice on the verified004-v2 release: click the center of a six-month production sparkline in August2026. The tooltip label is2 rather than the point month. Four line charts and the financial table remain healthy.

Root cause: the chart has no named X-axis, so its default tooltip label is a numeric point index. MonthlyGrowthTab.jsx returns that label unchanged even though the tooltip payload already includes the month.

Smallest fix: one labelFormatter reads payload[0].payload.month, with Month unavailable for missing context. No queries, values, chart points, currency formatting or other components change. Retained frontend/build verification plus actual compiled formatter cases and live chart interaction cover this presentation-only change. No business-data writes or exports.

Predeployment PASS:586 retained frontend tests,build34.53s,Rocket856. Actual compiled old formatter returns2; new formatter returns May/Jan/Dec and Month unavailable for absent/empty payload. Exactly one callback changes; full reverse restores004-v2 byte-for-byte, and all seven dependent modules only relink. Candidate index-1dc024ebbec2.js; deployment/live verification pending.
