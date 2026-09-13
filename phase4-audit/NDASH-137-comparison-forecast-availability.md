# NDASH-137 — Comparison and Forecast turn failed reads into zero financial totals

Severity: High. Status: repaired, deployed and live verified PASS.

Controlled reproduction executed the exact released136 compiled Comparison and Forecast effects, with healthy responses as controls followed by rejected financial requests. Both emitted netProduction0, errornull and no cleanup function after failure. No live outage was induced. Source confirmed six catch-to-null expressions feeding nullish zero defaults, with no request cleanup to prevent older selections overwriting current values.

Targeted correction in ChartVisualization.jsx only: let financial errors reach the existing error UI, require finite report fields (including detailed Comparison fields), clear prior records at selection changes, and gate post-request data/error/loading updates with effect cleanup. Preserve verified zeroes, existing field aliases, signed amounts, date windows and all comparison/forecast formulas. No API/source configuration or business-data changes.



Pre-release: 671 frontend tests PASS, including15new availability/formula/race tests. Retained office-scope fixture now loads the actual new validator. Production build38.50s; Rocket866 one-file correction/build PASS. Actual compiled failure/race/formula tests PASS; three scoped regions plus seven dependency relinks, full reversal136 and unchanged prior modules PASS.


Release source3251324; deployment97b7a010-31af-456f-a914-8e164007d620; entryindex-c2e64c999d4a.js SHAc2e64c999d4a59aa57b1f760c3a6cd24e26e9abb66dbf6c36b6b03408ba7b1dc (21735378bytes). Exact published artifact/API/services/backend131 PASS. Prior136 retained;042/066 excluded.

Live PASS: fresh137Comparison Jan1-Jun30 Barnegat+Brick renders all7current/previous metrics; selected net7bff9ac2 and collections290396b8 match independent source. Forecast rejects the six-month range with its existing single-month notice. June1-30 pair current and projected netafd0ac40/collectionsfa051bf4 match source; repeatedApply unchanged. No new browser errors. Controlled failures/invalid responses/zero/race paths passed source and exact compiled tests; no production outage or business writes induced. Legacy forecast audit DOM helper returned no rows despite a healthy panel; replaced the readback locator with exact visible metric labels, then verified all four fingerprints.
