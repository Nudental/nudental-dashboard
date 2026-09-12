# NDASH-108 — Combined-office P&L metrics become All Offices

Section: Reports / P&L Summary. Severity: High.

Reproduced twice on107, August2026: selected Barnegat+Brick but P&L production/collections signature-305875479 matchesAll; repaired top summary signature351520188 correctly combines selected offices. Switch toBrick: P&L signature-1328958729 correct; addBarnegat: P&L returnsAll again. Existing combined-office expense-unavailable warning remains present and was not bypassed.

Root cause: PLMonthlyTable resolves a location only for exactly one active office; multiple offices pass null to the Ascend API. Smallest fix in this component: resolve/deduplicate all selected locations and reject unknowns before requests. Independently aggregate netProduction and totalCollections via their existing scoped methods; a missing/failed office keeps that metric unavailable while the other metric can render. Preserve single/all paths, month clipping, expense scope guard, formulas and UI.

Six focused cases5fail/1pass before. All485testsPASS; production source buildPASS31.05s. Rocket had slept from inactivity: preserved unsent prompt, reloaded, clicked existing Wake Up Agent, waited until enabled, submitted once. No user intervention needed. Compiled candidate/deployment/liveverification pending;107 recovery retained. No business/config/security changes.
Actualcompiled selected metrics/unknown/dedup/missing and independent metric failurePASS. Single/all finalpaths identical;expenseguard/rendering unchanged;fullreverse107/priorrepairs/7relinksPASS. Candidateindex-edec983f3a0e.js. Rocket has writtenonlyPLMonthlyTable and isbuilding. Deployment/livepending.

## Closure — PASS
Rocket834 confirmed. Source59cf2be. Deploymentb86eeece-1fef-4548-9656-bb21e1fd4428;assetindex-edec983f3a0e.js SHAedec983f3a0e4ae7457961a2552c561bb44b7bebcf8037cbf53728b4299e1fff. Recovery107 retained. LiveAugust combinedP&L signature351520188 matches selected summary; expenseguard notice and unavailableexpenses/profit cells remain. SettledBrick-1328958729 andAll-305875479 matchAPI/summary; supportedprofit arithmeticPASS. No browser errors;frontend/API200/3servicesactive/backend085unchanged. No business/configuration changes.

Additional existing PL request-order defect observed: initial rapid LastMonth/Brick selection left an olderAll row whilesummary correctly showedBrick. A settledcombinedrequest andthenBrick/All eachwork. Record109 and reproduce the rapidtriggeragain beforeediting. PLcallback/effect sequencing was unchanged in108; do notdeclare allReportscomplete.
