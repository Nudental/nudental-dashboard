# Immediate stock edits retain the saved row identity

PH5-SUPPLY-013 — PASS in isolated QA on September 16, 2026.

Creating a two-unit catalog stock row then editing it to three units without refreshing created two rows. Repeating the edit to five units created a third row, with quantities 2/3/5. `ItemRow.handleStockDone` discarded the service's saved record, while `MobileCatalogView.handleStockSaved` created local state without its database ID. Each subsequent edit therefore took the insert path.

The targeted fix forwards the saved record through the existing callback and merges it into the local inventory entry. Later edits use that ID; database-derived status is also retained. No schema, uniqueness rule, office assignment, permissions or offline-queue operation changed. Six actual-handler/state tests changed from 3 pass / 3 fail to 6 pass, including repeated edits, existing rows, failed saves, unrelated items and offline queuing. All 1,470 frontend regressions pass, with no skips. Build, 510-file parity and 17 hosted checks pass.

Source `e6b7e93b1e8d6f82f1250e72bb75d7a88d35ec9f` is pushed.
QA deployment `e841805a-4c22-4ca4-a3df-b6fe0592e47e` uses
`assets/index-Dmfjt20-.js`, 8,829,693 bytes, SHA256
`260de0fc2d48d81fbcc518642f9eb262f5758f3a3b4d0dd028c35fb445de4703`.
Rollback `14589820` is preserved; production remains `1f1f91bc`.

The three exact-ID reproduction duplicates were removed only after checking their saved snapshots and confirming no history existed. The same labeled synthetic catalog item was then reused. Repaired UI first save: one two-unit row. Immediate edit: the same ID, three units, one adjustment history row. Repeated edit: the same ID, five units, two history rows. Full refresh preserves five units and does not add rows/history; the separate four-unit test item remains unchanged. Receipt `qa-clinical-stock-duplicate-20260916.json` tracks the retained test item/row and cleanup obligation.

Initial stock-creation history, stock/history access candidate 035, silent-error feedback, concurrency across separate clients and eventual cleanup remain separate work. This repair does not claim those passed.
