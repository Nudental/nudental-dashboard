# NDASH-137 — Comparison and Forecast turn failed reads into zero financial totals

Severity: High. Status: reproduced; repair under verification.

Controlled reproduction executed the exact released136 compiled Comparison and Forecast effects, with healthy responses as controls followed by rejected financial requests. Both emitted netProduction0, errornull and no cleanup function after failure. No live outage was induced. Source confirmed six catch-to-null expressions feeding nullish zero defaults, with no request cleanup to prevent older selections overwriting current values.

Targeted correction in ChartVisualization.jsx only: let financial errors reach the existing error UI, require finite report fields (including detailed Comparison fields), clear prior records at selection changes, and gate post-request data/error/loading updates with effect cleanup. Preserve verified zeroes, existing field aliases, signed amounts, date windows and all comparison/forecast formulas. No API/source configuration or business-data changes.

Tests/build/Rocket/deployment/live verification pending.

Pre-release: 671 frontend tests PASS, including15new availability/formula/race tests. Retained office-scope fixture now loads the actual new validator. Production build38.50s; Rocket866 one-file correction/build PASS. Actual compiled failure/race/formula tests PASS; three scoped regions plus seven dependency relinks, full reversal136 and unchanged prior modules PASS.
