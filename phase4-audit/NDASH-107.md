# NDASH-107 — Obsolete provider responses overwrite current filters

Section: Reports / Provider Production & Collections. Severity: High.

Reproduced twice on106: August provider table settled at Brick6rows/signature-1524047759; rapidly select All then Brick. Final selectorBrick but table18rows/signature1583672560 (All). Summary106 remains correctBrick. Also ThisMonth then LastMonth left a6-row incompatible signature2079552290 instead ofAugust. Tab remount restores correctAugust; repeatingAll->Brick reproducesAll18 again before editing.

Root cause: RevenueByProviderChart fetch callback publishes success/error/finally from every request; effect has no cleanup invalidation.105 correctly resolves selected offices but does not sequence asynchronous responses.

Small fix in this component only: request-generation ref increments per fetch; success/error/loading completion check current generation; effect cleanup invalidates pending results. Existing105 queries, office merge, amounts, dates and rendering unchanged. Current errors still display. No API/config/business changes.

Six deferred-response cases,5fail/1pass before; all479regressionsPASS. Production build/Rocket833 requested; compiled/deployment/live verification pending.106 recovery preserved.
Production buildPASS35.16s/Rocket833confirmed. Actual compiled callback reproduces old race and passes office/date ordering, obsolete failure/loading, cleanup and current-error checks. Scope merge/rendering and prior106summaries unchanged. Fullreverse106/priorrepairs/7relinksPASS. Candidateindex-945ea64b89d8.js. Deployment/livepending.

## Closure — PASS
Source3f00da2. Deployment404a7adc-edb1-4453-ba92-07fd317d26a0;assetindex-945ea64b89d8.js SHA945ea64b89d83b6062395d74cb00ddd5cdc309ae6f4d53ee433e92dcf9a955b0. Recovery106retained. Live rapidAll->Brick finishes6rows/signature-1524047759; rapidThisMonth->LastMonth stays same correctAugust values. Combined13/signature1885968237 and selected activity labels retained. Summary106sixfields/cards/profit remain correctforBrick/combined. Freshrelease/errors0/frontendAPI200/3servicesactive/backend085unchanged. No business data/configuration changes. FullPhase4audit stillincomplete.
