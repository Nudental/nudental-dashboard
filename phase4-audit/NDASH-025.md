# NDASH-025 — Gusto classified every payroll run as regular

- Section: Payroll / Imported from Gusto / Overview. Severity: Medium.
- Reproduced live in current year, 2025, and All Time: Off-Cycle remains 0 and Regular equals every run. Imported API/database flags instead show 2/20, 7/33, and 35/157 off-cycle runs respectively.
- Root cause: Overview passes literal `offCycleCount={0}` to the chart; the summary hook never derives the count.
- Smallest fix: derive count from `off_cycle === true` on the selected runs and pass that KPI to the existing chart. Two lines/two existing files. Existing regular count subtraction, total counts and financial calculations retained.
- Tests: two new isolated scenarios fail before fix, 82 retained tests PASS after fix. Production build, actual artifact regression, deployment and live verification pending.
- No payroll records, settings, credentials, or integration actions changed.
