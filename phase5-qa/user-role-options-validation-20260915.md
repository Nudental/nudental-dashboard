# PH5-USERS-001 — Unsupported account role choices

In hosted QA User Management, editing the disposable `QA TEMP PH5-USERS-20260915` account from Staff to Doctor / Provider and clicking Save Changes failed with `invalid input value for enum user_role: "doctor"`. Independent database readback confirmed the account, office assignment, and audit history were unchanged.

The Invite, Edit, Bulk Actions, and role-filter option arrays included seven values absent from the recovered production database enum: doctor, hygienist, dental_assistant, front_desk, treatment_coordinator, rda, and clinical_manager. These are not supported account roles. The correction removes only those choices from the four arrays. It does not change database roles, permissions, provider records, or other application behavior. Existing supported choices remain.

- Four focused database-contract tests: original 0 PASS / 4 FAIL; repaired 4 PASS.
- Full retained tests, publication, and live verification: pending.
- Only a clearly labeled disposable QA account was used. No operational messages or production changes.
- Fixture cleanup remains required; private recovery details and sanitized stage evidence are outside source control.
