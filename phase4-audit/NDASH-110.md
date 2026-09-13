# NDASH-110 — Unsupported notification delivery health

Section: Admin System Dashboard. Severity: Medium.

Reproduced twice on109: Notification Delivery Health shows Email3, Push1, In-App6 delivered; all zero failed, Healthy and100%. Its own notice acknowledges that no delivery log exists. Root: loadData allocates60%/25% of recent notification rows to Email/Push, assumes zero failures; the section defaults unknown values to zero and zero samples to100%.

Small correction in src/pages/admin-system-dashboard/index.jsx only: retain the recentEvents readback, remove invented channel totals, and show neutral Unavailable for Email/Push/In-App with an explicit missing-delivery-log explanation. Keep recent event/read-state rendering, other System panels and all queries unchanged. No configuration, business-data or external notification change.

Six focused rendering cases: five fail before, one passes. All497frontend regressions pass after. Initial sandboxed build service stopped early; normal build with child-process access running. Rocket source correction requested. Compiled patch, deployment and live verification pending.109is the recovery state.
FinalproductionbuildPASS28.81s/Rocket836confirmed. SixfocusedfinalPASS;actualcompiled oldfalse100%/Healthy reproduced, unavailablechannels/empty-no100%/eventreadstatesPASS. Fourtargetedpatchesplussevenentryrelinks exactlyreverseto109;priorrepairsandblocked066exclusionPASS. Candidateindex-ebf48af4df44.js. No fullrecoveredfrontenddeployment. Deployment/livepending.

Sourcee4c3480. Deployc751b0f7-7013-4d4d-93b1-74713dd28f9b success;entryindex-ebf48af4df44.js SHAebf48af4df44d68b0a6d9c05e5243fe892b2099db98eb8708a171bb3dfe15fc6. Freshlive3Unavailable/no inventedmetrics;5recentevents signature274100516unchanged. Refresh/Reports/healthchecksongoing.

## Closure — PASS
Freshrelease3Unavailable/no falsecounts/rates/health;5recentevents signature274100516retained. RefreshAllpreservesresult;other5Systemheadings/Online2 retained. ReportsYTD2026settles9PLrows/loading0;freshbrowsererrors0. Root/System/Reports/Inventory/Directory/API200,3servicesactive,backend085unchanged.109recoverygraphretained. No business/configuration changes.
