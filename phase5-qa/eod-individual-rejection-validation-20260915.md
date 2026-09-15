# PH5-EOD-011 — stale individual rejection replaces a newer approval

In two QA regional-manager views, A was opened for Review while pending, then
approved by the other view. Rejecting from the stale Review replaced the newer
approval with rejected. The resulting history claimed pending→rejected, omitting
the actual approved source state. Persisted counts changed approved 1→0/rejected
0→1. An empty rejection reason correctly caused no mutation before this test.

Root cause: handleReject matched the ID only and did not inspect affected rows.
The targeted change matches the reviewed prior status and requires the returned
ID before history, notification or success. Other payload/role behavior unchanged.
Nine focused tests: five PASS/four FAIL before, nine PASS afterward. Covers three
valid pending states, changed statuses, concurrent reviewers, empty reason and
permission denial. Original synthetic pair was cleaned; audit evidence retained.

Full regression/build and QA live repeat pending. No production release requested.

All 1141 retained frontend/production-parity tests PASS, no skips. QA build and
source/environment verification PASS. Entry index-BvFW40U1.js, 8,825,220 bytes,
SHA256 e353ce398aba716c1dd0c809b4d6fa897407c4f6aa67b3fe575029000d58e21d.
Archive SHA256 9647cd2aa99965b7ce785d39e6b44c053802a5ad3f565f3afe90f1066d6c2b13.

QA deployment 6cc0e01e-1430-4947-a626-ad5216c1ab27 from d91742d0c3 succeeded.
All 17 hosted entry/environment checks PASS, production unchanged. The original
two-view test now shows Rejection Failed with a clear refresh/review message;
complete row/history/audit/count snapshots are identical before/after: PASS.
A normal rejection of B displayed Rejected and persisted the correct reason,
one history event, two row audits and approved=1/rejected=1/pending=1 after refresh.
Both fixtures were cleaned and the original counts restored; three audit rows
remain for each test record.

Separate issue observed: the success text claimed the Office Manager was notified
despite the QA email request logging Failed to fetch. No external delivery is
claimed by this audit. Notification outcome feedback needs a targeted repair;
the current guard repair covers only the stale transition.
