# NDASH-049 — Expense transaction table silently truncates both source queries

Section: Expense Report / Transactions. Severity: High. Status: reproduced live and after refresh; targeted source candidate prepared; full verification and deployment pending.

Live This Year / All Offices loads 704 records, including 175 in the default WF Main Money-Out view, 117 Corporate / Shared, and 412 Transfers / Reconciliation. Refresh repeats 704. Exact count-only source checks for 2026-01-01 through 2026-09-11, non-archived status, find 4,539 non-Banking rows and 2,107 Banking rows. These are raw query counts before the existing main-source exclusion predicate, not the claimed final eligible-row total. Banking alone exceeds the entire loaded table. No transaction bodies or CSV files were extracted for this comparison.

Root: fetchExpenseRecords applies a default 500-row main range and an independent Banking limit of 500. It merges only those partial results; the table's local pagination/export cannot reach omitted rows. Query failures can silently publish only the other source's records.

Small repair: add opt-in complete mode, used only by ExpenseReport's transaction-table request. It reads both existing scopes in stable date/ID order through exact-count pages, checks missing/changing counts, duplicate IDs, incomplete responses, query failures, and a 50,000-row safety bound per source. Existing exclusion, normalization, deduplication, and source predicates are preserved. Every KPI/category/office/trend caller keeps its original mode; their separate completeness concerns remain open and are not claimed fixed.

UI clears old transaction data while fetching; a failed source displays an error instead of a partial table. Parent/table exports are guarded for loading, incomplete, and empty results. Superseded effect results are ignored so an older multi-page request cannot replace the current scope. No production data writes, classification edits, allocation changes, or provider sync.

Validation: 14 focused tests PASS, including actual service query construction/exclusions, 2,107 synthetic Banking rows, lower server page caps, partial/failure/duplicate safeguards, parent/table export guards, default KPI mode preservation, and superseded loads. All 212 retained frontend tests PASS. Source production build PASS (38.98 seconds); diff check PASS. Rocket is implementing the same scope after version 779. Actual production artifact, deployment, and live verification remain pending.
