# Unchanged stock saves do not create adjustment entries

PH5-SUPPLY-015 — PASS in isolated QA on September 16, 2026.

Two live saves of an unchanged four-unit synthetic stock value kept one inventory row but grew history from one to three entries. Both new entries claimed a manual adjustment from four to four, with delta zero. `supplyRequestService.adjustInventory` unconditionally updated stock/timestamp and inserted history after reading the current quantity.

The fix reads the complete existing row and returns it immediately when its persisted quantity equals the requested quantity. Real changes retain the existing update/history path, while the caller still receives the database identity and status. No permissions, schema, provider calls or configuration changed. Concurrent competing writes and transactional history failures remain separate concerns, not claimed fixed here.

Seven actual-service tests changed from 3 pass / 4 fail to 7 pass: unchanged/repeated/zero stock, real change plus retry, current-server-value comparison, and read/write errors. All 1,482 frontend regressions pass with no skips. QA build, 510-file source parity and 17 hosted deployment/isolation checks pass.

Source `dc35e7c1e8c04214526bdc7ab9341a74748e99ec` is pushed. QA release `08136072-57b6-4875-99fb-894f104b4385` uses `assets/index-Dms5rqAo.js`, 8,830,003 bytes, SHA256 `043d54986605011c61e21d42b421cd644a9fdb919070e7e187678d316351850d`. Rollback `643899b2` remains available. Production release `1f1f91bc` and main are unchanged.

Live verification: two unchanged four-unit saves preserve the exact stock/timestamp/history snapshots. Changing four to six retains the same inventory ID and adds exactly one correct +2 adjustment. Repeating six and full refresh preserve the exact new snapshot: one six-unit row, four total history entries. The separate five- and two-unit QA items remain visible unchanged. All stages are recorded in `qa-clinical-catalog-20260916.json`; reproduction history was preserved rather than erased.

The labeled QA item and its history remain retained for pending permission and cleanup-retention work. This is a targeted repair, not overall Phase 5 completion.
