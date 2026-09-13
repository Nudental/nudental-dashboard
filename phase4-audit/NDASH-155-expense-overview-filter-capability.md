# NDASH-155 — Combined Expense Overview filter capability

Status: CLOSED — deployed and live-verified PASS for the capability guard.

Severity: High — the Overview displays unfiltered headline amounts under selected department/category filters.

Reproduction: This Year / All Offices, Department Marketing leaves Total Expenses, Gusto Payroll Funding and AmEx fingerprints identical to the default (c833276a / cd012b3e / 4fccee96), while the category pie narrows to Payroll / Payroll Taxes / Benefit Paid. Resetting Department and selecting Category Supplies repeats the same unrelated totals and categories. Supplies was reproduced again after Reset. The settled default has 18 KPI cards and five charts.

Root cause: the combined summary includes payroll/benefit and aggregate-override sources which do not honor department/category. For example, the summary eligibility guard omits these dimensions, and Gusto fact queries apply dates/offices without department/category allocation. Fixing accounting allocations or replacing source authority is beyond a targeted presentation repair.

Small fix: an Overview-only display reason derived from appliedFilters, ahead of the existing source-load error. A non-All department/category displays an explicit limitation and correction path instead of misleading combined cards/charts. Pending edits do not hide the currently applied view. Default Overview, loading, source-error behavior, query logic, accounting, filters and other tabs are unchanged. Transaction views retain their existing filter behavior. This does not implement department/category allocation across all sources.

Eight focused cases PASS, four fail against the preceding source. Full suite 819 PASS; build PASS (33.31 seconds). The retained completeness test now recognizes the merged display-error variable and retains its original failure/loading checks; additional behavioral cases confirm original source-error propagation. Compiled applied-filter and loading/error/content selection cases PASS, with exact canonical reversal of the component changes, full reversal to NDASH-154 and seven retained modules. Rocket completed version 885.

No business-data, payroll, benefits, allocation, backend, credential, authentication, infrastructure or configuration changes. No imports, provider sync, financial actions or exports. Existing source-authority limitations remain separate; default Overview totals are preserved, not newly certified by this guard. NDASH-042 and NDASH-066 remain excluded from publication.

Release: source 37adbeb; deployment 58fab626-8706-42dd-8cc5-23679776e841; entry `/assets/index-95b1df4a16d0.js`; SHA-256 95b1df4a16d035e1df05807c229eb54d32a06de4138f7bcabc0a66e36119f9d2 (21740311 bytes). Exact live artifact, backend148 hashes, frontend/API 200 and three services PASS.

Live PASS: the default 18 cards and five charts exactly match the preserved pre-fix fingerprint set. Applied Marketing department and Supplies category each show the explicit limitation with zero Overview cards/charts. Transactions remain available under the category selection; Payroll category shows 40 visible records with matching category labels and no Overview guard. Returning to Overview remains guarded until Reset. Reset restores all default cards/charts exactly. A pending Marketing department edit without Apply retains the current valid Overview; discarding it restores default filter controls. No new browser errors. No production records or saved filters created.
