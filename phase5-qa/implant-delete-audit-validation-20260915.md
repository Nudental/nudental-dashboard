# PH5-AUDIT-006 — inventory deletion audit

Reproduced by deleting only imported test inventory `e09b3aa6-6f84-41c2-96da-1deb0d3d34cd` through QA. The UI succeeded, the row disappeared, but both implant and central audit tables had zero entries for that deletion. `deleteInventoryRecord` performs a delete without logging, and no database deletion audit trigger existed.

Migration `017-implant-delete-audit.sql` attaches the existing central `fn_audit_trigger` only to inventory DELETE. Existing create/update logging and role/office policies are unchanged. No earlier missing event was fabricated or backfilled.

- Source `7f502a0357a1aa49802ac78af227a8232c55e75a`.
- Eight offline cases PASS: original gap, repaired actor/prior values, unchanged creation behavior, denied staff, and repeated-delete idempotency.
- All 17 migrations pass non-QA rejection and coexistence checks (36 PASS).
- Isolated QA SQL receipt `2aef376d-ae5f-44f3-a831-d630bb686339`; expected trigger enabled.
- Seven live permission/audit cases PASS. Staff, ordinary Admin, and other-office Manager remain unable to delete; Super Admin deletes and produces exactly one audit. Probe cleanup PASS.
- Original UI flow repeated on the other original QA inventory fixture `29b15311-9a0f-4b05-9275-370df90dc9bf`: row removed and central audit contains DELETE, the actual Super Admin actor, original QA SKU, and prior quantity 6. PASS.

No frontend or production deployment was needed for this QA-only database repair. The QA frontend remains `df98cec2-c05f-4723-957a-fe34df727ac8`; production remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`.
