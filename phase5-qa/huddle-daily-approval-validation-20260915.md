# PH5-HUDDLE-001 — stale Daily Review approval records false success

Reproduced in hosted QA using two ordinary regional-manager views of labeled
temporary report huddle-approve-original A. The EOD Queue approved it first.
The already-open Huddle Daily Review then reported approval again: history grew
from one event to two while the row audit stayed at two events and the row was
already approved. No production records or external services were used.

Root cause: handleDRApprove in src/pages/huddle-approvals/index.jsx excluded only
approved rows, did not request the affected row, and unconditionally wrote
history and reported success. It could also overwrite another intervening state.
The targeted fix requires the reviewed status and a returned row before history
or success. Existing role checks, actionable states and field mapping remain.

Eight focused actual-handler cases: four PASS/four FAIL before repair. Covers
stale states, concurrent reviewers, normal approval/reapproval and permission
denial. Full verification, QA deployment and live repeat pending.

All eight focused cases now PASS. All 1179 retained frontend/production-parity
checks PASS with no skips. QA production build, source comparison and environment
checks PASS. Entry index-BEs7-UJv.js, 8,826,092 bytes, SHA256
da4fcf6732bf0bd7ff0778eb616e421e0bf80829b5f7fe66f072ba1f48db42a4.
Archive SHA256 9fc42ff23a4f1a4f8ad4bf6f7f2a2bd144fe740e2fcced78996c380b34253e10.
The original fixture pair is cleaned and baseline counters restored; retained
row-audit events total three/two for A/B. QA publication/live repeat pending.

QA deployment 6f9d70d2-18c4-4e63-8b1e-99e1699c97ea from
7c3ffe3d4ffe3d68356350077cea3207b1f16052 succeeded. All 17 hosted checks PASS;
production deployment remained 1f1f91bc-5dbd-4500-8bfd-d4e2039ba601.
Live repeat PASS: stale approval reported Approval Failed with refresh/review
guidance; exact row/history/audit/count snapshots stayed unchanged. Cancel closed
the stale review. Normal B approval with a QA note succeeded. Refresh showed
Pending Approval 1 / Workflow Approved 2 and Daily Reviews 1. Both temporary
records had exactly one history event each, and cleanup restored the baseline
while retaining three row-audit events per fixture. No production writes.
