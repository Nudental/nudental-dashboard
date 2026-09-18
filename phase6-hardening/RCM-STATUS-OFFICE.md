# RCM daily-summary status office dependency

Deployed and verified in production `08f84700-056f-4af4-8f13-526a66ad8187` and QA `707f2962-0ed0-406e-baa5-25cc49f40bc4`.

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

## RCM selected-office status repair — deployed

Frontend source `f3e427f7b94c96eb44424e7791c10051f30817cd` is live in production `08f84700-056f-4af4-8f13-526a66ad8187` and isolated QA `707f2962-0ed0-406e-baa5-25cc49f40bc4`. The Data Source Status widget now forwards the selected office to the daily-summary service; unknown offices fail before making a request. Existing all-office behavior and the parent request isolation remain intact. Five new tests reproduced the defect before the two-file repair.

All 1,654 frontend tests (zero skips), six compiled Expense isolation checks and three compiled RCM checks in each environment PASS. Both builds and environment-isolation checks PASS. Production entry `index-DHO0teuA.js` is 8,833,301 bytes (previous 8,833,241); QA entry `index-CUhTuMEX.js` is 8,832,132 bytes. No speedup claim is made for this 60-byte scope repair.

Live production RCM / Eatontown / Last Month renders all eight sections, today's September 18 daily summary and an available payment breakdown; captured errors and alerts are empty. QA layout and banner render with financial reads intentionally disabled by `product_api_ready=false`. Production/QA HTTP and API health PASS. Four production/collections metric comparisons for August 1–31, all offices and Eatontown, are unchanged. All 17,363 guarded original rows are preserved, backend source is unchanged and business writes are zero. The bounded last-150-line journal query contained no matching daily-summary request; no transport-log claim is made.

Immediate frontend rollback: `a81545bf-4463-4dc3-9b33-3cad855888d7`, tag `backup/production-before-phase6-rcm-scope-20260918`, snapshot `core-client-frontend-backup-20260918T093908Z`. Earlier recovery points remain. This completes the client dependency only; core-read API identity activation and final main integration remain pending.
