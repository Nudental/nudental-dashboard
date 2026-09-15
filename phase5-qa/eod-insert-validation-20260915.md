# PH5-AUTH-005 — EOD insertion boundary, September 15, 2026

Scope: isolated Dashboard QA project `hvtxjfayenqnwtaisoaw` only. No production
policies, credentials, data, infrastructure or application deployment changed.

Reproduction before editing: real QA Auth/PostgREST requests created and persisted
four forbidden synthetic EOD submissions: staff in another office, staff claiming
another submitter, inactive staff, and unapproved staff. Three valid controls also
succeeded. All seven rows were removed after their exact IDs and labels were checked.

Root cause: `authenticated_users_insert_daily_entries` is permissive with
`WITH CHECK (true)`. PostgreSQL combines it with the more specific permissive
insert rule using OR, so the intended active-user and submitter checks cannot
restrict it. The original rule also omitted an office-scope condition.

Smallest repair: `repairs/004-eod-insert-boundary.sql` adds one restrictive INSERT
policy requiring the existing active/approved-profile helper, the caller as
submitter, and the existing `user_can_access_office` check. Existing policies,
role definitions and helpers are retained. SELECT, UPDATE and DELETE are not
changed by this repair; their broader audit remains in progress.

Offline PostgreSQL rehearsal reproduced the same four bypasses on the prior QA
schema, then passed all seven cases with the candidate. Fixtures rolled back.
Allowed inserts still produced exactly one audit event with the correct actor.

Deployment: the confirmed QA editor applied the policy and catalog readback
returned `dashboard_eod_insert_boundary / RESTRICTIVE / INSERT` exactly once.

Live verification: the identical seven Auth/PostgREST cases passed. Each forbidden
write returned HTTP 403 / SQLSTATE 42501 with no persisted row. Valid staff,
office-manager and regional-manager cross-office inserts remained supported.
Every temporary row was cleaned up; audit evidence was preserved.

Browser regression: the ordinary QA office manager received “Entry Submitted
Successfully” for a labeled test attestation. After refresh, all seven retained
audit/readback/edit/permission/cleanup checks passed. Fixture
`274d8d27-230d-42f0-9d1f-1a11b960e7dd` was removed and its three audit events remain.
The earlier PH5-AUDIT-001 fix remained effective. Phase 5 is still in progress.
