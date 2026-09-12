# NDASH-057 — Monthly expense trend ignores merchant and cardholder searches

Section: Expense Report / Overview. Status: repaired, deployed, live verification PASS.

Severity: High — financial trend ignores selected search scope.

Reproduced twice on release 056 using This Year / All Offices / AmEx API. A synthetic no-match merchant search clears the category, location, and AmEx summaries, but the trend retains nine positive bars. Clearing merchant and applying the same no-match cardholder search reproduces nine positive bars with no AmEx matches. No test records were created.

Root cause: ExpenseReport does not pass merchantName/cardholderName to fetchMonthlyExpenseTrend. That service also omits both parameters from its input and fetchExpenseRecords call. Small fix: six parameter pass-through lines in those two files. Existing accounting, Gusto behavior, complete/posted queries, source/date/office/category/department/status filters remain unchanged. Broader Gusto filter consistency is outside this verified repair.

Verification: 264 source tests PASS; production build PASS (26.98 seconds). Actual compiled tests reproduce the old failure and verify positive/empty/combined searches, unchanged unfiltered totals, twelve month buckets, applied parent parameters, prior repairs, full reversal to 056, and seven dependency-only relinks. Rocket version 788 completed. No financial writes, sync, imports, exports, or configuration changes.

Release candidate: index-e5d2815c56ac.js. Expected current deployment: d387d823-9cca-490c-b915-cd70dd1b38bb. Prior 056 graph will remain recoverable.

Live closure: deployment 5a830349-02a8-4c78-9ffe-96aeb31f07ef; asset SHA256 e5d2815c56ac05eeaddffe530fc207102e23d82c9f1792e6dca02d59432ad385. AmEx API no-match merchant and cardholder tests each now show zero positive bars. Clearing searches restores nine monthly trend bars and all five charts. WF-only no-match merchant also yields zero bars. Refresh restores empty searches and All Sources with five charts, no alerts and no browser errors. Prior 056 remains recoverable. No business writes or exports.
