# NDASH-050 — Expense table keeps an out-of-range page after filters change

Section: Expense Report / Transactions. Severity: Medium. Status: reproduced live; source repair tested; deployment and live verification pending.

Reproduction: in the current capped live table, This Year / Barnegat has 358 WF Main Money-Out rows. Navigate to page eight (351–358). Change office to All Offices and Apply. It has 175 rows but remains on page eight, displays "Showing 351–175 of 175", and falsely says no records in the selected view. Loading is complete. Refresh was also requested to confirm persistence. These counts are affected separately by NDASH-049's source-query cap and are not endorsed as complete business totals.

Root: ExpenseTable stores its page independently of the rows prop; sorting and subview buttons reset page but a parent filter/refresh dataset replacement does not. Small repair: reset to page zero when rows changes. No financial data, classification, sort rules, filters, source queries, or record actions change. This also handles a new empty/smaller result without retaining a stale offset.

Refresh confirmed the same invalid range and empty-table result. Two focused tests of the actual reset callback and page slicing PASS, including a smaller dataset and empty-to-single-row replacement. All 214 retained frontend tests PASS; source production build PASS (37.64 seconds). Rocket request submitted after version 780 completed. Actual production artifact, deployment, and live verification remain pending. No CSV was downloaded or business record changed. Clicking the existing WF Main Money-Out subview recovered page one afterward.
