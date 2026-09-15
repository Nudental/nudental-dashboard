# PH5-AUTH-010 — Huddle review roles bypassed through the API

The existing Huddle Approvals page admits only super-admin, admin, regional
manager and regional clinical manager. Its ordinary Huddle page separately
permits office managers to edit and unlock submitted Huddles.

Eight hosted Auth/PostgREST probes used newly labeled temporary QA records.
Four permission expectations failed: an office manager could approve, reject,
or set approval identity, and ordinary staff could approve. Cross-office denial,
legitimate admin approval, manager content edits and submitted unlock remained
correct. Independent readback confirmed every write. All eight fixtures were
cleaned up; detailed before/after evidence is retained outside source control in
`qa-huddle-review-permission-original-20260915.json`. Production was not contacted.

Root cause: the recovered `huddles_update_office_scoped` and other permissive
policies grant office writes without distinguishing review fields. The existing
active/office boundary also does not distinguish those fields. Hiding the review
page therefore does not enforce its reviewer requirement at the API.

Candidate `011-huddle-review-permission.sql` adds one QA-only INSERT/UPDATE trigger
that requires an existing reviewer role for approval/rejection states and their
metadata. Nonreviewers also cannot clear a reviewed state. Existing manager draft
submission, content edits and unlock of submitted Huddles remain available.
The trusted fixture/import path and existing active/office policies are preserved.

The in-memory PostgreSQL negative control reproduces 13 bypass cases. All 32
repaired checks pass, including the four reviewer roles, ordinary edits, inserts,
submitted unlock and cross-office denial. All test transactions roll back.

Deployed to the existing isolated QA project after browser access returned.
SQL snippet `734a7d11-ddcb-4469-8ad2-48dbfd9f152e` confirms the trigger enabled.
The identical eight Auth/PostgREST cases now **PASS**, with no unexpected allows;
all temporary fixtures were cleaned up. The ordinary manager Huddle history page
still loads the original draft with the expected office and date. No production
policy or data changed. Broader reviewer UI lifecycle testing continues separately.
The separate concurrent-submit frontend candidate remains pending its own live
verification and must be verified independently.

Combined installation rehearsal also PASS: all twelve QA repair migrations
install together, both new scripts reject execution without the QA environment
setting, and the pre-existing disabled EOD analytics trigger stays disabled.
No business rows are created by the repair migrations.
