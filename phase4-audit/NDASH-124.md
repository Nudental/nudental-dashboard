# NDASH-124 — Amazon order dates and month labels shift backward

Severity: Medium. Status: CLOSED — deployed and live-verified PASS.

Reproduced on122 and again on123 after fresh reload/re-entry. Amazon history129 rows show months Dec2025 x12, Jan2026 x41, Feb2026 x30, Mar2026 x28, Apr2026 x18. Read-only source date/month fields confirm Jan2026 x12 through May2026 x18. All seven distinct order dates render one day early; for example source May21 x18 renders May20. Source totals and rows are not changed.

Root cause: FrontDeskAmazonOrderHistory.jsx fmtDate parses date-only strings at UTC midnight; fmtMonth creates another UTC date from YYYY-MM. Rendering in negative UTC offsets moves the calendar day/month backward.

Smallest repair: parse date-only fields and month-only fields at local midnight, preserving real timestamp conversion and placeholders. Two formatter expressions only. No query/filter, aggregation, order status, receiving, inventory, or export behavior changes.

Read-only audit evidence before repair:129 total rows,111 Closed/17 Pending Fulfillment/1 Pending; Pending filter gives1 matching row. Independent visible line-item net-total sums agree with office/month/category summary tables. No financial values or order identities recorded. No order modification, export, receipt, or test record created.

Predeployment PASS: six focused tests (two fail before repair), all564 frontend tests, build30.16s, Rocket confirmation. Actual compiled prior functions reproduce both shifts; candidate passes four time zones/year boundary/date-only and month-only fields while retaining actual timestamp conversion and empty placeholders. Entire entry reverses to123 byte-for-byte; seven dependent modules only relink the entry. Candidate index-dbda49ac94d0.js. Deployment/live verification pending.

Release: source a451bbb; deployment609ac4ed-6574-4d65-b4d8-ca4c7c42448f; entry index-dbda49ac94d0.js SHAdbda49ac94d0cd23c3a8ae111e00b1e9597e49e2da1fd05e284f239d1bc2f816. Prior123 retained. Live after fresh reload: all129 exact date/month labels agree with source; May18, May+Brick11, Pending1; search unmatched empty; Clear Filters restores129. All three financial summary totals still match detail lines. History123 June4/July1 remains correct. New errors0; frontend/API200,3services active,backend113 unchanged. No business-data changes or temporary records.
