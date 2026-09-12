# Expense Report audit coverage

Audit remains in progress. Browser actions were read-only; no financial records, allocations, classifications, payments, imports, provider synchronization, or exports were created or changed.

Overview This Year / All Offices displayed Total Expenses 2,147,175, Gusto Payroll Funding 1,180,881, Health Benefits 11,300, AmEx / Corporate Card 364,706, and WF Direct Operating Expense 590,287 (rounded). These are observations, not an independent source-total PASS. Default query/apply/reset controls work. Missing custom-date validation is NDASH-048, now source-tested. Other KPI/chart source-completeness and allocation questions remain open.

Transactions: NDASH-049/050 deployed/liveverified. All Offices3926complete rows and Barnegat976 match exact source counts. Parent filter changes reset pagination; empty/loading exports are blocked; refresh persists. No CSV downloaded.

AmEx Detail: NDASH-051 deployed/liveverified.1565posted/15cards/net512198.77source; UI512199rounded. Barnegat271; empty/loading/export/refresh PASS. API/source scope comparison and net-spend aggregate verified without transaction bodies. Overview and posted-ledger totals use different paths; they were not forced to match. Primary API parameter/response-shape mismatch remains documented; current fallback now reads all rows. Draft and cardholder/merchant chart completeness still require review.

AmEx Payments: This Year 2026 defaults show 18 unique groups, 16 duplicate-group members, and deduplicated non-void total 438,313.07. Independent server computation using only the bounded grouping fields from 26 rows matches all three; no payment details were displayed or saved. All Raw view paginates 1–25 then 26–26 of 26. Duplicate Review shows 16 rows. Void status returns no payments, matching zero source rows; Reset restores defaults and Deduplicated Payments view. Add/edit/payment persistence intentionally not exercised on live financial records. No records were deleted by duplicate review.

Import: screen opens; API connector is explicitly Pending Credentials, scheduled/manual sync Awaiting credentials, duplicate detection/sync logs Planned / Not Active. No file was imported and no provider was configured. Import/normalization execution remains intentionally untested against production financial data. Admin Tools read-only subview coverage is underway.

Admin Tools: NDASH-052 deployed/liveverified. Unmatched15077/page100 and Sync578/page20 match exact HEAD counts. First/second/Previous/stable order/reset/rapid view switching/refresh PASS. Import0 and Review55 unchanged. Last/empty/error cases tested synthetically; no production records changed.

V292 Transfer Audit: NDASH-053 deployed/liveverified. All period totals match exact HEAD counts: A184/1296/1775,B85/808/1142,C269/2104,D269/2104. A/B candidate detail pages50rows, final-page3/7rows, Previous/Next/independent periods/refresh PASS. C top20 and D classifications retain existing predicates. No financial classification changes. Source-failure and stale-response handling tested synthetically.

Remaining active Overview investigation: bank-only source filter shows72871rounded from capped500-row data. Exact complete posted bank aggregate comparison is underway. Payroll and employee Benefits queries are excluded from this focused comparison; do not retry the earlier rejected employee-data query. Overview KPI/chart completeness and filter behavior are not yet fully verified.
