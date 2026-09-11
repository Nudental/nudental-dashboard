# NDASH-047 — Retention total omits unlisted audit resources

Section: Compliance & Retention. Severity: Medium. Status: reproduced live; source repair tested; deployment and live verification pending.

Overview showsTotalAuditRecords2243 andhelperaudit_logscountacrossallresourcetypes. AuditDashboardAllTimeandread-onlyHEAD bothcount2261. Resource table has12configuredtypes totaling2243. Metadata-onlysourcecheck identifies18omittedrecords:api_endpoint_registry2,user_office_assignments16. No logbodiesread.

Root:fetchStatsloops onlyRESOURCE_LABELSkeys; totalRecordsreduces thosecounts rather thanrequesting theRLS-scopedtotal acrossaudit_logs. Fixedresourcelistdoesnotcoveractualtypes. This is a display/query-scope defect, notpermissionorpurgelogic.

Reproduced again immediately before editing: live total remains 2,243. Source repair adds an independent exact all-resource HEAD count using the existing authenticated client and its RLS scope. A separate loading state shows progress, valid zero stays zero, and failed/missing/invalid counts show an em dash and an unavailable helper. Unmount ignores late results. The configured resource cards, retention rules, purge controls, scheduler, and permissions remain unchanged.

Tests: seven focused tests of the actual count callback/card PASS; all 190 retained frontend tests PASS. Source production build PASS (37.51 seconds). Rocket received the same narrow request after version 777 completed. Production artifact preparation, deployment, and live verification remain pending. No log bodies, retention changes, or purge actions were needed.
