# NDASH-122 — Older supply report responses overwrite current filters

Inventory / Clinical Supply / Reports. Medium.

Reproduced twice on live121: begin Requests by Office/September, rapidly move native month control to April and select Fulfillment Spend by Office. Final controls read April1–30/All Offices/Fulfillment, but settled result is No data. Changing local Office to Brick returns40 and back to All returns165, without changing the final date/report selection. Six focused deferred-response tests reproduce the stale result/error/loading problems independently.

Root: loadReport runs asynchronously for every type/office/date change; older results, errors and finally handlers update shared data/error/loading without checking request order. Minimal fix adds one stable request counter, captures it per load, guards success/error/finally, and invalidates the request in the existing effect cleanup. Existing query, calculation, filtering, formatter121 and current error/empty behavior retained.

Focused suite: five failing before, six passing after; all552 frontend regressions PASS. Build34.06s PASS. Rocket/artifact/deployment/live verification pending.

Rocket848 confirmed. Actualcompiled oldcallback reproducesemptyoverwrite; newcallback passes deferredresult/error/loading/cleanupcases. Fullreverse121/sevenmodule relinksPASS. Candidateindex-8de3003f1f7c.js;deployment/livepending.
