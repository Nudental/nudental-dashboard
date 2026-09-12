# NDASH-047 — Retention total omits unlisted audit resources

Section: Compliance & Retention. Severity: Medium. Status: repaired, deployed, live verification PASS.

Overview showsTotalAuditRecords2243 andhelperaudit_logscountacrossallresourcetypes. AuditDashboardAllTimeandread-onlyHEAD bothcount2261. Resource table has12configuredtypes totaling2243. Metadata-onlysourcecheck identifies18omittedrecords:api_endpoint_registry2,user_office_assignments16. No logbodiesread.

Root:fetchStatsloops onlyRESOURCE_LABELSkeys; totalRecordsreduces thosecounts rather thanrequesting theRLS-scopedtotal acrossaudit_logs. Fixedresourcelistdoesnotcoveractualtypes. This is a display/query-scope defect, notpermissionorpurgelogic.

Reproduced again immediately before editing: live total remains 2,243. Source repair adds an independent exact all-resource HEAD count using the existing authenticated client and its RLS scope. A separate loading state shows progress, valid zero stays zero, and failed/missing/invalid counts show an em dash and an unavailable helper. Unmount ignores late results. The configured resource cards, retention rules, purge controls, scheduler, and permissions remain unchanged.

Tests: seven focused tests of the actual count callback/card PASS; all 190 retained frontend tests PASS. Source production build PASS (37.51 seconds). Rocket version 778 completed. Production artifact preparation, deployment, and live verification remain pending. No log bodies, retention changes, or purge actions were needed.


Deployment closure supersedes pending status above: reproduced again on046 at2,243 while refreshed independent exact source count remained2,261, including18unlisted records. Scoped release047 from046, deploymentfd13d63d-c409-48d2-8c46-1b40e3803642; /assets/index-1d3355323a76.js; SHA1d3355323a769153923e4dafd301210dc47d1278e610438a523b1ee2934f1765. Previous046 and older releases preserved;042 excluded.

Actual compiled tests PASS for exact HEAD count, valid zero, loading, failed/missing/invalid counts, unmount, existing permission guard order, unchanged resource stats query, whole-entry reversal and7relinks. Latest retained source221tests/build PASS. Live total2,261 and12configured resource rows; refresh retains both. All12Purge Disabled buttons remain disabled, scheduler says not configured, Retention Rules retain browser-local notice, and Purge History stays empty. Browser errors0. No retention changes, purge actions, audit-log content reads, or business-data writes.
