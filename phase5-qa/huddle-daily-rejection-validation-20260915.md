# PH5-HUDDLE-002 — stale Daily Review rejection overwrites newer approval

Reproduced with temporary huddle-reject-original A and two regional-manager QA
views: open Huddle Reject, approve through the EOD Queue, then submit the stale
rejection. The approved record became rejected, approved count fell 1 to 0, and
history incorrectly claimed a pending-to-rejected transition after approval.

Root cause: handleDRReject updated by ID alone. The targeted fix also requires
the reviewed status and a returned affected row before history, notification
or success. Rejection-specific columns and existing role/reason checks remain.
Eight actual-handler cases: four PASS/four FAIL before. Tests, publication and
live repeat pending. Production and operational providers are untouched.

Separate verified finding PH5-HUDDLE-003, not included in this repair: the same
live action claimed email notification despite a Failed to fetch warning from
sendDRRejectionEmail. Notification outcome handling and the dialog promise will
be corrected after this concurrency repair is deployed and verified.

All eight focused cases PASS after the repair. All 1187 retained frontend and
production-parity tests PASS, no skips. Build/source/environment checks PASS.
Entry index-DkQAsry5.js, 8,826,335 bytes, SHA256
69cf14a639a02961f3dc89cea0f17adee2f71f29fc5a9ca249534b2260836240.
Archive SHA256 ff3ae8367c1ee5262126ba0650c2de0933ac36ad5bdf5a4f5fc8593328e427bb.
Original pair cleaned; baseline counts restored, four/two audit events retained.

QA deployment 24e8c2ad-7d10-49e7-9c9e-33d8e23e148d from
8c8271c4f3d48a1df4bf294d50d83c510cf373c0 PASS; all 17 hosted checks PASS.
Live stale repeat reported Rejection Failed and preserved exact rows, histories,
audits and counters. Cancel closed the form. Normal B rejection saved the QA
reason once. Refresh showed Pending Approval 1 / Workflow Approved 1 / Rejected 1,
and Daily Reviews 1. Both temporary records had one history event. Cleanup
restored baseline counts, retaining three audit events each. Production unchanged.
The separately documented notification-feedback defect remains pending.
