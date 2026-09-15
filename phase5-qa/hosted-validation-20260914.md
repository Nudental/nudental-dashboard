# Hosted Dashboard QA validation — September 14, 2026

Only NU-Dashboard-Staging-QA (`hvtxjfayenqnwtaisoaw`, NU Dental, us-east-2,
Micro) was changed. The owner approved the additional $10/month and completed
the private database-password and creation-confirmation steps. Production and
the Collaboration QA project were not modified.

## Structure installation

The reviewed schema SHA256 is
`373191f4cbadfaf2fb7fe0ff737ec8257ab1a7407a1797e502c2106922e203fc`.
The SQL editor rejected the complete 1,211,561-byte file as too large. A
PostgreSQL parser split it at complete statement boundaries into 26 transactions,
each below 48KB. An installation marker verifies the project, source hash,
preceding batch and empty Auth before every subsequent batch. All 26 committed
checkpoints were read back. Offline rehearsal also rejected duplicate execution.

Hosted PostgreSQL 17.6 contains 219 public tables, 382 original policies,
12 views, one materialized view and 112 functions. Catalog comparisons matched
relation definitions/grants, constraints, indexes, triggers, policies, views and
enums. Column names, order, types, defaults, ACLs and other attributes matched;
the fresh clone compacts internal ordinal gaps from dropped columns in two
source tables. The 110 non-mocked functions and their grants matched after
normalizing Windows paste CRLF to LF. All seven bigint sequence definitions
match exactly; sequence current values were not copied.

Two outbound notification functions intentionally write QA execution intents.
Their hosted bodies contain that adapter and no HTTP call. pg_cron and pg_net
were intentionally omitted. No jobs, vault values, provider credentials or
business records were copied. Automatic table exposure was disabled at creation;
the schema's reviewed explicit grants and policies were then applied.

## PH5-AUTH-002: profile access fields

Before editing, a hosted transaction with a temporary staff identity successfully
promoted that identity to super_admin: `UNSAFE_SELF_PROMOTION_ALLOWED`.
Rollback and a fresh query confirmed zero auth users and profiles.

Applied `repairs/001-profile-access-boundary.sql` only to QA. The editor's
destructive-operation notice was reviewed: its DROP TRIGGER IF EXISTS named a
guard verified absent, and no business data existed. The resulting trigger count
was one. The identical self-promotion test then returned `DENIED`.

Eleven additional copied-schema role checks all matched expectations on hosted
QA: self-promotion, self-approval/reactivation, office/executive grants, another
user's profile and role-permission edits, and self-deletion were denied; own
display-name edits and active admin/super-admin management remained allowed.
These are real database role/claim probes, not browser/Auth/PostgREST tests.
Hosted committed persistence, signup metadata and UI checks remain outstanding.

Subsequent real Auth/PostgREST verification completed eight checks: self role,
executive and office grants returned HTTP403/SQLSTATE42501; direct self office
assignment updated zero rows; own display-name edit committed and read back,
created exactly one audit entry, kept one profile and restored successfully.
Creating each synthetic identity with privileged signup metadata still produced
a staff profile before the separate trusted fixture assignment. UI checks remain.

## PH5-AUTH-004: office workflow access

The unchanged hosted schema failed 11 of 17 existing expectations across
Huddles, tasks and checklist items. Overlapping permissive policies allowed
cross-office actions and inactive/unapproved access. All synthetic fixtures and
individual writes were rolled back.

Applied `repairs/002-office-workflow-boundary.sql` only to QA; all three
restrictive policies were read back. Repeating the exact 17 cases passed 17/17.
Assigned staff updates, own-office manager reads and regional-manager all-office
reads remain supported. Browser/API, committed persistence and broader role
coverage remain outstanding.

The reusable hosted probe generator extracts the existing offline case arrays.
It requires the completed, empty QA project, uses only synthetic IDs and labels,
rolls back each action inside a subtransaction, and finally rolls back all
fixtures. Results use transaction-local settings, not a shared results table.
Offline rehearsal matched the hosted before/after office outcome and verified
zero leftover users/offices. No production release accompanied either repair.

## Access and remaining work

The restored SSH key and strict known-host check work on the new Work computer.
Production read-only health passed: frontend/API HTTP 200, three existing
services active, all 15 captured backend modules unchanged and the existing
frontend entry hash unchanged. The signed-in production browser loads Executive
Overview normally. Supabase, Cloudflare, GitHub, Rocket and Dashboard browser
sessions are available.

The isolated API/frontend are not yet deployed. Dedicated Auth identities,
synthetic persistent fixtures, full transport/process isolation, complete API
role/scope enforcement and write-workflow verification remain required.
The API identity candidate passes 13 focused tests and 51 total server tests;
the frontend session helper passes six focused tests and all 1048 retained
frontend checks. These candidates are not evidence of a deployed API repair.
The Expense accounting-owner decision remains pending. Phase 5 is not complete.

## Subsequent fixture and build checkpoint

All 12 planned identities now exist in the new project and pass real password
login and profile readback. Two synthetic offices, two providers and the 1104
source-derived role settings are seeded. Generated credentials are saved only in
a protected local folder; no invitations or other external email were sent.
These are intended persistent QA fixtures. The earlier rollback-only SQL probes
require an empty database and must not be rerun against the now-seeded project.

The identity resolver also passed 13 real-QA Auth/profile checks: ten active
identities accepted, inactive and unapproved identities rejected, and an invalid
session rejected. This still does not verify the undeployed route authorizer.

The real QA frontend configuration compiles in44.02s. Entry index-B3Bm4t1F.js is
8,821,490 bytes, SHA256
18aa4fc2925beb6ca0ddc48e79357de6b3c00edd88d656b52dcf4aa0f09b081f.
The artifact has the QA banner and QA-only connection policy, contains no server
secret and neither actual production client credential. It remains undeployed.
A loopback preview showed the QA banner and login page; no successful QA browser
login or application write has been claimed yet.

The normal server account has no passwordless sudo, and an unprivileged user/
network namespace attempt was denied. DigitalOcean administrator sign-in was
requested for isolated service setup; no server isolation protections were
weakened. On September15 the SSH connection and production services were still
healthy, and the production browser still loaded Executive Overview.
