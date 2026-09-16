# PH5-AUDIT-007 — Bone/Tissue deletion failed against its audit foreign key

Cancel preserved the exact temporary record. Two subsequent delete attempts
failed with `bone_tissue_audit_log_record_id_fkey`; each transaction left the
record, six audits and seven units intact. The AFTER DELETE trigger inserts an
audit referencing the already-removed parent. Its live-parent FK both conflicts
with that insert and would cascade away prior historical audits.

QA migration 023 removes only this FK. Audit record IDs remain historical IDs;
existing create/update/delete logging and access policies remain unchanged. No
audit rows are removed. Historical audits without a live parent remain protected
by the existing restrictive parent policy; this does not add a deleted-record
history UI or widen API access to those records.

17 offline PostgreSQL checks pass: original FK failure, rollback, authorized
delete, denied delete roles, preserved prior audits, latest old-value snapshot,
one deletion event, repeated delete no-op and unchanged stock. All 23 migrations
pass 48 installation/non-QA rejection checks. Source
`affb193d1e9afd58abe71fc027b5ccd84cdd26b9` is pushed.

Applied only to QA project `hvtxjfayenqnwtaisoaw`; saved receipt
`1d4dff59-0c90-4259-b4a5-ca8a56b87fcc`. Live delete PASS: inventory record removed,
seven audits retained (created 1, updated 5, deleted 1), separate stock unchanged
at seven. Exact temporary stock row then removed with ID/SKU/office guards. Final
inventory and stock counts for the fixture are both zero; all seven audits remain.

Receipts: `qa-bone-ui-20260915.json` and `qa-bone-cleanup-20260915.json`; cleanup is
complete. These helpers are single-use and must not be rerun after cleanup.
No attachment was uploaded and no camera permission granted. Production/main,
QA frontend and API were unchanged by the migration. Native scanner, offline
queue, Bone/Tissue attachments/imports and multi-unit usage are not claimed by
these manual single-unit lifecycle checks.
