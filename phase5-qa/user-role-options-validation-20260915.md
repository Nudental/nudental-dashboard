# PH5-USERS-001 — Unsupported account role choices

In hosted QA User Management, editing the disposable `QA TEMP PH5-USERS-20260915` account from Staff to Doctor / Provider and clicking Save Changes failed with `invalid input value for enum user_role: "doctor"`. Independent database readback confirmed the account, office assignment, and audit history were unchanged.

The Invite, Edit, Bulk Actions, and role-filter option arrays included seven values absent from the recovered production database enum: doctor, hygienist, dental_assistant, front_desk, treatment_coordinator, rda, and clinical_manager. These are not supported account roles. The correction removes only those choices from the four arrays. It does not change database roles, permissions, provider records, or other application behavior. Existing supported choices remain.

- Four focused database-contract tests: original 0 PASS / 4 FAIL; repaired 4 PASS.
- Full retained tests: 1,322 PASS, zero skips. QA build, 510 source-file comparisons, and environment guards PASS.
- Source `fd62fc9cde7b0288a367220a92f767f092d5cccb`, pushed to the Phase 5 QA branch.
- QA deployment `fb79b6a3-f333-4c52-a08a-af2cae689f52`; rollback `df98cec2-c05f-4723-957a-fe34df727ac8` retained.
- Entry `index-BzvBFH3m.js`, 8,828,236 bytes, SHA-256 `20c5446fc6e75dc4bec34e3ea58df32bdef8711c3e63156e4c3dd947d369c019`.
- Hosted checks: 17 PASS; production deployment and artifact unchanged.
- Live Edit and Invite choices exclude unsupported roles. Changing the test account Staff → Office Manager → Staff persisted with one account and one Office A assignment. `User updated successfully` was observed. Refresh, audit actor/prior role, and cancel-without-saving PASS.
- Six ordinary/inactive/unapproved actors could not edit the disposable account. That deactivated account could not grant itself a role or reactivate itself: eight hosted API checks PASS.
- Subsequent account-state testing found a separate pre-existing Activate inconsistency; tracked separately from this verified role-choice repair.
- Only a clearly labeled disposable QA account was used. No operational messages or production changes.
- Fixture cleanup remains required; private recovery details and sanitized stage evidence are outside source control.
