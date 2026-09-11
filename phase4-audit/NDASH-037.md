# NDASH-037 — Time Off Balances year selector does not filter

Status: repaired and tested; deployment pending. Severity: Medium.

Reproduction: default2026 shows17 employee groups/34 balance records. Select2025: the active year changes but the same17 groups/34 records remain, and CSV Export remains enabled. Safe metadata-only source read found all34 snapshot_date values equal2026-04-18. No employee fields, balance amounts or notes were retrieved in that query. No real CSV exported.

Root cause: year affects button styling only. Grouping and CSV both consume the full data array. The parent section title also hardcodes the current year while the child has its own year selector.

Repair: GustoTimeOffBalances.jsx filters existing snapshots by snapshot_date year for both grouping and CSV, retains all legitimate snapshots within that year, keeps the chooser visible for empty years, disables/guards empty exports, and shows snapshot dates with records/export. GustoTimeAndAttendance.jsx removes the contradictory fixed year from the parent title. No balance calculations, deduplication, source data, import, configuration or payroll date-rule changes.

Verification: 131 retained source tests PASS, including six snapshot-year cases; production build PASS in 35.90s. Four isolated actual-module balance scenarios PASS, including historical snapshots, dates, and empty export guards; six retained actual-module attendance filter cases PASS. No business requests from these tests. Actual artifact syntax and scoped reversal PASS. Rocket version 769 contains the two component changes.
