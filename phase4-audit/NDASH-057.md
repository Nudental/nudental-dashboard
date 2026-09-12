# NDASH-057 — Monthly expense trend ignores merchant and cardholder searches

Section: Expense Report / Overview. Status: candidate verified; deployment/live checks pending.

Reproduced twice on release 056 using This Year / All Offices / AmEx API. A synthetic no-match merchant search clears the category, location, and AmEx summaries, but the trend retains nine positive bars. Clearing merchant and applying the same no-match cardholder search reproduces nine positive bars with no AmEx matches. No test records were created.

Root cause: ExpenseReport does not pass merchantName/cardholderName to fetchMonthlyExpenseTrend. That service also omits both parameters from its input and fetchExpenseRecords call. Small fix: six parameter pass-through lines in those two files. Existing accounting, Gusto behavior, complete/posted queries, source/date/office/category/department/status filters remain unchanged. Broader Gusto filter consistency is outside this verified repair.

Verification: 264 source tests PASS; production build PASS (26.98 seconds). Actual compiled tests reproduce the old failure and verify positive/empty/combined searches, unchanged unfiltered totals, twelve month buckets, applied parent parameters, prior repairs, full reversal to 056, and seven dependency-only relinks. Rocket version 788 completed. No financial writes, sync, imports, exports, or configuration changes.

Release candidate: index-e5d2815c56ac.js. Expected current deployment: d387d823-9cca-490c-b915-cd70dd1b38bb. Prior 056 graph will remain recoverable.
