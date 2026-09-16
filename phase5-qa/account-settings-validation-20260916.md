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
after; cleared title/name/phone control remains passing. Full regression,
QA build/deployment, live reload and restoration checks are pending.

Evidence outside Git: `qa-account-settings-20260916.json`. The original profile
was snapshotted. Restore its empty title and retain the resulting audit history.
