# Phase5 QA preparation and findings

See [hosted validation](hosted-validation-20260914.md) for the current status.
The new Supabase project is approved/provisioned; AUTH-002 and AUTH-004 now have
hosted before/after database evidence. Earlier statements below that project
approval or hosted schema/repair application is pending are historical.

This branch is not deployed. Production remains at the verified PH5-EXP-001
release. No production authentication, policy, data or runtime change accompanies
these candidates.

## PH5-QA-001 — sequence export precision

The first real offline schema execution failed because the browser JSON export
rounded bigint sequence maximum9223372036854775807 to9223372036854776000.
All seven sequences were re-read read-only with numeric settings cast to text.
The schema builder now rejects unsafe numeric JSON and preserves exact text.
Five focused tests pass. Generated schema.sql uses documented LF line endings.

The complete219-table,382-policy,12-view/one-materialized-view candidate executes
in PGlite0.5.8/PostgreSQL18.3 with minimal synthetic auth support. Production
Supabase uses PostgreSQL17.6; this does not replace real Supabase schema/grant,
Auth or PostgREST validation. No business rows or source sequence counters copied.

## PH5-AUTH-001 — shared API key does not establish user identity

An isolated FastAPI harness exercised the exact recovered verify_api_key,
list_offices and create_goal handlers with an in-memory synthetic service.
Missing shared key correctly returned401. With the synthetic valid application
key, a missing user identity, an invalid bearer token and an unauthenticated
synthetic goal write each returned200. Network, subprocess and production-data
access were blocked throughout. No live API was called.

Root cause: these route dependencies validate only the shared application key.
The existing OTP routes already use Supabase /auth/v1/user verification; reuse
that identity model when preparing the API repair. User/role/office enforcement
must be tested through the actual isolated API before any production consideration.
Status: reproduced in exact-handler isolation; API repair and live QA pending.

## PH5-AUTH-002 — self-service profile privilege changes

Copied row policies allow authenticated users to update their own profile without
protecting access fields. The copied signup trigger also accepts role directly
from caller-controlled user metadata. Offline tests reproduced ordinary-user
self-promotion, self-approval/reactivation, office reassignment and executive
access changes, plus deleting one's own profile and privileged signup metadata.
Seven security expectations failed in the original copied schema.

Candidate repairs/001-profile-access-boundary.sql adds a field-level trigger and
defaults new signup profiles to staff. The existing active admin/super_admin
administrative path and ordinary display-name edits remain supported. It requires
an explicit QA environment setting and the isolated dashboard_qa schema; it has
not been applied to production or hosted QA. Original row policies stay preserved
in schema.sql for before/after testing.

The candidate passes14 offline checks, including rejection with SQLSTATE42501,
normal profile persistence and audit-log readback. Every test identity is synthetic.
Live Supabase and browser checks remain required.

## PH5-AUTH-003 — invitation replaces the administrator session

An offline test using the actual installed Supabase SDK and the actual
usersService.invite method reproduced session replacement when signup returns a
session. The next privileged profile write ran as the invited user and failed
the new profile guard. The original result was1 failed/2 passed focused tests.

The candidate adds a separate nonpersistent signup client using the same validated
environment. The existing persistent administrator client continues the profile
write. No credential, provider, account or authentication architecture was changed.
All3 tests pass: immediate signup session, confirmation-required signup and failed
signup. No external request or real identity was created. Hosted QA UI verification
is still pending; this candidate is not deployed.

## Available tests and fixtures

PH5-AUTH-004 office-workflow candidate is documented in
[repairs/README.md](repairs/README.md). Eleven original office/active-user checks
failed across Huddles, checklists and tasks; the restrictive-policy candidate
passes all 17 offline checks. Production and hosted Supabase remain unchanged.

- Twelve planned identities cover all eight supported roles, a second-office
  manager/staff pair, an inactive user and an unapproved user. No hosted identities
  exist yet. Two offices and two provider records are synthetic, labeled QA.
-1104 role-permission settings reproduce configuration, not business records.
  There is no separate provider/read_only role in the current enum.
- Expanded runtime policy, simulation-adapter, schema-precision and fixture tests:
  38/38 on the existing Python3.14.6
  interpreter, with no skipped tests or network/production-file access. Temporary
  fixture databases were removed. The policy still requires transport/process
  integration; passing a validator is not live isolation proof.
- Frontend environment/header tests:28/28. Complete retained frontend suite with
  the invitation candidate:1042/1042 with no skips/failures. Invitation tests:3/3.
- The synthetic QA compile passes in44.31s. Its entry is8,819,954 bytes, SHA256
  a868466e7b779509f4fdb81e6bbe53cae47536fec8ad41e1fd09cd140c6be84c.
  Private verification finds neither actual production client credential in that
  entry. Banner, QA API and restrictive QA connection headers are present. This
  uses a nonexistent placeholder database and is marked DO-NOT-DEPLOY. It was
  never served. A sandbox resolver-access failure was retried with normal file
  visibility; there was no application build error in the successful run.
- Sensitive-operation simulations support durable readback, cancellation,
  concurrent idempotent retries and audit retention without provider execution.
  Route-level authorization and real application workflow integration are pending.

Install this directory's pinned development-only PGlite dependency with
`npm ci --ignore-scripts`. Run `node offline_database.cjs`, then
`node test-profile-boundary.cjs` for the original-schema negative control and
`node test-profile-boundary.cjs --repair` for the candidate. An existing private
test-tools installation can be selected with NDASH_QA_SQL_TOOLS_DIR. PGlite is
only an offline test engine, never the persistent QA environment or a replacement
for the selected isolated Supabase architecture. [PGlite documentation](https://pglite.dev/docs/)

## Blocking decisions

QA-DB-001: approval for the separate NU-Dashboard-Staging-QA Supabase Micro project
at an additional$10/month remains pending. Neither existing project can be reused.
The accounting-owner choice for official Expense reporting also remains pending;
the detailed aggregate reconciliation is preserved privately. Do not repeat
either pending question or choose financial authority by matching preferred totals.
