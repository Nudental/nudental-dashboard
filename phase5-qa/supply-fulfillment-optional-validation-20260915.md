# Manual fulfillment optional fields

PH5-SUPPLY-003 — save repair PASS in isolated QA, September 15, 2026.

Two manual create attempts failed with `invalid input syntax for type date: ""`.
Both left zero records. The form sends blank optional UUID/date fields as empty
strings, while the database expects null. The service now converts only empty
item/department/recipient IDs and supplied/received dates to null. Populated
values, missing columns, free text, permission failures and inventory logic are
unchanged. Nine actual-service tests: original 3 pass / 6 fail; repaired 9 pass.

All 1,406 retained frontend tests pass, zero skipped. QA build, complete 510-file
source parity, environment checks and 17 hosted artifact/isolation checks pass.
Source `55df462f7a4e46730cc662a31f873cb73f893284` is pushed on the Phase 5 branch.
QA deployment `79d267a7-10ad-44bb-bfaf-0d12b9316018` uses
`assets/index-DZ4a0s8h.js`, 8,829,682 bytes, SHA-256
`3488266db51e8a076b6935274a2fb35d70e99e3c0c95a1da468ce834bf572102`.
Rollback `e78561c5-3dba-4667-a256-81baa465918f` is preserved.

Live original test: visible “Fulfillment record created!”; exactly one labeled
temporary Office A record; expected nulls; a full reload still shows one record,
quantity supplied 1, Completed status. No duplicate or linked inventory change.
Production remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`, unchanged.

The complete fulfillment workflow is not yet PASS. Separate findings: creation
has no audit entry; two read matrices expose the fixture to all 12 QA identities,
including inactive/unapproved and Office B users. Its default supplied date uses
UTC (September 16 while the Work computer is September 15 Eastern). These remain
for individual investigation/repair. One temporary fulfillment and the original
approved supply request/item remain tracked for cleanup. No camera access used.

Clinical request review, before fulfillment testing: missing reject reason was
correctly rejected; Under Review and Approved each reported success and persisted
with their own audit events. Under Review survived reload. One request/item and
four audit entries remained, plus the two private simulated notification intents.
No provider notification, purchase or operational order was sent.
