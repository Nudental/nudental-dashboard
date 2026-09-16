# PH5-BONE-003 — procedure dates shifted back a day

The synthetic record's database and edit form both showed `2026-09-16`, while
its table row displayed September 15 before and after refresh. `formatDate` in
`InventoryTable.jsx` parsed a SQL DATE at UTC midnight and formatted it in the
browser's local time zone. The one-line fix specifies UTC when formatting this
date-only field; no stored date or audit is modified.

Actual-formatter tests originally failed in New York and Los Angeles. All five
now pass, including UTC/Tokyo, DST boundaries, leap day and missing dates.
Retained suite: 1,375/1,375 pass, zero skips. Build/isolation guards and 510-file
source parity pass. Seventeen hosted checks pass.

QA release `4360213f-65b7-4b5a-8efc-827867bfa458`, source
`74f62e20484952481159ec1707f2497267e485c7`, entry `assets/index-qRsM-E4j.js`,
SHA256 `0b41148ab0392cb6a44ccbea3435ccf690f42f26808f9b908420ecff69c63162`.
Prior release `672ebed4-2af8-4b4b-8163-8023a8209ec7` retained.

Live PASS: exact fixture row now displays Sep 16, 2026. One record, two audit
rows and its saved date remain unchanged. Production/main/API unchanged.
