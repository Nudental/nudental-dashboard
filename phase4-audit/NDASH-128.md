# NDASH-128 — Monthly Growth sparkline tooltip shows a point index

Severity: Low. Status: CLOSED — deployed and live verified PASS.

Reproduced twice on the verified004-v2 release: click the center of a six-month production sparkline in August2026. The tooltip label is2 rather than the point month. Four line charts and the financial table remain healthy.

Root cause: the chart has no named X-axis, so its default tooltip label is a numeric point index. MonthlyGrowthTab.jsx returns that label unchanged even though the tooltip payload already includes the month.

Smallest fix: one labelFormatter reads payload[0].payload.month, with Month unavailable for missing context. No queries, values, chart points, currency formatting or other components change. Retained frontend/build verification plus actual compiled formatter cases and live chart interaction cover this presentation-only change. No business-data writes or exports.

Predeployment PASS:586 retained frontend tests,build34.53s,Rocket856. Actual compiled old formatter returns2; new formatter returns May/Jan/Dec and Month unavailable for absent/empty payload. Exactly one callback changes; full reverse restores004-v2 byte-for-byte, and all seven dependent modules only relink. Candidate index-1dc024ebbec2.js; deployment/live verification pending.

Deployment49a929fd-f926-4b17-b9a1-e6cde0e8ea86; entry index-1dc024ebbec2.js SHA2561dc024ebbec248ee88cd456fb7ac54468903735a532c831eecc2625f1437f550; source97843a9. Live original center-point test now displays May in the March–August series, and Oct in the August–January series. Refresh restores May correctly. Four line charts remain rendered. All30 August and30 January table/API values from004 remain matched. New browser errors0; frontend/API200; three existing services active; backend113 unchanged. Previous004-v2 release preserved. No business-data or test-record changes.
