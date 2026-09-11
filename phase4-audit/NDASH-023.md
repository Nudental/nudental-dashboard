# NDASH-023 — Incomplete dates and late responses left payroll figures in the wrong view

- Section: Payroll. Severity: High.
- Reproduced twice live after022: selecting Custom Date Range with both inputs blank leaves the previous run's financial tables visible with blank date headers. Isolated tests also prove partially empty date requests and superseded responses can populate the wrong view.
- Root cause: the load callback returns early without clearing prior results when the active date range is missing, checks only the range object's existence, and applies every response without checking whether its selection is still current.
- Fix: clear previous view results at each load; require both dates before requesting data; prompt for a valid run/custom dates; use a per-component generation guard for result/error/loading completion and invalidate it on cleanup. Existing empty-row export disabling now protects incomplete selections. One page changed; existing actual deployed date arguments/offset implementation and financial values are preserved.
- Tests: four isolated pre-fix cases FAIL as expected; 75 frontend tests PASS after repair; source build PASS (29.03s); actual deployed callback tests cover incomplete dates, stale responses, latest results and unchanged date arguments; syntax/reversal PASS.
- Candidate `index-3e2ee1f23906.js`, SHA256 `3e2ee1f2390644422963c769462cd30fd5331569841802333ca014e2269ce3c8`. Previous `ndash022-dist` preserved. Deployment/live verification pending. No business data or configuration changed.
