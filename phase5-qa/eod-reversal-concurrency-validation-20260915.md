# PH5-EOD-013 — duplicate reversal claims success and appends history

Two QA regional-manager dialogs opened the same approved synthetic report. The
first changed it to rejected_after_approval and recorded one reversal. The stale
second dialog also showed Approval Reversed and attempted notification, although
the conditional update changed no row. History grew 2→3 while row audit stayed
3 and status/reason/counters stayed unchanged. Original evidence is preserved;
both labeled fixtures are cleaned and the initial counts restored.

Root cause: handleRejectAfterApproval checked its database error only. The
existing ID/approved-status condition is retained; the change selects the affected
ID and requires it before history, notification and success. A stale result now
uses the existing error path with an explicit refresh/review message.

Eight focused cases: three PASS/five FAIL before, eight PASS afterward. Includes
concurrent/stale approvals, valid reversal, blank reason and role denial. All
fourteen notification-result checks continue to pass. Full build/regressions and
live QA repeat pending. Production unchanged.

All 1163 retained frontend/production-parity checks PASS, no skips. QA build and
source/environment verification PASS. Entry index-DS34qJ8q.js, 8,825,710 bytes,
SHA256 dcfa9cb82963c365b2c97f800910abfb9ce61e55dc3112121c2543e8157b4de7.
Archive SHA256 dbf7bd447d33b3107d821776135c93f91b7d39a04b0f54ce22c27a4d1269608b.

QA deployment 30e7762d-fb00-4379-a7c9-a95a9c246387 from d535651adf succeeded.
All 17 hosted entry/environment checks PASS and production remained unchanged.
Live two-reviewer repeat PASS: the first reversal saved its exact reason and one
history event; the stale second dialog showed Reversal Failed with a clear
refresh/review message. Complete record/history/audit/counter snapshots matched
before/after the stale attempt and refresh. Cancel closed the stale dialog.
Both fixtures were cleaned, original counts restored, and four/two row-audit
events respectively retained. No live provider delivery was attempted.
