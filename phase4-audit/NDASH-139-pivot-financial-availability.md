# NDASH-139 — Revenue Pivot reports failed requests as complete zero/partial totals

Severity: High. Status: reproduced; repair under verification.

Exact released138 Pivot effect was exercised with healthy financial replies, all failed requests, and one failed office. Healthy two-office control passes. All failures still produce three rows (two offices plus Total0), errornull. One failed office produces a complete-looking Total with only the other office, errornull. No live production outage or data write was induced. Healthy live All/single/pair pivot figures and arithmetic were independently verified during138.

Root cause: inner Promise.allSettled converts failed reads to null, then financial fallback literals turn missing amounts into zero. Outer allSettled silently filters rejected office rows and sums whatever remains. Catch does not clear previously displayed rows, so the error UI can remain hidden.

Targeted fix in PivotTable.jsx: preserve missing amounts as null, require every office's six finite financial fields before accepting its row, reject any incomplete office result, and clear rows on failure to reveal the existing error message. Preserve genuine zeroes, existing aliases/adjustment fallback, signed arithmetic, date/office scopes, refresh indicator and request guard. No backend or business-data changes.

Tests/build/Rocket/deployment/live verification pending.

Pre-release: 685 frontend tests PASS (9 new pivot availability/scope/date/zero/signed/fallback/stale regressions); production build39.50s; Rocket868 one-file correction/build PASS. Actual compiled healthy/full/partial-failure and exact date/scope checks PASS; one effect region plus seven dependency relinks; full reversal138 and prior modules unchanged.
