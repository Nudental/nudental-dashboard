# NDASH-025 — Gusto classified every payroll run as regular

- Section: Payroll / Imported from Gusto / Overview. Severity: Medium.
- Reproduced live in current year, 2025, and All Time: Off-Cycle remains 0 and Regular equals every run. Imported API/database flags instead show 2/20, 7/33, and 35/157 off-cycle runs respectively.
- Root cause: Overview passes literal `offCycleCount={0}` to the chart; the summary hook never derives the count.
- Smallest fix: derive count from `off_cycle === true` on the selected runs and pass that KPI to the existing chart. Two lines/two existing files. Existing regular count subtraction, total counts and financial calculations retained.
- Tests: two new isolated scenarios fail before fix, 82 retained tests PASS after fix. Production source build PASS (31.42s); three actual artifact calculation/caller cases, syntax, and exact reversal PASS.
- Deployment 1897b8c2-1dad-406d-aa07-ff6c1c4ecfc2, asset index-1fbf04540dba.js, SHA256 1fbf04540dba4a92812c317f0d5e5de4d224c9c77acd5819de7682813a7be076. Prior024 release preserved.
- Live PASS: 2026 YTD shows Regular18 / Off-Cycle2; 2025 shows26 /7; All Time shows122 /35. Total run counts and period labels remain correct.
- No payroll records, settings, credentials, or integration actions changed.
