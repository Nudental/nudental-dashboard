# NDASH-056 — Incomplete AmEx summaries ignore the source filter

Section: Expense Report / Overview. Status: candidate verified; deployment and live checks pending.

Reproduced on release 055: This Year / All Offices / WF Main Money-Out still shows eight positive bars in both AmEx summaries. The two services ignore requested sourceTypes. Their unpaginated query returns 1,000 of 1,703 non-archived AmEx records (1,565 posted and 138 draft), silently omitting later rows.

Small fix: fetchAmexByCardholder and fetchAmexByMerchant intersect the selected sources with the two existing AmEx sources, return an empty result without querying when excluded, and use the retained complete-query reader with exact counts and stable date/id ordering. Query errors propagate. ExpenseReport clears stale AmEx arrays and includes both services in its existing overview error guard. Existing status predicate, signed amounts, grouping, office/card mapping, and top-20/top-8 presentation remain unchanged. Draft accounting is not reinterpreted.

Files: recovered-frontend/src/services/expenseReportService.js and recovered-frontend/src/pages/financial-analytics/ExpenseReport.jsx. Exact release patch changes only snt, cnt, the existing parent component, and seven dependency references; prior graphs are retained.

Verification: 257 source tests PASS; production build PASS (25.96 seconds). Actual compiled-function tests PASS for excluded/selected sources, 1,703-row completeness, signed totals, late high-value merchant, unchanged status/office/date filters, six-source error guards, prior repairs, full reversal to 055, and seven dependency relinks. Rocket version 787 complete. No financial records, imports, sync, exports, credentials, or configuration changed.

Candidate: index-5d52ea3f49d4.js, SHA256 5d52ea3f49d48dd7f08aafb0da73ae6546f267a488290833da6fe8ddc3e1b570. Deployment requires existing live 055 ID 0fef19b3-a998-4ec8-b916-5ae26424bfd6.
