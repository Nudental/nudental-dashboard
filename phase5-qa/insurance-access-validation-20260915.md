# PH5-AUTH-013 — insurance API scope

QA live verification PASS; production policies unchanged.

Two read-only matrices of 12 existing QA identities reproduced unauthorized reads
of a synthetic Office A request, its draft and three audit entries. Staff lacking
`workflow.insurance.view`, Office B identities, inactive and unapproved accounts
all received the rows. Twelve no-op write probes from six unauthorized identities
also returned the request/draft as writable. Values were preserved throughout.

Root cause: the three insurance tables had unconditional authenticated permissive
policies, independent of the UI's role check and office scope.

`020-insurance-access-boundary.sql` adds three restrictive policies. Requests
require the existing active/approved profile gate, `user_can_access_office` and
existing `workflow.insurance.view` grant (or super admin). Drafts and audit rows
must reference a request visible through that policy. The same boundaries apply
to inserts and updates. Existing role grants and data remain unchanged.

Source `f77bd19da1e99a56955f707e572df3f9adc9ec5d`. Fifty isolated PostgreSQL checks
PASS; 42 migration checks PASS across 20 migrations. Tests cover original leaks,
authorized access, office boundaries, inactive/unapproved/anonymous denial,
forbidden draft inserts and cross-office relinking, permission revocation and
unchanged fixture values.

Applied only to `hvtxjfayenqnwtaisoaw`; saved SQL receipt:
`b78d853e-c08d-4754-990e-d132ae216e6c`. Three RESTRICTIVE ALL policies confirmed.
The live 12-identity matrix now returns zero unauthorized rows. All 12 prohibited
no-op updates affect zero rows; six authorized administrator/office-manager/verifier
no-op updates retain access. No fixture values changed. The authorized UI then
completed the same synthetic verification and recorded `form_completed`; refresh
shows completed, read-only fields and no Save Draft/Mark Completed actions.

This addresses page/office/profile access, not every possible action-specific
grant or audit-integrity rule. External insurer, email and Dentrix operations were
not executed. Frontend remains `3585cd6c-c7fe-47e6-a683-a03b8e138e5a`; no frontend
or production deployment was necessary for this database-only QA repair.

Private operational receipts outside Git: `qa-insurance-scope-{original,reproduced,repaired}-20260915.json`,
`qa-insurance-writes-{original,repaired}-20260915.json`.
Fixture cleanup remains pending while the insurance PDF check is underway.
