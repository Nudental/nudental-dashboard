# NDASH-037 — Time Off Balances year selector does not filter

Status: deployed; live PASS. Severity: Medium.

Reproduction: default2026 shows17 employee groups/34 balance records. Select2025: the active year changes but the same17 groups/34 records remain, and CSV Export remains enabled. Safe metadata-only source read found all34 snapshot_date values equal2026-04-18. No employee fields, balance amounts or notes were retrieved in that query. No real CSV exported.

Root cause: year affects button styling only. Grouping and CSV both consume the full data array. The parent section title also hardcodes the current year while the child has its own year selector.

Repair: GustoTimeOffBalances.jsx filters existing snapshots by snapshot_date year for both grouping and CSV, retains all legitimate snapshots within that year, keeps the chooser visible for empty years, disables/guards empty exports, and shows snapshot dates with records/export. GustoTimeAndAttendance.jsx removes the contradictory fixed year from the parent title. No balance calculations, deduplication, source data, import, configuration or payroll date-rule changes.

Verification: 131 retained source tests PASS, including six snapshot-year cases; production build PASS in 35.90s. Four isolated actual-module balance scenarios PASS, including historical snapshots, dates, and empty export guards; six retained actual-module attendance filter cases PASS. No business requests from these tests. Actual artifact syntax and scoped reversal PASS. Rocket version 769 contains the two component changes.

Deployment: 62059406-9031-4586-a4a9-636d6c30a691 succeeded. Main /assets/index-723f9e45ec66.js; SHA256 723f9e45ec66f68096657b8b9176105da690f14b6b0e541ea1a435f9656342f2. Private ndash037-dist retains the complete previous graph. Code commit 442441d.

Live after refresh: default 2026 has17 groups/34 records and enabled export; selecting2025 has0 groups, the year-specific empty message, and disabled export. Returning2026 restores17 groups; expanded rows show Snapshot Date Apr18,2026. Retained attendance has1353 rows; employee filtering gives34 matching rows with all15 choices retained. Default filter restored. Browser error list empty. PASS. No real balance CSV downloaded and no business record changed.
