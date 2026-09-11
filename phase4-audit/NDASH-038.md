# NDASH-038 — Hours Summary scope label and empty export

Status: repaired and tested; deployment pending. Severity: Low.

Reproduction after037: Hours Summary2026 shows11 rows. Choose2025: empty message correctly says2025, but the parent heading still says2026 and CSV export remains enabled. No real employee-hours CSV was downloaded.

Root cause: the parent uses its own currentYear for the heading although the child has an independent selector. Export always appends a TOTAL row, even when the selected year has no records, and has no disabled or handler guard.

Scope: remove the contradictory fixed year from the parent heading and disable/guard empty exports. Keep query, year selection, populated export, totals and all business data unchanged.

Changed GustoHoursSummary.jsx and GustoTimeAndAttendance.jsx only. Four export tests reproduced two failures before the change and all pass afterward. Full retained suite135 PASS; source build PASS38.81s. Actual release module: two empty/populated export scenarios and six retained attendance filter scenarios PASS, with no business requests. Three scoped artifact regions, syntax and dependency checks PASS. Rocket version770 completed the same edit.
