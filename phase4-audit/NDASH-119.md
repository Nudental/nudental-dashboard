# NDASH-119 — Clinical Supply shows disconnected header filters

Inventory / Clinical Supply / Fulfillment Log and its Spend subview. Medium.

Reproduced live118 twice: the module header Office selector changes to Brick and then Eatontown, but spend still shows four offices plus Total and the local Office remains All Offices. Selecting the local Brick filter correctly gives Brick plus Total. Header Month likewise is not passed to this subview. These are misleading inactive controls, not a demonstrated permission bypass.

Root: MonthlySupplyModule renders its Office/Month controls for all eight tabs, but only Overview and Reports receive those props. Other tabs own local filters or are office-independent. Minimal correction wraps the existing header controls so they appear only for Overview/Reports. Existing state, handlers, child props, hooks, tab permissions and local controls unchanged; no query/financial/stock/data changes.

Three rendered-component regressions: one fail before, all pass after, covering all eight tab modes and the retained Overview/Reports scope props. All536 frontend tests PASS. Production build33.33s PASS. Rocket/artifact/deployment/live verification pending.

Rocket845 confirmed. Actualcompiled header wrapper passes eight view modes; original control subtree, all hooks and child props unchanged. Fullreverse118/seven module relinks PASS. Candidateindex-758e90c5c85b.js;deployment/livepending.

CLOSED PASS: sourceb857814/deploymentf3d44dfb-031f-4555-b42b-3a1eebd668e9/index-758e90c5c85b.js SHA758e90c5c85b2ade39eec0ddb1155b8550839d75cf324142807c1b528909c48f. Freshlive fulfillmentlocalfilters only/noheaderMonth;spendfour offices+Total thenlocalBrick+Total;Overview/Reportsheadercontrols retained;ReportsheaderBrick synchronizes localBrick;catalogheader controls absent;headerselection preservedaftertabchange. Newbrowsererrors0/APIserviceshealthy/backend113unchanged. Separate observation: Overview status table retains four static office rows under Brick; investigate independently, not counted as scoped-data verification here. No businesswrites.
