# NDASH-120 — Selected-office status table includes unrelated zero rows

Inventory / Clinical Supply / Overview. Medium.

Reproduced on live119 before editing: select Brick, wait for load, status table still lists Eatontown/Brick/Barnegat/Island. Select Eatontown and the same four rows remain. No records changed.

Root: batches query is correctly scoped with officeId, but the officeStatus initializer always prefills all four offices. Those unrelated rows then show zero counts even though they were outside the selected query. Minimal fix filters only the office list used for prefilling. All-offices behavior and subsequent aggregation remain intact. No query, financial, fulfillment, or write-handler changes.

Four focused regressions (two fail before); all540 frontend tests PASS. Build34.22s PASS. Rocket846 confirmed the one-expression change. Actual artifact/deployment/live verification pending.

Actualcompiled initialization reproduces oldwrongrows;three selected offices andalloffice equivalence PASS. Fullreverse119/sevenmodule relinksPASS. Candidateindex-a07246e4cd0d.js;deployment/livepending.

CLOSED PASS: sourcef1dd7ac/deploymenta3ff421e-1fe1-4edc-b75f-ee341a98e770/index-a07246e4cd0d.js SHAa07246e4cd0dd25e39ef233046b8e89c2cfad2b983f504ff363c82fb6fa4a858. FreshliveAll4,Brick1,Eatontown1;tabreentry retainsselectedoffice;nativeMonthcontrol changedtoAugust/Brick1andrestoredSeptember/All4. Directmonthfill was ignored by browser control; no April assertion made. Catalog remains available. Newbrowsererrors0,frontendAPI200,three services active,backend113 unchanged. No recordschanged.
