# Manual supply receipt persistence

PH5-SUPPLY-006 — standalone receipt PASS in isolated QA, September 15, 2026.

Twice, the manual Receive form reported “Receipt confirmed” for the labeled
two-unit fixture, but its row remained Pending, with no received date/user/count
and no new audit event. Exact readback after both attempts matched the original
row. The handler wrote qty_received and updated_at, which were absent from the
copied table, and ignored the database error.

QA-only migration 030 adds the two existing-handler fields (nonnegative integer
receipt count, default zero; update timestamp). The handler now requires one
updated row and propagates errors before reporting success. Existing role/office
policies remain in effect. This is not a production schema deployment.

Five actual-service tests: original 2 pass / 3 fail; repaired 5 pass. Missing
columns, denied writes and unavailable rows cannot report success. Sixteen
actual PostgreSQL checks verify partial/completed persistence, correct actor and
date, audit history, invalid-quantity rollback and existing-data preservation.
All 62 installation checks for 30 migrations pass. All 1,425 retained frontend
tests pass, zero skipped; build, 510-file parity and 17 hosted checks pass.

Source `c7a1ca11c626dcfefeadb31cf7532f8e79dcc262`; applied QA SQL receipt
`cfddea7b-194c-4d82-9554-aed7e830ff6c`. QA deployment
`acf10c88-7786-4edf-94da-49f096c9cf85`, entry `assets/index-BUsRCmj6.js`,
8,830,402 bytes, SHA-256
`497acedbea8554087efb4463f0cd2bfd5330781eb6a96d4ac1c1ec48ba1bef97`.
Previous QA `c5668e5e-7981-415b-ab1d-76a4a18e2ba7` is preserved.

Live original test now reports success and persists Completed, qty_received 2,
September 15, the authenticated QA user and a receipt-update audit. Full reload
shows Completed and its received date; Receive is no longer offered for the row.
Exact-ID/name/office cleanup removes the fixture, retaining all three audit events.
Final browser refresh shows zero fulfillment records. No camera permission used.

This fixture intentionally had no linked stock or request item. Linked inventory
effects, multi-item atomicity, stale/repeated receipt execution and offline replay
are not claimed verified. The separate receipt modal still defaults to UTC and
allows text in its Received By display even though the service records the actor;
those findings remain for follow-up. Production remains unchanged.
