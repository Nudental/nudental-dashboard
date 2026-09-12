# NDASH-072 — Command Center patient-portion options are ignored

Section: RCM Dashboard / Patient Portion Reconciliation. Severity: Medium. Status: tested; deployment pending.

Reproduced twice in the live All Offices August view: due amount14,983.08 / actionable154 / actual patient paid9,065.33. The caller visibly intends only_balance_due=true and page_size=1, but passes backend-style names to a service that accepts camelCase. The service silently uses onlyBalanceDue=false and pageSize=100. The current request has207 rows; the intended balance-due request has181, the same due amount/actionable count, and actual patient paid2,944.41. Staten Island is an unaffected control:18 rows / due2,457.50 / paid0 for both inputs.

Exact root cause: five option names in loadPortion do not match fetchGuarantorReconciliation's existing signature. Smallest scope: rename only those keys to minDaysOutstanding, onlyBalanceDue, excludeZeroPortion, includePredeterminations and pageSize. All values, date/office/page, service, financial calculations and business records remain unchanged.

Tests: actual source caller through the actual service with a stubbed fetch reproduces2 failures before and passes4 after (only_balance_due, one-row scorecard request, dates/office, existing exclusions). Full319 frontend tests and production source build43.19s PASS. Exact compiled caller193bytes and extracted existing service URL builder339bytes show omitted balance-due/page100 before and true/page1 after. Other query parameters match exactly. Full reversal to071, prior repairs, seven dependency relinks and parser checks PASS. Rocket800 matches the five names.

Candidate: index-7fcf30a7804f.js, based on live5657233a-defd-4e55-a484-bcfb5c8b1224. Blocked042/066 remain excluded. No full recovered build is released. Backend070 must remain dec9768c7d981725d965c1c0fff6f47de8ec8c10ca41fd2ef14a80434a6a0f4a. Verify All paid2,944.41 (UI rounded2,944), due14,983.08/actionable154; Staten unchanged; refresh and earlier Adjustment repairs.
