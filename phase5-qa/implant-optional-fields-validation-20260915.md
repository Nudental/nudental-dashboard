# PH5-IMPLANT-001 — Optional inventory fields prevent saving

The live QA Add Implant wizard accepted required location, company, ID, and a
five-unit quantity. Leaving optional system/platform/length/diameter/expiration
blank then failed at Save Implant with `invalid input syntax for type uuid: ""`.
Independent readback found zero inventory rows and zero usage records.

`AddImplantModal.handleSave` spreads the form directly into the database payload.
Optional selectors initialize to empty strings, while the schema expects nullable
UUIDs and a nullable date. The smallest targeted fix converts those four omitted
UUID values and the omitted expiration date to null. Supplied values, quantity,
required-field validation, attachment handling and existing permissions remain.

Nine actual-handler regression cases reproduce seven failures in the old code;
the valid populated-record and permission-denial cases pass. Tests cover create,
edit, each individual blank selector, populated selections, attachment payloads,
and rejection without success/audit side effects. All nine cases now pass;
all 1,264 retained frontend tests pass with zero skips. QA build, all 510 source
file comparisons, and environment/secret checks pass. Live repeat pending.
Production is unchanged.

One labeled QA company exists to support this test. Its creation persisted but
no general audit event was found; that separate settings-audit finding is queued
for investigation. No inventory or usage row existed at the failure checkpoint.

Live verification PASS on QA deployment 884da3bc-eee7-4b4b-ac92-8ab4532835c1,
source 297969234fae18fcbc5743321d998aa390c02619, entry index-C_xerSx5.js.
The original blank-optionals case saves exactly one five-unit inventory record,
updates Total In Stock to 5, and records one creation audit. Refresh retains the
row. Editing its synthetic notes with the same blank optional fields succeeds,
retains stock 5 and one row, and records a second (updated) audit. Refresh readback
passes. All 17 hosted checks pass; prior QA deployment d58333fb is recoverable.
Production deployment remains 1f1f91bc-5dbd-4500-8bfd-d4e2039ba601.
Evidence: qa-implant-ui-20260915.json, inventory_repaired_saved/edited/refreshed.
The same fixture remains temporarily for receive/consume testing and cleanup.
