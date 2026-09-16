# Atomic draft save and audit history

PH5-SUPPLY-002 — PASS in isolated QA, September 15, 2026.

Repeated live draft saves had no audit history. The original multi-request save
also left an empty batch when its line insert failed (retained reproduction from
PH5-SUPPLY-001). Updating an existing draft deleted old lines before their
replacements succeeded. These operations could not roll back together.

Migration 026 introduces a caller-permission RPC for this single draft operation.
It saves batch, lines and one actor-bound old/new audit event in one transaction.
It uses existing request permissions and RLS; ignores supplied requester/review
fields; locks existing drafts; rejects stale non-draft edits; and returns unchanged
saves without replacing lines or adding audit events. Existing office/month/
department uniqueness is retained. The two batch-audit policies follow parent
visibility and bind the audit actor. The service calls this RPC only in QA.
Production's existing save path remains unchanged; releasing the transactional
operation to production would require a separately reviewed migration/release.

Source `741c7fbd4dd6b908715364bc365b76c6987df82a`, pushed.
Migration applied to `hvtxjfayenqnwtaisoaw` only; saved SQL receipt
`5d44ddc4-956a-406f-83a6-fbb74260c670`. Caller execution, anonymous denial and
both audit boundaries verified from the live catalog.

QA deployment `c5cd11d1-b211-4c14-bd2f-4f67eacf1a48`, entry
`assets/index-CSVh1bsd.js`, 8,829,439 bytes, SHA-256
`49eba8e207105e52c2fdf23ab54c17d6a0bf1e9a0b1512601348488a44352508`.
Rollback `f4288986-8ab1-4d3b-8d4f-69e48bc9d28d` retained.

Validation: 1,391 frontend tests (zero skipped), 44 transaction database checks,
54 checks across 26 migrations, QA build/510-file parity, 17 hosted isolation
checks: PASS. Transaction checks include insert/update rollback, failed audit
rollback, no-op readback, duplicate creation, stale edits and permissions.

Live UI edit: "Draft saved", one batch/one item, v4 note/quantity 3, one audit.
Seventeen live RPC checks pass: unchanged save preserves exact rows/audit count;
invalid catalog FK rolls back completely; all eleven other current identities
cannot save this clinical draft; anonymous execution denied. Twelve-identity
read matrix includes audit scope: only Super Admin and Office A manager see this
request/item/audit under the unchanged configured permissions. Full refresh
shows the saved item and quantity.

Fresh Office B draft UI creation: one batch/one labeled line/one `draft_created`
audit, visible after refresh. That disposable batch/line was removed with exact
ID, office, status, actor and item-label guards; audit snapshot and row retained.
The original Office A test draft remains for the remaining review/fulfillment
checks. No request submitted, external notification/order sent, or production
deployment performed. Production remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`.
