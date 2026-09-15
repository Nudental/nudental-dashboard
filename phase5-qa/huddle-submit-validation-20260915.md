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

First hosted candidate 8da890c6 passed static checks but produced a blank QA
page, so it was not accepted as live verified. Last verified files were restored
through the existing publisher as 37eafbcf. Production was unchanged. The first
artifact renders and authenticates in the same QA configuration on loopback;
hosted identity/gzip bytes and JavaScript syntax match. The exact hosted startup
cause remains unproven. No additional submission occurred.

A fresh equivalent candidate reverses only the order of the two editable status
values; membership and behavior are unchanged. All 1238 tests pass without skips,
and all 510 source files match the build input. Environment/secret checks pass.
Entry index-CDEarjji.js, 8,827,762 bytes, SHA256 ff53e7e02fc16b174d25cfbd46bfc02b52baad8d2f9d065bec0b37917ecdbbca.
Archive SHA256 991fe63e856c4a6878f30a95fc1490d8ab04db4a3c98f918d80bb0157a44d550.
Browser controls became unavailable before publication. Candidate publication
and original two-view live retest remain pending; QA stays on verified 37eafbcf.
Temporary diagnostic tabs were signed out/closed; ports 8772/8773 no longer listen.
