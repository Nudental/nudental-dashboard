# Authorized EOD approval workflow — September 15

Existing synthetic regional_manager tested the isolated hosted QA frontend/API.
One newly labeled entry was created by the existing office_manager identity.
The original older pending QA readback fixture was preserved throughout.

Verified live:

- New pending entry appeared exactly once; pending counter1→2.
- Review/approve persisted, pending2→1 and approved0→1; one correct actor/history
  event and one row update audit.
- Approved-entry edit required a reason. Cancel discarded the unsaved notes.
- Saving notes with a reason moved approved1→0 and pending_reapproval0→1,
  persisted the edit and recorded one event/audit.
- PH5-EOD-006 repaired missing reapproval controls in Review; reapproval through
  the repaired modal persisted with correct counters and event type.
- PH5-EOD-007 repaired stale-view duplicate history. The repeated two-view case
  now gives one success and one clear conflict error; the second attempt changes
  no record, counter, row audit or status history.
- Reject After Approval required a reason. The saved reversal persisted after
  refresh, approved1→0/rejected0→1, and appeared in the visible status history
  with the regional-manager actor and QA reason.
- Exact-fixture cleanup succeeded and restored initial counters. Eight row-audit
  events retained. Temporary status-history rows followed the existing cascade;
  before/after evidence was saved first.

Fixture e1d11315-b4c9-4bab-b218-2bb28587fad7 is cleaned. No production records,
financial postings, provider sync or real recipient delivery were used. The
analytics trigger remains disabled. Rejection notification delivery is not
certified by this workflow test; the only target identity is a reserved
nudashboard.example.test address in the isolated QA project.

Remaining separate checks include bulk approve/reject, stale rejection/edit
handling, history-write failure behavior and other ordinary-role workflows.
