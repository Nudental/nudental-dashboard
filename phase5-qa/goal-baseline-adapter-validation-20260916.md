# Isolated service-goal baseline adapter

The QA generator's initial preview for Office A / 2027 yielded no rows. Provider
aggregate routes remain deliberately closed, and the production location map
does not contain synthetic office IDs. This is missing QA integration, not a
claim that production has no baselines.

The QA-only API overlay substitutes two fixed read adapters for CDT-category and
patient aggregate routes. Only the existing Super Admin identity, one exact QA
office, complete months in 2026, and the synthetic category QA TEMP Preventive are
accepted. Unknown/operational IDs, unsupported dates, duplicate/extra parameters,
other roles and write methods are denied. Responses are labeled synthetic and
no-store. No provider, database business source, credential or network setting is
used or changed. The existing QA process sandbox remains mandatory.

The frontend generator sends the selected QA office UUID only in validated QA
mode; production continues using its existing location mapping. Three focused
frontend checks pass. The full retained QA backend suite passes 142 tests with
zero skips, including 13 new real FastAPI adapter tests and prior identity,
report-format, execution-intent and isolation checks. Positive, zero, missing,
cross-office and denied cases are covered. Full frontend suite: 1,598 PASS, zero
skips; build PASS and 511 source files matched.

Source 23699ca1e1372ed2128802996ff2ccd214b6b933. QA API release
585313aa7a2c2f5ee8e4aeeabe0767f6a7a7d76f0a6ddcc2daf6302d6f06d012
preserves previous 9a5616aed194654b5e553b1d402a35d299599f5f3b07c667b1b45ea9749a3d8a.
QA frontend ee6c5b06-bc5f-4043-8760-f4b6de37bbc9 preserves previous
d6008b73-92ac-4418-aa6d-584d5bb9b8e1. Entry index-DRoDvIU-.js,
SHA256 6ef51a46ccef96464e17bdde40c66e4fe1c241e582058178333c5530ed70b7d3.
Seventy-one positive/negative live adapter checks PASS. Seventeen hosted checks
PASS; 205 retained unreviewed/invalid-contract probes remain denied. The two
aggregate routes now accept only their reviewed fixed QA fixture contract, so
the denial count does not mean those valid fixture reads are closed.

The original live preview now generates eleven Office A goals for 2027. January
1000 / 20 / 10 becomes 1150 / 23 / 12; February true zeros stay zero; missing March
produces no row. UI confirms eleven saved rows; database confirms eleven IDs and
eleven audit events. Repeat preview skips all eleven and disables Save 0 Goals.
Edit view reads the same saved values. A note edit persists, clearing January's
production goal saves null and refresh reads null, restoring 1150 persists.
February remains zero throughout. The initial automated numeric fill did not
clear the control; keyboard clearing visibly confirmed empty before testing null.
This was not classified as an application defect.

The live permission matrix found and repaired PH5-AUTH-022, documented separately.
After that repair, all goal values remain unchanged and intended writes continue.
Cleanup removed all eleven exact test goals, preserved fourteen independent audit
events, and repeated deletes returned zero. Refreshed UI shows no 2027 goals.
No external provider processing occurred. Production remains unchanged at
1f1f91bc-5dbd-4500-8bfd-d4e2039ba601. Private receipts:
qa-goal-baselines-live-20260916.json and qa-service-goals-20260916.json.
