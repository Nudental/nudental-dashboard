# PH5-AUTH-015 — inactive/unapproved identities retained stock reads

Two twelve-identity matrices against only the synthetic stock row confirmed
inactive/unapproved staff still read stock after the inventory/audit boundary was
fixed. `bti_get_user_role()` ignored account state; stock and other Bone/Tissue
policies used that helper directly.

QA migration 022 adds the existing `dashboard_has_active_profile()` predicate to
the helper's profile lookup. It retains roles, office scopes, grants and security
mode. No identity, record, credential or production configuration changes.

30 offline PostgreSQL checks pass: original leaks, reads for allowed roles,
inactive/unapproved role rejection, denied inserts/updates, preserved admin
writes and unchanged fixture totals. All 22 QA migrations pass their 46
installation/non-QA rejection checks. Source
`03352ffe5025c8d04db18377db630f21da815c22` is pushed.

Installed only in `hvtxjfayenqnwtaisoaw`; saved query
`9df5cfe9-906e-42b4-bd81-c1537259aace` confirms the guard is present.
Live twelve-identity matrix PASS: inactive/unapproved now see zero stock;
authorized staff/manager/admin/super-admin retain the fixture; other office and
previously denied roles remain denied. Fixture remains one inventory row, six
audits, one stock row with seven units. UI refresh readback agrees. Receipts:
`qa-bone-stock-scope-{original,reproduced,repaired}-20260915.json`.

QA frontend/API and production/main remain unchanged by this database repair.
