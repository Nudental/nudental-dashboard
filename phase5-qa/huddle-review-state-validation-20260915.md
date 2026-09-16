# PH5-HUDDLE-009 — stale reject/unlock dialogs

QA live verification PASS; production unchanged.

Two independent two-view tests reproduced the defect on labeled synthetic Huddles:

- A stale Reject dialog changed a newly Unlocked Huddle to Rejected, recording a
  second state-change audit and reporting success.
- A stale Unlock dialog changed a newly Approved Huddle to Unlocked, likewise
  recording a second audit and reporting success.

Root cause: `handleReject` and `handleUnlock` in `huddle-approvals/index.jsx`
updated by ID alone and did not require an affected row. The focused repair adds
the reviewed status condition, requires one returned row, and translates a stale
result into refresh/review guidance. It follows the existing Approve guard without
changing roles, other workflows, or production configuration.

Source `d6a86a3f8d11f11f479f36ed5c4da6e39928f4ee`. Actual-handler regressions:
original 4 PASS / 12 FAIL; repaired all 16 PASS. Tests include four changed statuses
per action, duplicate reviewers, missing/invisible rows, permission denial, and
normal actor/reason/history/UI behavior. All 1,358 retained frontend tests PASS,
zero skips; QA build, 510 source-file parity and environment guards PASS.

QA release `70a2dd16-9e95-4d47-8e4a-3a6b7aee7ee4`, entry
`assets/index-DKSWzJNO.js`, SHA256
`1c9751bb482cc306073c69b71a1af368673394e1aea0b82c1784075cc11d2781`.
Both browser views confirmed that entry before retesting. Seventeen hosted checks
PASS. Previous QA `3585cd6c-c7fe-47e6-a683-a03b8e138e5a` remains recoverable;
production stays `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`.

Live retest: normal first actions succeeded; stale Reject/Unlock reached failure
feedback. Exact row and audit snapshots after each stale action equal the snapshots
after the first action, with one audit entry. All four original/repaired fixtures
are cleaned; evidence is retained in `qa-huddle-state-{reject,unlock}-{original,repaired}-20260915.json`.

The old Huddle `b8b304b1-0815-4ce2-baba-fdfc6f13ddf9`, linked temporary task
`ed8535da-728a-4424-9e26-4e76c5835150`, and EOD fixture
`1bd849be-d0f2-4a0f-8c55-68e431b2b2af` were also cleaned after the retained EOD API
suite passed 22/22 again. Four provider blocks, 19 checklist items and 11 Huddle
history rows followed existing deletion cascades; their full snapshots were saved
first. Seven general audit rows remain. Receipt:
`qa-original-workflows-cleanup-20260915.json`. Full UI refresh shows 0 awaiting
review, Morning Huddles 0 and Daily Reviews 0. The old fixture-dependent EOD and
Huddle readback helpers should not be rerun without preparing a fresh fixture.

This report covers the approvals-queue handlers, not an untested concurrency claim
for every other Huddle page. Remaining Phase 5 work continues separately.
