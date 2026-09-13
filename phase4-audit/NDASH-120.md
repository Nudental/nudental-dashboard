# NDASH-120 — Selected-office status table includes unrelated zero rows

Inventory / Clinical Supply / Overview. Medium.

Reproduced on live119 before editing: select Brick, wait for load, status table still lists Eatontown/Brick/Barnegat/Island. Select Eatontown and the same four rows remain. No records changed.

Root: batches query is correctly scoped with officeId, but the officeStatus initializer always prefills all four offices. Those unrelated rows then show zero counts even though they were outside the selected query. Minimal fix filters only the office list used for prefilling. All-offices behavior and subsequent aggregation remain intact. No query, financial, fulfillment, or write-handler changes.

Four focused regressions (two fail before); all540 frontend tests PASS. Build34.22s PASS. Rocket846 confirmed the one-expression change. Actual artifact/deployment/live verification pending.

Actualcompiled initialization reproduces oldwrongrows;three selected offices andalloffice equivalence PASS. Fullreverse119/sevenmodule relinksPASS. Candidateindex-a07246e4cd0d.js;deployment/livepending.
