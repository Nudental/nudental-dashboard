# PH5-EOD-006 — review modal omits reapproval controls

An authorized QA regional manager approved a labeled temporary entry, then edited
its notes with the required reason. The entry correctly moved to pending_reapproval,
but opening Review showed no note field or approval actions. The table's separate
Quick Approve action was present. The modal's two guards included only pending
and pending_review, despite handleApprove already supporting reapproval history.

The targeted repair adds pending_reapproval to those two existing conditions in
pending-approvals/index.jsx. API-synced rows, completed states, and role boundaries
remain unchanged. No database, handler, calculation, or execution change is made.

- 16 focused control checks: 14 PASS / 2 FAIL before; all16 PASS in the candidate.
- Full retained frontend suite and production comparisons:1095/1095 PASS, no skips.
- Existing QA build/configuration PASS. Source inputs match; response policy and
  service worker are unchanged. No production credentials or server secret appear.
- Entry index-CXBWwkIN.js,8,821,709 bytes,SHA256
  b85aa5fce1f2f4e64ac3854039df021f0dc8c32cda5dc59a890eef1494809bb2.
- Archive SHA256
  16a00910917650968ce9bf35f40fe66933eae2e52d1bc4836fe9e9616d2195ec.

QA deployment b50c0f45-c19d-400b-a307-c967393dadbe succeeded from f7950fa5.
17/17 hosted checks PASS; production deployment remains unchanged. Both QA test
views now show the note and Approve/Reject controls for pending reapproval.
Approving through Review persisted as approved, updated the counters, and added
one reapproval event with the correct regional-manager actor: live PASS.

The subsequent stale-view repeat exposed a separate duplicate-history defect,
now being repaired. The fixture is tracked by eod_approval_flow_fixture.py and
will be cleaned after the repeat/rejection checks. Earlier releases are preserved.
