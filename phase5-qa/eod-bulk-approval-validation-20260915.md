# PH5-EOD-008 — bulk approval counts and logs unchanged reports

Two QA regional-manager views loaded a pair of labeled synthetic pending reports.
One view selected both; the second approved A. Bulk Approve in the stale first
view claimed two approvals, although only B changed. A gained a second history
event without a second database update. Readback: A history 1→2, row audit 2→2;
B history 0→1, row audit 1→2. Both original fixtures were cleaned, counters restored,
and three audit rows per fixture retained. No production data was connected.

Root cause: handleBulkApprove used selected IDs for both history and success count,
and excluded only the approved status. This could also replace other intervening
states. The targeted correction matches each selected report's reviewed status,
requests the affected IDs, logs only those IDs, and reports actual approvals plus
skipped reports. An entirely stale selection produces a refresh/review error.

- Twelve focused handler tests: five PASS/seven FAIL before, twelve PASS after.
- All 1116 retained frontend/production-parity tests PASS, no skips.
- QA production build and source/configuration checks PASS; header/service-worker
  files unchanged, no production client credentials or server secret present.
- Candidate entry index-UwsoQ7-0.js, 8,822,645 bytes, SHA256
  fddbf388685bf78ec22726d24a09498fed6d3ff7575819d541e7720e01733de9.
- Archive SHA256 c05405921773b3be7e713d1c49c322c17b235a9b06a4258d541677f09f481649.

QA deployment and fresh live repeat pending. Production deployment is not requested.
Bulk rejection and other stale-write paths remain separate, unverified cases.
