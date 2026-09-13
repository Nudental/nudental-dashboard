# NDASH-112 — Settings Audit Trail history silently capped at200

Section: Settings / Audit Trail. Severity: High (older audit entries unavailable).

Repeated live on111 before editing:200entries,200rows,no pagination. Authorized read-only exact HEAD count on the same audit_logs table2261 (no records returned by count probe). Root: managementService.auditLogsService.getAll limits200; component filters only that subset.

Small fix in managementService.js and AuditTrailManagement.jsx: reuse existing readCompleteAuditEntries unchanged with exact-count stable created_at/id ordering and page ranges; preserve existing selected fields/userName mapping. Render25filtered rows per UI page with First/Previous/Next/Last, retain complete count/search/action/section filters, reset page/expanded detail on filter changes, clear stale logs on a failed complete read. No writes, auth/schema/config changes or unrelated service changes.

Eight synthetic reader/render cases6failbefore;all512regressionsPASS after. Buildrunning/Rocketsubmitted. Compiledartifact/deployment/livepending.111recoverypreserved.
BuildPASS34.21s. Rocket838 initiallyreportedwrongpagedgetAllcontract;explicitcorrectionconfirmedno-argcompletehelpercontract/fullfilteredcount andunchangedsharedhelper. Actualartifact old200cap reproduced;complete2261/latefailure/paging/filterreset/oldrowrenderingbyte-equivalentJSON/errorclearPASS. Exactfullreverse111+priorrepairs/sevenrelinksPASS. Sharedhelperhasno globallyaccessiblecompiledbinding,soexactunchangedsourcehelperisinlinedlocallyinthepatchedgetAll;existingscopedhelperuntouched. Candidateindex-0a86c7fb58d6.js;deployment/livepending.
