# PH5-HUDDLE-008 — Duplicate Morning Huddle approval

Two QA Super Admin views opened the same submitted synthetic Morning Huddle for
review. The first approved it, saved the reviewer and timestamp, wrote one audit
history entry, and reduced Morning Huddles from 1 to 0. The stale second view
also succeeded, overwrote the approval timestamp, and appended a second approval
entry. Evidence is retained in `qa-huddle-review-ui-20260915.json` outside Git.

`handleApprove` in `huddle-approvals/index.jsx` filtered only by ID and did not
require an affected row before recording success/history. The targeted change
requires the reviewed status and one returned row. A stale view receives refresh
and review guidance. Existing permissions, approval fields, review modal,
notifications and production configuration are unchanged.

Eight actual-handler tests: original code passes two and fails six. Tests cover
four newer states, duplicate reviewers, missing/invisible rows, normal approval,
and permission denial. All eight now pass, together with all 1,255 retained
frontend regression tests, zero skips. QA build and all 510 source-file parity
checks pass.

QA deployment `d58333fb-9b2e-42d6-b04c-d3810721062e` from source
`b69bd2661053946daec5c1fc03f42d4d7cc2bd1e` passed. Both browser views verified
`index-Bp307bP2.js`, SHA256
`95339e881f9d68df87712cc7b516ccbc6c8abddc32911c78a42bb8589b988a30`.
All 17 hosted health, boundary and unchanged-production checks passed.

Repeated live test PASS: first approval saved once; the second view displayed
Approve Failed with refresh/review guidance. Exact row and history snapshots
remained unchanged, with one approval entry. The new synthetic Huddle was cleaned
after evidence capture in `qa-huddle-approval-repaired-20260915.json`. Previous QA
release `ab3fe6f4-ffe3-4eb2-91a9-d5868d9df226` remains recoverable. Production
deployment remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`.

Prior reviewer UI checks passed addendum save/readback/history, unlock mandatory
reason and cancel, unlock persistence after refresh, and resubmission history.
The original Huddle remains tracked for final cleanup. No production data changes.
