# PH5-SETTINGS-003 — saved job title disappears on refresh

Existing synthetic QA Super Admin account only. UI save changed its empty
`job_title` to `QA TEMP PH5-ACCOUNT-20260916`; PostgREST readback confirmed the
value and one new audit. Two full page reloads showed an empty Job Title despite
the persisted value. No password, email, role, office assignment or account
status was changed. Initial autofilled text was not treated as saved data.

Root cause: `AuthContext.jsx` reloads profiles with `PROFILE_GATE_FIELDS`, which
omitted the existing `job_title` column. Immediate saves selected the full row,
so the field appeared correct until a reload. Smallest fix adds that one field
to the existing SELECT projection. Authentication gates and access rules are
unchanged.

Three executed-source tests exercise the actual account-form hydration using
the profile projection: staff/admin saved-title cases failed before and pass
after; cleared title/name/phone control remains passing. All 1,619 retained
frontend tests pass, zero skipped. QA build and 511-file source parity pass.
QA release `049722eb-9fd4-4f91-be17-ef24b05bcef1`, source
`a03cd893bb44574000328edbd795a7540b898f6a`, passes all 17 hosted checks.

Live result PASS: exact new entry asset confirmed in the loaded page. A fresh
temporary title save persisted and appeared after a separately observed full
reload. A first combined reload/edit probe sampled the transient empty form and
missed its toast; it was not counted as a successful test. The separate replay
confirmed persistence. Restoring the original empty title showed explicit UI
success and exact API equality with the original profile. One identity remains;
four new audit events cover both save/restore pairs. No passwords or roles changed.

Browser-local EOD Digest preference: true → false persisted after full reload,
then restored true. This control stores local preferences only; no delivery or
server audit capability is implied. Push permission remained blocked, untouched.
Production deployment and main remain unchanged.

Evidence outside Git: `qa-account-settings-20260916.json`. The original profile
was snapshotted. Restore its empty title and retain the resulting audit history.

## PH5-SETTINGS-004 — persisted theme and creation date omitted on reload

Two live theme saves stored Warm Professional in the QA profile, but each full
reload applied the default Nu Dental Brand. Member Since also showed a dash on
both observations, while the stored creation date was present. These consumers
use the same limited profile projection, which omitted `theme` and `created_at`.
The follow-up adds exactly those two existing read fields. Theme writes, account
gates, credentials and permissions remain unchanged.

Four additional executed-source tests cover saved/default themes and
present/missing creation dates. Both missing-field cases failed before. All seven
profile readback tests now pass (the first date expectation was corrected to the
existing long-month UI format). All 1,623 retained frontend tests and QA build /
511-file source parity pass. QA release `e40c619e-a01d-4105-b6ef-6f9d6f394eb4`
(source `be37bf0b86af8318595e78b3ffe64c5b7646ad17`) passed live replay:
Warm Professional survives a full reload, and Member Since shows September 14,
2026. Nu Dental Brand was restored, verified in the UI and database.

Separate profile-workflow receipt: `qa-profile-settings-20260916.json`. Original
theme is Nu Dental Brand and photo is unset. Both original values are now restored.
The separate [photo workflow](profile-photo-validation-20260916.md) passes and is
cleaned; its private bucket and approved QA-only policy remain as reusable setup.
