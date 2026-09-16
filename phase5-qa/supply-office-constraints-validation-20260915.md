# Synthetic supply office constraints

PH5-QA-SUPPLY-002 — office boundary PASS, September 15, 2026.

The QA UI save twice failed `chk_srb_office_id`; readback confirmed zero batches,
items and audits. The copied schema hardcoded four production office names in
seven related supply constraints. Offline execution reproduced rejection for
every constraint.

Migration 024 replaces only those seven name lists with the two existing QA
office names. This is a QA adapter, not a production schema change. It preserves
constraint names, nullability, existing policies and all other schema rules.
The migration rejects non-QA environments. Database regression: 84 checks PASS.
All 24 migrations coexist and reject non-QA installation: 50 checks PASS.

Source `3e644eb` with installation-count test `f6b819a` is pushed. Applied to
`hvtxjfayenqnwtaisoaw` only; saved SQL receipt
`eb784483-628b-4e26-a26e-2b9d8153aa53`. Live catalog readback shows the seven
exact QA-only checks. Production is untouched; frontend release remains
`9935d19e-4e4f-425f-aef1-3c08bfab60ed`.

The repeated original save now creates one QA draft, passing the office check.
Its custom line then fails because the frontend sends empty UUID strings for
optional catalog fields. That separate defect is PH5-SUPPLY-001; full draft save
is not yet PASS. One empty synthetic draft is tracked in the private test receipt
for reuse/cleanup; no request submitted or external order initiated.
