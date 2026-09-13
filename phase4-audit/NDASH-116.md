# NDASH-116 — Allocation filters retain an invalid table page

Section: Inventory / Implant & Grafting / Order Allocation. Severity Medium. Confirmed live115 before editing, twice: All Offices27 rows;pageSize25+Next gives2remaining rows. Brick filter has5matching rows but renders no allocation rows and26-5of5. Repeat pageSize10+Next+Brick gives11-5of5 and zero displayed rows. Expected first valid page with five matching rows. No quantities, allocations, receiving status, stock or business records modified.

Root: shared AllocationTable in OrderAllocationTab.jsx keeps local page on rows/filter changes and uses unclamped page in slice/range/buttons. Planned minimal correction: reset page when incoming rows/category changes and clamp the displayed page; preserve filters, columns, data, summaries and export behavior. Not yet edited/tested/deployed.

Sourcefixed: reset page onrows/category changes;clampcurrentPage for slice/range/disabled/adjacentnavigation, beforeloadingearlyreturn. Sixfocused3failbefore/all525regressionsPASS. Buildrunning/Rocketsubmitted;scopedartifact/deployment/livepending.

Build35.47sPASS/Rocket842confirmed. Actualcompiled component tests reproduce old26-5range, repair immediateclamp/page-reset/empty/loading/adjacentcontrols, and preserve original row rendering byte-equivalentJSON for bothBone/Implantlayouts. Fullreverse115and7module relinksPASS. Candidateindex-26a67b81999d.js;deployment/livepending. Preparer accommodates compiled conditional return rather than source early If; no application logic changed for that tooling adjustment.
