# NDASH-052 — Expense Admin Tools hides records beyond the first page

Section: Expense Report / Admin Tools / Unmatched Records and Sync Logs. Status: candidate verified; deployment and live verification pending.

Reproduced on release051 before editing: Unmatched Records renders100 rows and claims100 missing assignments, although the exact source HEAD count is15,077. Sync Logs renders20 rows although578 exist. Neither has page controls. Import Log0 and Needs Review55 agree with exact source counts. No record content was copied into evidence.

Root cause: fetchUnmatchedExpenses uses limit100; fetchAmexSyncLogs uses limit20. AdminAuditTools treats array length as the total and has no pagination or query error display.

Small repair: add fetchExpenseAuditPage in expenseReportService.js; bounded100/20-row pages, exact counts, stable date/id ordering, original predicates and only rendered fields plus id. Reject query errors, missing/invalid counts, duplicate/missing ids, and incomplete pages. AdminAuditTools.jsx shows exact totals, Previous/Next, retryable errors, resets on view change and missing last page, and ignores superseded results. Legacy helper interfaces, Import Log and Needs Review behavior remain. No data writes, import/sync execution, credentials, permissions, deployment configuration, payroll dates, or accounting changes.

Verification:10 focused synthetic tests; all231 source tests PASS; production source build PASS26.50s. Actual compiled component tests PASS: first/middle/last/empty pages,15077/578 totals, bounded query scope/order, error and identity validation, paging buttons, loading/retry, late response protection and disappearing last page. Full artifact reversal to051 and seven dependency relinks PASS;049/050/051 components byte-identical. Rocket version783 completed. Only this component changes in the actual production artifact.
