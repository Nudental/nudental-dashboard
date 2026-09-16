# Clinical catalog stock office mapping

PH5-SUPPLY-012 — original save defect PASS in isolated QA, September 16, 2026.

As the QA Office Manager, entering three units for the labeled synthetic catalog item failed twice; no stock or history row existed. The form stayed open without a visible error. A bounded replay of the actual payload confirmed HTTP 400 / PostgreSQL 23514. `SupplyCatalogTab.jsx` passed the profile's office UUID to `MobileCatalogView`, while supply stock queries and the office constraint use office names.

The fix resolves that assigned UUID against the existing accessible `OfficeContext.offices` array and passes the corresponding name. It does not change office assignments, permissions, database constraints or desktop behavior. Missing/unassigned offices resolve to null instead of another office. Six actual-component tests changed from 2 pass / 4 fail to 6 pass; QA/production-name cases and desktop/admin behavior are covered.

All 1,464 retained frontend tests pass, with zero skips. QA build, 510-file parity and 17 hosted isolation/production-entry checks pass. Source `b54d650807cfefb101cbe69155ff33dc78121fe7` is pushed. QA deployment `14589820-c332-412c-89e7-ad0364137f5b` uses `assets/index-uHcp39eJ.js`, 8,829,667 bytes, SHA256 `efe2ea6c0058952bafaacef1a0c06e15c82469442b0e4074bf9b1629297819d4`. Previous QA `fda8a0f8` is preserved; production remains `1f1f91bc`.

The original three-unit UI save now closes the keypad and displays three units. Exact readback confirms one row for QA / Office A and the synthetic item. Full reload retains three units and no Add-stock control. No supplier, production or camera operation occurred.

Separate follow-ups: initial creation writes no `supply_inventory_history` entry; the failed-save handler previously logged its error only to the console. These are not claimed repaired here. Ordinary-role database enforcement, adjustment history and exact cleanup remain to be completed. The temporary department/subsection/item and one stock row are tracked in `qa-clinical-catalog-20260916.json` outside the repository.
