# Expense Report audit coverage

Audit remains in progress. Browser actions were read-only; no financial records, allocations, classifications, payments, imports, provider synchronization, or exports were created or changed.

Overview This Year / All Offices displayed Total Expenses 2,147,175, Gusto Payroll Funding 1,180,881, Health Benefits 11,300, AmEx / Corporate Card 364,706, and WF Direct Operating Expense 590,287 (rounded). These are observations, not an independent source-total PASS. Default query/apply/reset controls work. Missing custom-date validation is NDASH-048, now source-tested. Other KPI/chart source-completeness and allocation questions remain open.

Transactions: source truncation is NDASH-049; pagination after dataset change is NDASH-050. Both have tested source candidates, not live fixes. Existing All Offices capped view shows 704 loaded records; Barnegat independently shows 824 due to per-query caps/scopes. Neither number is endorsed as the complete total. Sort/view controls reset pages; parent filter changes did not. No CSV downloaded.

AmEx Detail: 1,000 displayed posted rows versus exact source/API count 1,565 is NDASH-051. API/source scope comparison and net-spend aggregate were verified without exposing transaction bodies. Overview and posted-ledger totals use different paths; they were not forced to match. Primary API parameter/response-shape mismatch is documented; current UI uses a fallback. Draft and cardholder/merchant chart completeness still require review.

AmEx Payments: This Year 2026 defaults show 18 unique groups, 16 duplicate-group members, and deduplicated non-void total 438,313.07. Independent server computation using only the bounded grouping fields from 26 rows matches all three; no payment details were displayed or saved. All Raw view paginates 1–25 then 26–26 of 26. Duplicate Review shows 16 rows. Void status returns no payments, matching zero source rows; Reset restores defaults and Deduplicated Payments view. Add/edit/payment persistence intentionally not exercised on live financial records. No records were deleted by duplicate review.

Import: screen opens; API connector is explicitly Pending Credentials, scheduled/manual sync Awaiting credentials, duplicate detection/sync logs Planned / Not Active. No file was imported and no provider was configured. Import/normalization execution remains intentionally untested against production financial data. Admin Tools read-only subview coverage is underway.
