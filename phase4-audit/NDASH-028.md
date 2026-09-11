# NDASH-028 — Imported payroll run filters and order were ignored

- Section: Payroll / Imported from Gusto / Payroll Runs and Overview Next Payroll. Severity: High.
- Reproduced live: Off-Cycle selected still shows20 runs, while imported flags identify2. Read-only API checks also return20 for Regular (expected18), Reversed (expected0), and nonexistent Run By (expected0). Ascending sort with limit1 returns the latest rather than earliest check date.
- Root cause: existing payroll_runs handler accepts date bounds and pagination only, ignoring the UI's off_cycle/status/run_by_user_name/sort parameters. The Overview's next-payroll query depends on the same ignored ascending order.
- Smallest fix: accept these existing read parameters and apply flag/name filters and requested ascending check-date order before counting/pagination. Preserve default descending order, date bounds, source fields, response shape, and existing authentication.
- One handler patch, no frontend changes. Private baseline/candidate retained in server audit cache ndash028-backend. Before hash bc0394cbade810ee723c9ed09684168c598ac5a21c39936274026d4accfed9a6; candidate8c769b4cc140fcf2e35e6969143f23fcd3ae57c5f608fceac41d6901229e04ba.
- Actual-handler synthetic tests: baseline5/16 PASS, candidate16/16 PASS; retained employee tests16/16 and expense guards21/21 PASS. Includes combined filters, filtered pagination, preserved dates/default order, and nearest future selection. No production application startup during tests. Deployment/live verification pending.
- No future imported check date currently exists, so next-payroll positive ordering is verified synthetically and against historical ascending queries; do not manufacture future payroll data.
