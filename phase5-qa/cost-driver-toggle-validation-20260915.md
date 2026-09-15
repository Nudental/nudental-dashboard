# PH5-SETTINGS-001 — Cost-driver status toggle

Created one synthetic `QA TEMP PH5-COST-20260915` category in isolated QA, edited it to `… EDITED`, then clicked Deactivate twice. Both attempts showed `invalid input syntax for type uuid: "undefined"`. The category remained Active, with no audit entry for either rejected status change.

`ManagementTable` passes `(row.id, !row.is_active)`. `CostDriversManagement.handleToggleActive` expected a whole row and consequently passed an undefined ID to the existing update service. The two-line fix accepts `(id, isActive)` and forwards those exact arguments. No data schema, calculation, authorization, or deployment configuration changed.

- Focused tests execute the actual parsed handler: original 0/3 PASS; fixed covered by the complete suite.
- Retained Phase 4/5 suite: 1,333 PASS, zero skipped.
- All 510 build source files match the candidate. QA build and credential/isolation guards PASS.
- Candidate source `03c356e9c0bc0c2b1f20ac12c6f94a0d35a1c9c2`; entry `assets/index-Ct581z_X.js`, 8,828,419 bytes, SHA256 `c50560dd72c1a062df53650b03ce19d95acb2cd2c9dd2eeaf88e8548ca04bd60`.
- QA deployment `fee7c52b-0022-43b5-b4d3-bc4bdcb27b5e` succeeded; previous `2ef0da74-4760-4f2b-b73d-670908e19d8b` retained. All 17 hosted environment checks PASS. Production release unchanged; no production publication performed.
- Original Deactivate action repeated on the new release: Inactive persisted after refresh, one record remained, and audit count rose from 4 to 6. Activate restored the same record with two more audit entries. No UUID error.
- Six ordinary-role API write attempts rejected with persisted values unchanged. Delete cancellation preserved Active; Delete confirmation soft-deactivated the row and recorded the action.
- Temporary category removed after dependency checks; all 11 audit entries retained. No cost-driver records remain in the originally empty QA table. Evidence: `qa-cost-ui-20260915.json` and `qa-cost-permissions-20260915.json` outside source control.
