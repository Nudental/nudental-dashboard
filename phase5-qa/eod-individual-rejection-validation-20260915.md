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
