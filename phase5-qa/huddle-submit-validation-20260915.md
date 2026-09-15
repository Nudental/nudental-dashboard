# PH5-HUDDLE-007 — Concurrent Huddle submissions duplicate history

Two QA office-manager views reviewed the same labeled draft Huddle. Both Submit
Huddle actions completed, the saved status became submitted, and two submit
history entries were written with the same actor. Before/after evidence is
preserved in qa-huddle-submit-original-20260915.json outside the repository.

huddleService.submitHuddle updated by ID alone. The one-line repair requires the
saved status to remain draft or unlocked, matching the existing UI's submit
states. The existing single-row response now rejects the second update before
history/notification work. No new transition, review rule, provider, recipient,
policy or production configuration was introduced.

Seven actual-service tests: three PASS/four FAIL before, seven PASS after. Tests
cover concurrent submission, both editable states, submitted/approved/rejected
rows and permission denial. Provider calls are mocked in these offline checks.
All 1238 retained regression checks PASS, no skips. QA build, 510 source-file
comparisons and environment/secret checks PASS. Entry index-lYXBvnC-.js,
8,827,762 bytes, SHA256 91cf873794c82c8e8c996401ac7eb6b5aed92349490bc9f7259baa36d30083c1.
Archive SHA256 c4421500e00239cc425137b5443ebe2df865921363bba7e1cf45870483cf7f6a.
Publication and live verification pending. Only the tracked disposable Huddle was
restored to its saved draft/submission-field baseline for the identical retest;
both original submit history entries and before/after snapshots remain preserved.

The isolated schema has no notification_events table (PGRST205), although the
legacy service attempts an optional insert there. That existing optional path
and QA-only unavailable mail functions were not changed as part of this repair.
The actual Huddle row and narrative audit are the submission evidence.
