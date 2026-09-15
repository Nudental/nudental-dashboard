# PH5-IMPORT-001 — QA import office source

The live QA bulk implant wizard listed the four hardcoded production offices and rejected the synthetic `QA / Office A` row as invalid. No inventory was created by that preview.

Root cause: `bulkImportService.fetchOfficesForImport` always returned production `OFFICE_LIST`, unlike the regular inventory form. The targeted fix uses the existing scoped, active `offices` query only when validated `dashboardEnvironment.isQa` is true. Production mapping and behavior remain unchanged; empty/error QA responses never fall back to production.

- Focused tests: before 1 PASS / 4 FAIL; after 5 PASS.
- Retained frontend tests: 1,311 PASS, zero skips. All 510 source files match the QA build input; environment guards PASS.
- Four existing QA identities returned only synthetic office IDs/names; rejected-preview inventory count remains zero (5 live checks).
- Source `39d74b004a74fc78596df06a5903b5af2024df94`, pushed to the existing Phase 5 branch.
- QA deployment `0230972b-3c0e-4f81-9647-bc7ee0f9159e`, previous `9ae94c45-07d7-4c2f-8b34-fa237ef5cb68` retained.
- Entry `index-C1v3gPIR.js`, 8,828,984 bytes, SHA-256 `3ee78d87103bffa01c7259ad3df1bd5828aeb07fb12d4f6f93e22184dbc25ff3`.
- Hosted checks: 17 PASS; production deployment/entry unchanged.
- Live repeat: setup lists QA / Office A and B; the identical single-row CSV preview now reports 1 valid, 0 warnings, 0 errors. PASS. Import execution remains a separate pending test.

The expanded sidebar also obscured the import dialog's left controls. Collapsing it permitted reproduction; that separate overlay defect remains under investigation.
