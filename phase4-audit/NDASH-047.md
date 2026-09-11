# NDASH-047 — Retention total omits unlisted audit resources

Section: Compliance & Retention. Severity: Medium. Status: live/source verified; repair pending.

Overview showsTotalAuditRecords2243 andhelperaudit_logscountacrossallresourcetypes. AuditDashboardAllTimeandread-onlyHEAD bothcount2261. Resource table has12configuredtypes totaling2243. Metadata-onlysourcecheck identifies18omittedrecords:api_endpoint_registry2,user_office_assignments16. No logbodiesread.

Root:fetchStatsloops onlyRESOURCE_LABELSkeys; totalRecordsreduces thosecounts rather thanrequesting theRLS-scopedtotal acrossaudit_logs. Fixedresourcelistdoesnotcoveractualtypes. This is a display/query-scope defect, notpermissionorpurgelogic.

Smallest repair: obtainexactall-resourceHEADcountforTotalAuditRecords, handleunavailablecountwithoutinventingzero, keep configured-resourcepolicycards andallretention/purgecontrolsunchanged. Do notaddpolicies, execute purge orchangeRLS. Tests/deployment/liveverificationpending.
