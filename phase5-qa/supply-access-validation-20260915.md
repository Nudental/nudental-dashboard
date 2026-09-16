# Supply request account, office and page boundary

PH5-AUTH-016 — PASS, September 15, 2026.

Two live 12-identity matrices reproduced broad reads: all actors could read the
Office A synthetic request; after its line save, all could also read the item.
This included inactive/unapproved accounts, Office B users, and roles without
the section grant. The copied request/item SELECT policies were `USING (true)`.

Migration 025 adds restrictive policies to these two tables. Requests require
an active approved profile, existing office access resolved from the stored name,
and the current Front Desk or Clinical Supply section permission. Items follow
their parent's RLS. No roles, permission settings, records or production policies
were changed. This does not claim complete action-specific write authorization.

Database tests: 61 focused checks PASS; all 25 migration installation guards and
coexistence: 52 checks PASS. Source `1816ad8c3df65cb38e1187369cf3fba49cf17d79`,
pushed. Applied only to QA `hvtxjfayenqnwtaisoaw`; saved SQL receipt
`8fafe9e2-2241-4566-936c-c629d62e6d3a` shows two restrictive ALL policies.

Live: Super Admin and the Office A manager retain request/item read access under
the unchanged permission settings. The other ten identities receive no rows.
Twenty denied batch/item PATCH attempts return no affected records; exact before/
after records are unchanged. Authorized Super Admin edit to the test note v3
still shows "Draft saved". Quantity remains 3, one draft/one line.

Frontend remains QA `f4288986-8ab1-4d3b-8d4f-69e48bc9d28d`; production is unchanged.
The test draft remains for the audit/workflow checks and must be cleaned afterward.
