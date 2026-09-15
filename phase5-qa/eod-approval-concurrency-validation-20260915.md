# PH5-EOD-007 — stale approval reports success and duplicates history

Two authenticated QA regional-manager views opened the same labeled pending-
reapproval entry. The first approved it successfully. The second stale review
also displayed Approved, although the conditional update changed zero rows.
Readback showed unchanged counters/row audit but two identical reapproval-history
events. Evidence before/after is preserved in the private workspace QA reports.

Root cause: handleApprove checked only the returned error and then unconditionally
logged history/success. Its not-equal-approved condition also allowed overwriting
a different intervening state. The minimal fix matches the reviewed prior status,
selects the affected ID, and requires a returned row before logging. Zero affected
rows produce a clear refresh/review error through the existing error handler.
Roles, payload fields, history format and normal approval behavior stay unchanged.

- Nine focused handler tests: five PASS/four FAIL before; all nine pass afterward.
  Covers concurrent approvals, stale approved/rejected/reapproval state, valid
  pending/pending_review/reapproval transitions, and permission denial.
- All1104 retained frontend tests and production comparisons PASS, no skips.
- QA build/source/configuration verification PASS; no production credentials or
  server secret in the artifact. Headers/service worker unchanged.
- Entry index-DcLWadVr.js,8,821,877 bytes,SHA256
  329315c3724db3ca406ff1dff94e34f8a86e164d6bb9d21550b5495b4a810ec0.
- Archive SHA256
  f57a31ef4a8636f7d25c433e22e1aab72ccab41c411c73b56396f6563143b274.

QA publication and repeated two-view test PENDING. The existing labeled fixture
was edited through the authorized UI back to pending_reapproval for that test.
Bulk approval, rejection concurrency and atomic history persistence remain
separate audit cases; this repair covers the reproduced individual approval path.
