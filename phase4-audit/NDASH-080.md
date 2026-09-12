# NDASH-080 — Patient Portion minimum age does not filter results

Section: RCM / Patient Portion. Status: repaired, deployed, live verification PASS.

Reproduced on frontend079/backend076, August2026, Staten Island: minimum0 shows18 records aged15–33 days. A settled9999-day minimum still shows18, all younger than the requested minimum. A settled30-day minimum still shows18, including six younger records; only12 qualify, with displayed portion/due2340.60. Only filter actions and numeric aggregates were inspected; no business records changed.

Root cause: the frontend sends min_days_outstanding correctly, but rcm_guarantor_reconciliation uses it only for a collection-status label and metadata. The shared WHERE clause omits age.

Smallest repair: when the minimum is positive, append an inclusive service_date <= date(today, -minimum days) predicate with bound parameters to the shared WHERE. This covers full-scope scorecards, both balance-due paths, count and pagination. Zero minimum, existing date/office/zero/predetermination rules and status classification remain unchanged.

Seven actual-query-block tests use in-memory synthetic SQLite fixtures. Four failures reproduced before; all seven pass after. Eleven retained backend regression suites also pass, including office breakdown, documentation, access, aging boundaries, claims, payroll and expense guards, and adjustments. Syntax and entire-source patch reversal pass. Private backend076 snapshot retained; candidate SHA af61fa52579757bc12b5e82241029e850a5bb35c5d77698a3bcb6595a4ab391b. No credentials or full backend source committed.

Read-only release preflight PASS: current source076, frontend079, service043, startup write flags disabled, existing read-only cache warm-up unchanged, missing-key401. Counts: All207, office18, balance-dueAll181; minimum30 and9999 both incorrectly18 before. A first preflight stopped safely because it compared collection-status counters across thresholds; the existing classification intentionally depends on the threshold. Narrowing that comparison to record totals and unchanged monetary values resolves the test assumption. No running source changed during either preflight.

Deployment PASS: existing candidate8002 passed aggregate checks before live8001 restart. Both now return minimum30 Staten12/portion2340.60/due2340.60, minimum9999 zero, last/next-page boundaries correct, balance-due path correct. Zero-minimum All207/office18/balance-dueAll181 and all retained monetary/counter values unchanged. Previous office-breakdown repair and missing-key401 pass. Frontend079/configuration/business data unchanged; full backend076 rollback retained.

Live verification PASS: original30-day test12 rows, every age >=30, portion/due2340.60;9999 empty with all six scorecards zero. Restore0 gives18Staten. Refresh retains30 and12. Full reload/reopen defaults0/All,100of207 rows, all six original scorecards19325.27/9065.33/14983.08/154/18/154 and no obsolete expansion. Alerts/errors0; frontend/API200 and three existing services active. No test records created or business records modified.
