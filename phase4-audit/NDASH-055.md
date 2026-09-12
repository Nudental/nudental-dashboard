# NDASH-055 — Expense category pie adds Banking expenses twice

Section: Expense Report / Overview / Expense by Category. Status: tested candidate; deployment/live verification pending.

Reproduced on054 with ThisYear/AllOffices/sourceWFMainMoneyOut. Pie shows actual categories (Health Insurance15%,RentAndUtilities12%,etc.) plus a synthetic WF Direct Operating Expense50% segment. The WF KPI shows279741. The category service already includes classified Banking rows; ExpenseCharts appends the same bank total again unless a category name happens to contain a banking phrase. This doubles the bank representation and distorts percentages.

Small fix: remove the appended synthetic bank segment from ExpenseCharts.jsx and use the existing categoryData. Preserve actual category values/order/name formatting/top10 behavior, every other chart, KPI, financial classification and record. No writes or provider/configuration changes.

Verification:249 source tests PASS; source build33.14s PASS. Exact compiled render test reproduces old100→200 and verifies repaired100→100; mixed and genuinely WF-named categories stay intact, empty data adds no synthetic slice, other chart datasets unchanged. Full reversal to054, seven dependency relinks and all054functions preserved PASS. Rocket786complete.
