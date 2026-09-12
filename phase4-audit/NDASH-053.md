# NDASH-053 — Transfer audit totals and classifications use capped input rows

Section: Expense Report / V292 Transfer Audit. Status: tested candidate; live verification pending.

Reproduced on052 before editing. For Last Month/This Year/Last12Months, Query A shows184/200/200 versus exact HEAD counts184/1296/1775; Query B85/200/200 versus85/808/1142. C shows269/500 for Last Month/This Year versus269/2104; D269/1000 versus269/2104. Date scopes match the displayed August2026, Jan1–Sep12 and Sep1,2025–Sep12,2026. HEAD checks returned counts only; no source records copied to evidence.

Root: hard query limits200/200/500/2000 with a server1000-row cap; candidate filtering, top20 ranking and classification sums then run on partial inputs labeled as totals.

Repair only V292AuditPanel.jsx. Use existing exported readCompleteExpenseQuery with500-row bounded pages, exact count, stable expense_date/id ordering, duplicate/count/error safeguards. Original account/date/status/keyword/classification predicates and fields stay unchanged. Paginate A/B candidate details50rows per period with exact counts and Previous/Next; retain C top20 and D classification summary. Generation guards suppress late results, retry clears error/detail pages, unmount invalidates old requests. No business data/classification writes or provider/import/sync/configuration changes. The historical source comment forbidding patches is superseded by the user's explicit verified-defect repair authorization; the panel remains read-only.

Verification:5 new source tests and all236 regression tests PASS; production source build PASS30.89s. Exact artifact tests PASS for all four complete queries, preserved predicates, bounded reads, beyond-cap top20 and totals, first/middle/last/back detail pages, error/retry and superseded responses. Full reversal to052 and seven dependency relinks PASS; Admin052 unchanged. Rocket784 completed. Actual artifact changes only this component; all earlier classifiers and payroll code remain byte-identical outside it.
