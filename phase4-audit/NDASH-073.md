# NDASH-073 — AR Aging sorting duplicates a visible row

Section: RCM / AR Aging claim follow-up. Severity: Medium. Status: repaired, deployed, live verification PASS.

Reproduction: on NDASH-072, All Offices / August, the detail table initially renders 30 rows of 111 records. Sorting Balance grows the page to 31 rows; reversing the sort leaves 31 and violates descending order. A fresh reload reproduces 30 -> 31 again before editing.

Root cause: normalized row IDs may be patient IDs shared between offices. ArAgingTab uses only row.id as the React key, so distinct office records collide during reconciliation. No records should be deduplicated or removed.

Smallest fix: change one JSX key to JSON.stringify([row?.id || idx, row?.office_id || row?.office_name || '']). Data, API requests, financial totals and sort logic remain unchanged. Rocket version801 contains the same one-line change.

Verification: actual-source synthetic identity tests reproduce one failure before and all four pass after. Full frontend suite 323/323 PASS; source production build33.83s PASS. Exact compiled key regression, full reversal to072, earlier repairs, seven dependency relinks and parse checks PASS. Blocked042/066 remain excluded; no full recovered build is released.

Candidate index-d315d16f9ace.js / SHA d315d16f9aceac860c77704ca13c45cb54468ca44fb4ce6873bbcafe301b63c8 is based on production release177a2a1e-e361-485c-b38f-2d2008d9216d. Prior072 remains recoverable. Backend070 must remain unchanged.

Safety limitation: automatic approval review rejected an additional API comparison that would retrieve up to500 patient-detail rows. It was not executed or retried. This repair uses the reproduced UI row-count/sort failure, existing source and synthetic test fixtures. No patient identifiers, notes or records are collected as verification evidence. Further checks use visible row counts/order booleans and aggregate-only contracts where authorized.

Live plan: confirm fresh page has30 rows, both Balance sort directions preserve30 and numerical ordering, paging/search/reset/full refresh work, totals remain unchanged, and no obvious regression. No business-data writes or exports.

Live closure: deployment12116689-cb09-48e6-9d50-c0254ba9e292 / index-d315d16f9ace.js. Fresh30, ascending30 and descending30 with correct numerical order. Pagination30/30/30/21, lastNextdisabled. No-match resetsPage1of1/0; clear restores111/30. Minimum1000 yields14 all qualifying; Barnegat search39; Staten4 all correct office and normal refresh preserves4. FullreloadAll and sort again30 PASS. Official totals match aggregate-only API: total542889.40/net413047.99/insurance249663.53/patient274917.35/writeoff18308.52; bucket and office sums equal total. Backend070 unchanged. Alerts/captured browsererrors0. No business-data changes or exports. Previous072 release retained.