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
checks pass. Deployment and the repeated live test remain pending.

Prior reviewer UI checks passed addendum save/readback/history, unlock mandatory
reason and cancel, unlock persistence after refresh, and resubmission history.
The original Huddle remains tracked for final cleanup. No production data changes.
