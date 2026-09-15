# PH5-AUTH-007 — EOD history accepts unauthorized or forged reviewer identities

Thirteen real Auth/PostgREST checks against isolated QA reproduced seven bypasses:
staff forged a regional reviewer, staff/office manager wrote approval history,
staff wrote across offices, and a regional reviewer forged another actor, role
or display name. All inserted records were explicitly labeled synthetic; each
was removed immediately and its row-audit evidence retained. Inactive/unapproved
profiles were denied, and all four existing approval roles wrote valid history.

Root cause: the original INSERT policy checks only is_active_user(). It does not
check the approval role, writer identity or linked report's office. Existing EOD
and Huddle Daily Review writers supply current user ID, role and name consistently.

The candidate adds one restrictive INSERT policy, retaining existing policies and
history. It requires an active/approved profile, one of the four existing approval
roles, matching authenticated ID/role/display name (with existing email fallback),
and access to the linked report's office. Trusted service writers and SELECT policy
are unchanged. This is an isolated QA repair, not a production policy deployment.

Offline copied-schema verification passes 17 write checks and seven retained read
checks. It reproduced the seven hosted bypasses plus the legacy helper ignoring
is_active when status still says Active. The new active-profile check blocks that
inconsistent fixture too. All offline fixtures were rolled back. Hosted rollout
and live retest pending.

This policy addresses writer identity and office authorization. It does not make
status/history writes atomic or certify historical claims by an authorized writer.

Applied only to QA project hvtxjfayenqnwtaisoaw, with the completed installation
marker checked first. The catalog confirms exactly the new RESTRICTIVE INSERT
policy. Saved migration SHA256:
bb6a5d322b365b53a96b53a680c29137fb117c410d1ed66cc21328290e2140b9.

All thirteen real-account write checks now pass; all seven bypasses are denied.
Seven separate real-account visibility checks also pass: own-office staff and
managers retain history, regional read remains available, other-office and
inactive/unapproved users remain blocked. All temporary probe records cleaned.

Normal browser approval through both EOD Queue and Huddle Daily Reviews succeeded
and refreshed correctly. Each wrote one history entry with the current regional
reviewer's identity, one row update and accurate counters. Both UI fixtures were
cleaned, the original baseline restored, and three row-audit events each retained.
The frontend release remains a833b27e; no frontend, API-runtime or production
deployment accompanied this QA database rule.

Post-change read-only API regression: all 22 EOD office/role checks and all 15 identity/execution-boundary checks PASS.
