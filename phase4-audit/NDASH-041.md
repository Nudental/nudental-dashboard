# NDASH-041 — Trend ignores selected ending date

Status: repaired and tested; deployment temporarily blocked by automatic approval review. Severity: Medium.

After040, default applied rangeJan1–Dec31,2026 shows subtitle Trailing12-Month Trend Ending2026-12-31, but axisOct25–Sep26. ApplyJan1–Jun30,2026: subtitle changes toJun30 while the same Oct25–Sep26 points remain, including later months.

Root cause: parent calls getLastNMonths(12), anchored to today, and its loading effect does not depend on the applied ending date. Monthly queries also always use full month ends.

Scope: build12 calendar-month slices ending at the chosen date, clip the final month to that date, refresh when it changes, display loading and prevent a superseded response from restoring an older window. Preserve all office logic and metric formulas. The start date continues to scope the pivot/statistics; the trend is explicitly trailing12 months ending at the applied end date.

Source changes limited to financial-analytics/index.jsx and ChartVisualization.jsx. Seven focused window/request tests PASS,153 retained frontend tests PASS, source build PASS37.56s. Three actual-effect scenarios confirm36 synthetic requests useJul1,2025–Jun15,2026, preserve existing metric mapping, reject superseded completion, and make no requests for invalid dates. No business requests from tests. Five scoped production-main regions and syntax PASS; complete previous graph preserved. Rocket version773 completed the same source correction.

Local release preparation caught two string-patch issues before staging: nonunique short minified names now use bounded nonoverlapping context; literal dollar sequences in existing chart template strings now use replacement callbacks in the graph helper. Exact forward/reverse verification passes. No failed candidate was deployed.

BLOCKED-DEPLOY-041: automatic approval review rejected upload of compiled public browser assets and a patch manifest to existing yadon-abem-01 (137.184.165.120), saying payload/destination were not specifically authorized. Same server was verified read-only during040 and that retry/deployment was approved;041 rejection recurred. Candidate main index-7efd1b9c85f2.js and manifest remain local. No041 upload or production change occurred. Needed: explicit destination approval for this reviewed repair. Continue all unblocked read-only audit work meanwhile.
