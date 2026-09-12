# NDASH-109 — Late P&L responses overwrite selected scope

Section: Reports / P&L Summary. Severity: High.

Reproduced on108 before editing: settledBrickAugust P&L signature-1328958729. RapidAll->Brick leaves the selectorBrick but rowAll signature-305875479; summary106 remains correctBrick. This repeats the initial rapid-selection failure observed during108verification.

Root cause: PLMonthlyTable publishes all fetchData completions regardless of current office/date/year and the fetch effect does not invalidate pending requests. Fix onlythiscomponent: generationref, guarded success/error/finally, fetch-effect cleanup.108selected metrics, expenseguard, separate year effect, formulas/clipping/rendering unchanged.

Six synthetic deferred-response cases5fail/1passbefore;all491regressionsPASS. Source productionbuildrunning/Rocket835requested. Compiled/deployment/liveverificationpending.108recoverypreserved. No business/configuration changes.
ProductionbuildPASS33.74s/Rocket835confirmed. Actualcompiled oldrace reproduced;latestoffice/period results, obsolete loading/cleanup, current unavailable sourcesPASS. Separateyear effectunchanged;fullreverse108/priorrepairs/7relinksPASS. Candidateindex-047cfc03e3bd.js;deployment/livepending.
