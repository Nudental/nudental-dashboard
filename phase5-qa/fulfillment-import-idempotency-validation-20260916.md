# Fulfillment file retry validation

PH5-SUPPLY-018 — live duplicate reproduced; QA candidate awaiting publication and live retest.

A small synthetic CSV had one valid Office A fulfillment and one invalid row without an office. Preview correctly showed one valid/one invalid. Back/Re-upload left the database unchanged. Import created one unlinked record, its transactional insert audit and one import-summary audit; refresh retained the record. Re-uploading the identical file created a second identical record and another pair of audits. Root cause: each imported row used a fresh generated primary key, with no stable identity for a file retry.

The targeted QA import adapter hashes the file bytes and original row position to a stable UUID. The existing primary-key constraint arbitrates duplicate or overlapping retries. A conflict is reported as already imported only after the current authenticated client can read the same ID, office and item name. It does not update the old record. Authentication failures and other database errors propagate. The importer displays duplicate counts separately from newly inserted rows and validation skips. Original row positions are retained before validation filtering. No schema, grants, policies or provider settings change; production follows its existing service path without hashing.

Scope: byte-identical files, including renamed copies, receive the same identities. Different files or changed bytes are separate imports. Two equal rows at different positions in one file remain separate. This does not reconcile duplicates that predate the repair, infer business shipment identity, or deduplicate revised/reordered files. Historical imports remain unlinked to inventory/request transactions.

Validation: 18 service/hash/error/concurrent-call simulations and seven actual UI handler/render checks pass; 1,528 retained frontend tests pass, zero skips. QA production build, 511-file source parity and artifact environment checks pass. No live simultaneous-browser claim yet.

Evidence: `qa-fulfillment-import-20260916.json`. Both original duplicate records were removed using exact ID/label/office/snapshot guards. Their four record audit events and two import-summary events remain. Fixed live retest and final cleanup are still required.
