# PH5-AUTH-014 — Bone/Tissue inactive-account and audit scope leaks

Two live twelve-identity read matrices against only the synthetic QA record
showed inactive/unapproved staff could read inventory and audit history. Office B
staff/manager could not read the Office A record but could read all its audit rows.
Root causes: existing inventory helper/policies omitted active approval checks;
the audit SELECT policy checked role without following the parent office scope.

QA migration 021 adds two restrictive ALL policies. Inventory now requires the
existing `dashboard_has_active_profile()` predicate. Audits require a parent
inventory row visible through RLS. Existing permissive role/office grants remain
unchanged, including roles which previously had no access. No record changes.

44 offline PostgreSQL checks pass, covering original failures, account/role/office
reads, prohibited creates/updates, allowed own-office writes, cross-office move
rejection, anonymous denial, and rollback. All 21 migrations coexist and reject
non-QA installation (44 installation checks pass).

Source `5af3e61703333772a188acbba7d371a0205c041e`; installed only in
`hvtxjfayenqnwtaisoaw`. Saved SQL receipt
`7ef986e4-977b-4b74-85a7-7ac6f6c67672` confirms both RESTRICTIVE ALL policies.
Live repaired twelve-identity matrix PASS: active allowed roles retain the
record/two audits, Office B and inactive/unapproved accounts see neither.
Four unauthorized no-op PATCH attempts affect zero records; exact record and
audit snapshots remain unchanged. No frontend deployment was required.

Receipts: `qa-bone-scope-{original,reproduced,repaired}-20260915.json` and
`qa-bone-denied-writes-20260915.json`. Temporary fixture remains for remaining
inventory tests. Production/main/QA API are unchanged. This does not claim new
stock-table, attachment, or import permissions have been tested.
