# PH5-EOD-010 — stale bulk rejection overwrites a newer approval

Two QA regional-manager views loaded two labeled pending reports. The first
selected both; the second approved A. Submitting a bulk-rejection reason in the
first view changed A from approved to rejected and B from pending to rejected.
The UI claimed two rejections. A's new status-history event incorrectly described
pending→rejected. Refresh persisted approved=0/rejected=2. Original fixtures were
cleaned; four row-audit events for A and three for B remain recoverable.

Root cause: handleBulkReject updated selected IDs without matching their reviewed
status and then unconditionally logged/counting every selected ID. The targeted
fix matches each eligible report's reviewed state in one conditional request,
selects changed IDs, and logs/counts only those results. A completely stale
selection produces an explicit refresh/review error. Payload/permissions unchanged.

Twelve focused concurrency/permission cases: five PASS/seven FAIL before, twelve
PASS afterward. The four retained dialog cases also pass. Full suite/build and
live QA verification are pending. Production is unchanged.

All 1132 retained frontend/production-parity checks PASS, no skips. QA build and
source/environment verification PASS. Entry index-BBl_mzsP.js, 8,825,003 bytes,
SHA256 77f4c79cf8ac9b66629ee2fb03f970d2f15599dc03471fdf8e0da0beb4b050ab.
Archive SHA256 13dcc8eb205c2071f243011f70fb39b05dfceec8754fe584d5cb2323d382dc72.

QA deployment 3fd41d2c-4154-4059-8aa5-9b7719c7a675 from 6dfde76b5f succeeded;
all 17 hosted checks PASS, production unchanged. Live stale-selection repeat PASS:
A's approved row/history/audit snapshot was unchanged, while B was rejected once
with the exact supplied reason and one correct history event. The transient mixed
selection toast was not captured; the completed UI and resulting counts were.
The second wholly stale rejection displayed Bulk Reject Failed and a clear
refresh/review message. Full row/history/audit/count snapshots remained identical.

A separate normal pair verified the positive toast directly: Bulk Rejected / two
entries rejected. Refresh/readback retained both reasons, exactly one history
event and two row-audit events each. Both pairs were cleaned, restoring the
original one-pending fixture baseline; three row-audit events per fixture remain.
No production or real provider action occurred.
