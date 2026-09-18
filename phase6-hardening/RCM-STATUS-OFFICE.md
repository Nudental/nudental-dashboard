# RCM daily-summary status office dependency

Candidate verified; deployment is tracked by fresh Pages receipts.

The RCM Dashboard receives the selected office, but its Data Source Status child
did not receive that prop. The service always passed null to the daily-summary
API. Five of six synthetic source tests reproduced the missing office boundary;
the existing all-office case passed.

The two-file repair passes the office prop through the existing callback to the
service and resolves it with the existing office mapping. Unknown selections
fail before any API request. Unselected/all-office behavior is preserved. The
callback follows office changes; the existing parent office/date/refresh React
key already isolates pending requests and is unchanged.

All 1,654 frontend tests and six compiled request-isolation tests PASS with zero
skips. The first suite attempt omitted its historical artifact and skipped 151
parity cases; the full suite passed after the preserved artifact was supplied.
Production and QA builds PASS. Their environment credentials and QA connect
policy remain separate. No backend logic, financial calculation or stored record
is modified by this client repair.

Production build: `index-DHO0teuA.js`, 8,833,301 bytes,
SHA256 `e15d771e8a02c56e6d9ae3cf7a46a205a5e7a6851d1ea83aa3d5db172ecd7037`.
QA build: `index-CUhTuMEX.js`, 8,832,132 bytes,
SHA256 `fc969724d8c5840cffb80df21277a4c13bce887208fc14df9a4ce0bcf41d939d`.

This dependency must be live before the later daily-summary API office gate.
API identity protection for that route is not claimed by this client release.
