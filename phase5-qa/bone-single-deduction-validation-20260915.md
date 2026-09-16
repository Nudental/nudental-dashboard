# PH5-BONE-004 — a one-unit usage event deducted stock twice

Live QA: manual restock created ten units and one restock-history entry. Editing
the one-unit record from In Stock to Used reduced stock to eight. The frontend
called `deductStockForItem` before save; the existing `bti_auto_deduct_stock`
database trigger then deducted again in the save transaction.

Removed only the duplicate pre-save call/import from desktop EntryModal and
MobileEntryModal. The existing database trigger, role policies, quantity rules,
and service function remain unchanged. The trigger owns the successful-save
deduction; failures can no longer consume stock through these form handlers.

Twenty checks execute both actual handlers against offline PostgreSQL and the
actual schema trigger. Original: 12 pass, 8 fail (double consumption and stock
lost on failed create/edit). Repaired: 20 pass, fixtures rolled back. All 1,375
retained frontend tests pass, zero skips; 510-file parity/build guards and 17
hosted checks pass.

Source `194a068957efe6b0ac66b2107f7476c14d0142fc`, QA release
`9a99231f-5b40-49f3-b6c1-265be834820e`, entry `assets/index-CYgvvhWp.js`, SHA256
`ae9bcdd173b2b682e4f2282267d65d73e104e7186081268c626c23a953a580bb`.
Prior QA `4360213f-65b7-4b5a-8efc-827867bfa458` retained. Production unchanged.

Live PASS: after resetting only the disposable record's status, repeated usage
changed stock from eight to seven and added one audit. Editing its note while
Used left stock at seven and added one edit audit. One inventory record, one
stock record; six inventory audits after all original/repaired test actions.
Receipts: `qa-bone-ui-20260915.json`. The temporary records remain for cleanup
and further inventory boundary checks; the original test's lost units are not
business data and have not been hidden by editing stock totals.
