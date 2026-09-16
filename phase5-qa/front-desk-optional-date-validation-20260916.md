# Optional catalog supply date

PH5-SUPPLY-010 — PASS in isolated QA, September 16, 2026.

Twice, editing only the synthetic catalog note failed with “invalid input syntax
for type date” because the optional Last Supplied input submitted an empty
string. Readbacks retained the original note and five audit events. The
frontDeskInventoryService.updateRow payload passed that string through unchanged.

A one-line payload normalization now converts only an explicitly empty
last_supplied_date to null. Omitted dates, existing valid dates, null dates and
empty text notes retain their behavior. Database errors still propagate. Six
actual-service tests went from 5 pass / 1 fail to 6 pass. All 1,449 retained
tests pass with zero skips; QA build, 510-file parity and 17 hosted checks pass.

Source 636b06501552edcb969cfbaf06558c0116b22b6d is pushed. QA deployment
3db499b1-b07c-4d2c-8e51-757454873230 uses assets/index-B1Q7HO-T.js,
8,829,902 bytes, SHA256
1b64017899b97737f377bb382346de8de0e50df9a4669ce5c4138d4784f9f1c1.
Previous QA 5c99d0a5 remains recoverable. Production remains 1f1f91bc.

The original UI note edit now reports Item updated with the optional date blank.
Readback contains exactly one six-unit record, the new synthetic note, null date,
and a sixth UPDATE audit attributed to the Office Manager with notes among the
changed fields. An unchanged UI repeat save leaves audit history at six events.
Full refresh and the Office A inventory filter show the persisted note, six units
and In Stock. Summary counters remain correct. The same labeled record remains
for the pending migration 032 access verification and later cleanup.

The unused local QA credential helper was stopped after confirming its process
identity. No camera, production business data, credentials or configuration were
changed by this repair.
