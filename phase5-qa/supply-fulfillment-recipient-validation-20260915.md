# Manual fulfillment recipient

PH5-SUPPLY-005 — PASS, isolated QA, September 15, 2026.

Typing an existing QA user's name into Received By failed twice with invalid
UUID syntax. Zero records/audits were created. The form used unrestricted text
for a column that references user_profiles.id.

The field now selects an existing user by display name and stores that user's
ID. The small lookup reads only id/full_name and filters active, approved profiles
with Active status, under existing database permissions. No account, permission,
credential or database schema changes. The optional “Not recorded” choice stays
available, and lookup failures are visible.

Six actual-component/service tests: original six fail; repaired six pass. All
1,420 retained frontend tests pass, zero skipped. QA build, complete 510-file
parity, environment checks and 17 hosted checks pass.
Source `95e18979810130ff298dc399e58c838c0f117954`; QA release
`c5668e5e-7981-415b-ab1d-76a4a18e2ba7`; entry `assets/index-DjMPDhZm.js`,
8,830,315 bytes, SHA-256
`6932fb7c5ed689083e652de86c0952b495849b26060f7ba77443b6ac6b22fa00`.
Previous QA `197a2037-175f-42d9-a4bd-aa06115a8b73` is retained.

Live selector shows ten active QA identities, excluding inactive/unapproved
accounts. Selecting QA / Super Admin and repeating the original save reported
success. Readback confirms exactly one labeled record, the expected user ID,
local date September 15 and one creation audit. Full reload still shows one row.
Exact-ID/name/office cleanup removed the fixture, preserving creation/deletion
events. No linked inventory/request item was changed. Production is unchanged.
