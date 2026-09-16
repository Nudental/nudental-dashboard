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
