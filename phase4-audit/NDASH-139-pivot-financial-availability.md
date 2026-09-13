# NDASH-139 — Revenue Pivot reports failed requests as complete zero/partial totals

Severity: High. Status: repaired, deployed and live verified PASS.

Exact released138 Pivot effect was exercised with healthy financial replies, all failed requests, and one failed office. Healthy two-office control passes. All failures still produce three rows (two offices plus Total0), errornull. One failed office produces a complete-looking Total with only the other office, errornull. No live production outage or data write was induced. Healthy live All/single/pair pivot figures and arithmetic were independently verified during138.

Root cause: inner Promise.allSettled converts failed reads to null, then financial fallback literals turn missing amounts into zero. Outer allSettled silently filters rejected office rows and sums whatever remains. Catch does not clear previously displayed rows, so the error UI can remain hidden.

Targeted fix in PivotTable.jsx: preserve missing amounts as null, require every office's six finite financial fields before accepting its row, reject any incomplete office result, and clear rows on failure to reveal the existing error message. Preserve genuine zeroes, existing aliases/adjustment fallback, signed arithmetic, date/office scopes, refresh indicator and request guard. No backend or business-data changes.



Pre-release: 685 frontend tests PASS (9 new pivot availability/scope/date/zero/signed/fallback/stale regressions); production build39.50s; Rocket868 one-file correction/build PASS. Actual compiled healthy/full/partial-failure and exact date/scope checks PASS; one effect region plus seven dependency relinks; full reversal138 and prior modules unchanged.


Release sourcea0a649d; deployment28910225-c3f4-4858-80f7-60f6ef70678a; entryindex-f0aa362fa216.js SHAf0aa362fa2161df1ac6a78cca41ab945ef55ff140e8b142fca1278841b74775e (21736074bytes). Exact published artifact/API/services/backend131 PASS. Prior138 retained;042/066 excluded.

Live PASS: fresh139Jan-Jun2026 All5rows, Barnegat2rows and pair3rows. Net/collection fingerprints match independent source (Allf3439488/832fcb70; Bar951a12c8/bd2680a1; pair7bff9ac2/290396b8). Every row preserves gross+adjustments=net and patient+insurance=collections. All six Statistical Summary fields match Pivot across all three scopes. No new browser errors. Unavailable/partial/zero/stale cases verified by controlled source and exact release-code tests; no live outage, provider sync, financial writes or configuration changes.
