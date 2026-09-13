# NDASH-112 — Settings Audit Trail history silently capped at200

Section: Settings / Audit Trail. Severity: High (older audit entries unavailable).

Repeated live on111 before editing:200entries,200rows,no pagination. Authorized read-only exact HEAD count on the same audit_logs table2261 (no records returned by count probe). Root: managementService.auditLogsService.getAll limits200; component filters only that subset.

Small fix in managementService.js and AuditTrailManagement.jsx: reuse existing readCompleteAuditEntries unchanged with exact-count stable created_at/id ordering and page ranges; preserve existing selected fields/userName mapping. Render25filtered rows per UI page with First/Previous/Next/Last, retain complete count/search/action/section filters, reset page/expanded detail on filter changes, clear stale logs on a failed complete read. No writes, auth/schema/config changes or unrelated service changes.

Eight synthetic reader/render cases6failbefore;all512regressionsPASS after. Buildrunning/Rocketsubmitted. Compiledartifact/deployment/livepending.111recoverypreserved.
BuildPASS34.21s. Rocket838 initiallyreportedwrongpagedgetAllcontract;explicitcorrectionconfirmedno-argcompletehelpercontract/fullfilteredcount andunchangedsharedhelper. Actualartifact old200cap reproduced;complete2261/latefailure/paging/filterreset/oldrowrenderingbyte-equivalentJSON/errorclearPASS. Exactfullreverse111+priorrepairs/sevenrelinksPASS. Sharedhelperhasno globallyaccessiblecompiledbinding,soexactunchangedsourcehelperisinlinedlocallyinthepatchedgetAll;existingscopedhelperuntouched. Candidateindex-0a86c7fb58d6.js;deployment/livepending.

CLOSED PASS: source47cdb18; deployment00a9b0a5-2b7d-41d7-a8f4-23499dba550f; assetindex-0a86c7fb58d6.js SHA0a86c7fb58d62a7ca46bd87746c9e313700b2262364473ed1aa4dbfda403efdf. Live2261entries/91pages/25first/11last,Next/First/boundarybuttons,Providers1260/Create2,filterpage reset/unmatched0/clearrestore/Refresh2261 PASS. Import111Success300 matching and System110Unavailable3/no invented rates/Online2 retained. Newerrors0/frontendAPI200/three services active/backend085 unchanged. No business records created or modified. Complete-reader existing50000 guard remains; no claim of indefinite history scalability.111 recovery and prior graphs preserved. Full Phase4 audit remains incomplete.
