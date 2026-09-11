# NDASH-003 — Monthly Growth office selector does not filter rows or totals

Reproduced September 11, 2026 after NDASH-002. August 2026 selected first Barnegat, then Brick; both views retained all four offices and the all-office group total. Only the historical trend request received the selected office.

Root cause: MonthlyGrowthTab called fetchMonthlyGrowth with month/year only. Its service fetched every active office and aggregated them without an office argument.

Fix: pass officeFilter into that request; the service accepts an optional default-all argument and filters the office list before both current/prior data requests and their existing calculations. Rows, leaderboard, table/chart and CSV totals use the scoped result. Existing callers omitting the argument retain their behavior. No data writes or business-rule changes.

Tests: single office, all offices, unknown office and legacy fallback; three fail before, all four pass after. All 13 cumulative regression tests pass. Actual candidate production service separately passes three synthetic cases, and bundle syntax passes. Reversing the two artifact edits exactly recovers the preceding deployed bundle.

Candidate asset: index-3c8881fa50ca.js.
SHA256: 3c8881fa50caaf895f0abee0a5e4344c89c2921f5737e830d31a1b87c9e228e1.
Previous deployment: ae03daae-5835-49e4-9777-425de5d5422e.
Rollback directory: /home/openclaw/.cache/nudashboard-audit-20260910/ndash002-dist.

Build PASS in 32.34 seconds. Deployment fed81b66-df3d-4257-8116-ccbc8587fddf succeeded. Live verification PASS: Barnegat and Brick each show only their own row, leaderboard/chart and scoped total; All Offices restores four rows and combined total. NDASH-001/002 retained. CSV action had no visible error, but file-save confirmation is still pending. The separate legacy monthly-data discrepancy remains under investigation.
