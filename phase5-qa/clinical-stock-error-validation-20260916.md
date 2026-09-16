# Clinical stock save errors are visible

PH5-SUPPLY-014 — PASS in isolated QA on September 16, 2026.

Two live attempts to save 9999999999 units on the labeled synthetic catalog item were rejected without any visible explanation. The exact stock/history snapshots stayed at one four-unit row and one adjustment. `ItemRow.handleStockDone` caught errors with only `console.error`.

The targeted change adds an accessible alert while the keypad is open, clears it on a fresh attempt/open, and retains the entry on failure. Integer overflow gets a useful quantity message; other failures advise refresh/readback before retrying without exposing database diagnostics or claiming an uncertain write definitely failed. No service, schema, permission, configuration or offline behavior changed.

Five handler/render tests changed from 1 pass / 4 fail to 5 pass. Six retained stock-identity tests pass. All 1,475 frontend regressions pass with zero skips. QA build, 510-file source parity and 17 hosted deployment/isolation checks pass.

Source `b300f539c5bd1759791ae50beef53093bdb23af9` is pushed. QA release `643899b2-1f0a-47fb-a1c7-11f5c61f8d51` uses `assets/index-Dd6Wnafs.js`, 8,829,977 bytes, SHA256 `0bcb0f0124414d90f3b6489cfc907676ac76a276a6c4d8a53fc40b8b17af7a9e`. Rollback `e841805a` remains available. Production release `1f1f91bc` is unchanged.

Original live test now displays “Stock quantity is too large. Enter a smaller number.” Cancel hides the alert; full refresh shows four units. Readbacks after rejection and Cancel/refresh exactly match the pre-test inventory/history snapshots, with no duplicate or changed records. Receipt: `qa-clinical-catalog-20260916.json`, stages `fixed-invalid-value` and `cancel-invalid-value`.

No camera access was granted or used. Existing synthetic fixtures remain retained for the separately pending stock permission and history-retention checks; this repair does not claim those complete.
