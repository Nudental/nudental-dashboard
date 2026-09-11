# NDASH-041 — Trend ignores selected ending date

Status: repaired, deployed and live verified PASS. Severity: Medium.

After040, default applied rangeJan1–Dec31,2026 shows subtitle Trailing12-Month Trend Ending2026-12-31, but axisOct25–Sep26. ApplyJan1–Jun30,2026: subtitle changes toJun30 while the same Oct25–Sep26 points remain, including later months.

Root cause: parent calls getLastNMonths(12), anchored to today, and its loading effect does not depend on the applied ending date. Monthly queries also always use full month ends.

Scope: build12 calendar-month slices ending at the chosen date, clip the final month to that date, refresh when it changes, display loading and prevent a superseded response from restoring an older window. Preserve all office logic and metric formulas. The start date continues to scope the pivot/statistics; the trend is explicitly trailing12 months ending at the applied end date.

Source changes limited to financial-analytics/index.jsx and ChartVisualization.jsx. Seven focused window/request tests PASS,153 retained frontend tests PASS, source build PASS37.56s. Three actual-effect scenarios confirm36 synthetic requests useJul1,2025–Jun15,2026, preserve existing metric mapping, reject superseded completion, and make no requests for invalid dates. No business requests from tests. Five scoped production-main regions and syntax PASS; complete previous graph preserved. Rocket version773 completed the same source correction.

Local release preparation caught two string-patch issues before staging: nonunique short minified names now use bounded nonoverlapping context; literal dollar sequences in existing chart template strings now use replacement callbacks in the graph helper. Exact forward/reverse verification passes. No failed candidate was deployed.

BLOCKED-DEPLOY-041: automatic approval review rejected upload of compiled public browser assets and a patch manifest to existing yadon-abem-01 (137.184.165.120), saying payload/destination were not specifically authorized. Same server was verified read-only during040 and that retry/deployment was approved;041 rejection recurred. Candidate main index-7efd1b9c85f2.js and manifest remain local. No041 upload or production change occurred. Needed: explicit destination approval for this reviewed repair. Continue all unblocked read-only audit work meanwhile.

Blocker resolved: user explicitly answered “Approve the existing deployment path” for NDASH-041 compiled files/manifest to yadon-abem-01 (137.184.165.120) and release through the existing nudashboard.com process. Resume the preserved candidate (source commitb608635). No further permission needed for this authorized action.

Deployment: 5ea436c2-b94c-4085-93e1-7c9f0fd0e171. Live main index-7efd1b9c85f2.js, SHA256 7efd1b9c85f2677e84a5605cc996ee2c84421f488de74733925dabfd04247ec2. Rollback ndash040-dist retained. No backend/configuration/business-data changes.

Live verification PASS: refreshed page loads new main; default end2026-12-31 yieldsJan–Dec2026 axis. Applied end2026-06-30 yieldsJul2025–Jun2026 and matching subtitle, no later months. Both line/bar retain exactly Net Production and Total Collections; bar count2; pivot retains5office rows; no browser errors. Restored Line. Browser click initially selectedOctober; keyboard month/day activation confirmedJune30 before the successful original test. Partial-month clipping and stale completion remain covered by actual-artifact synthetic tests, not claimed as captured live network evidence.
