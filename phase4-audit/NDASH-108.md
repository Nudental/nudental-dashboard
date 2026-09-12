# NDASH-108 — Combined-office P&L metrics become All Offices

Section: Reports / P&L Summary. Severity: High.

Reproduced twice on107, August2026: selected Barnegat+Brick but P&L production/collections signature-305875479 matchesAll; repaired top summary signature351520188 correctly combines selected offices. Switch toBrick: P&L signature-1328958729 correct; addBarnegat: P&L returnsAll again. Existing combined-office expense-unavailable warning remains present and was not bypassed.

Root cause: PLMonthlyTable resolves a location only for exactly one active office; multiple offices pass null to the Ascend API. Smallest fix in this component: resolve/deduplicate all selected locations and reject unknowns before requests. Independently aggregate netProduction and totalCollections via their existing scoped methods; a missing/failed office keeps that metric unavailable while the other metric can render. Preserve single/all paths, month clipping, expense scope guard, formulas and UI.

Six focused cases5fail/1pass before. All485testsPASS; production source buildPASS31.05s. Rocket had slept from inactivity: preserved unsent prompt, reloaded, clicked existing Wake Up Agent, waited until enabled, submitted once. No user intervention needed. Compiled candidate/deployment/liveverification pending;107 recovery retained. No business/config/security changes.
Actualcompiled selected metrics/unknown/dedup/missing and independent metric failurePASS. Single/all finalpaths identical;expenseguard/rendering unchanged;fullreverse107/priorrepairs/7relinksPASS. Candidateindex-edec983f3a0e.js. Rocket has writtenonlyPLMonthlyTable and isbuilding. Deployment/livepending.
