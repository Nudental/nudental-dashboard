# NDASH-050 — Expense table keeps an out-of-range page after filters change

Section: Expense Report / Transactions. Severity: Medium. Status: repaired, deployed, live verification PASS.

Reproduction: in the current capped live table, This Year / Barnegat has 358 WF Main Money-Out rows. Navigate to page eight (351–358). Change office to All Offices and Apply. It has 175 rows but remains on page eight, displays "Showing 351–175 of 175", and falsely says no records in the selected view. Loading is complete. Refresh was also requested to confirm persistence. These counts are affected separately by NDASH-049's source-query cap and are not endorsed as complete business totals.

Root: ExpenseTable stores its page independently of the rows prop; sorting and subview buttons reset page but a parent filter/refresh dataset replacement does not. Small repair: reset to page zero when rows changes. No financial data, classification, sort rules, filters, source queries, or record actions change. This also handles a new empty/smaller result without retaining a stale offset.

Refresh confirmed the same invalid range and empty-table result. Two focused tests of the actual reset callback and page slicing PASS, including a smaller dataset and empty-to-single-row replacement. All 214 retained frontend tests PASS; source production build PASS (37.64 seconds). Rocket version 781 completed. Actual production artifact, deployment, and live verification remain pending. No CSV was downloaded or business record changed. Clicking the existing WF Main Money-Out subview recovered page one afterward.


LIVE DEPLOYMENT CLOSURE — PASS; supersedes source-only status above. Reproduced again against complete049 results: All WFMain page9 showed401-450of1280; changingtoBarnegat yielded401-379of379 and0data rows. Current reproduction replaces the older capped-data numbers. Actual compiled fix adds only D.useEffect resetting page to0 on rows change; original table logic preserved. Isolated reset check, syntax, whole-entry reversal and7relinks PASS. Latest retained source221tests/build PASS.

Deployment90ecc24b-35aa-4a0a-91ef-dd0fded9ea01; /assets/index-2a9901db84c6.js; SHA2a9901db84c6f3fb604cfc870189be0ba58437d192fed224e317c5b15b59a163. Previous049 and all earlier repairs preserved;042and051 not included. LiveAllpage9thenBarnegat returns1-50of379 with50data rows; Nextworks51-100of379; ResetAllreturns1-50of1280 with50rows; refreshretains1-50of1280/defaultAll. Browsererrors0/noalerts. No exports or business-data mutations.
