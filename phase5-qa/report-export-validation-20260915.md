# QA Patient Flow CSV integration — September 15

The next reviewed QA API route is `POST /v2/reports/export`, limited to Patient
Flow CSV. It uses the recovered report generator with explicit synthetic
aggregate fixtures for the two QA offices. Other report types/formats stay
unavailable. No provider, operational database, frontend or production build is
changed by this integration.

The QA wrapper retains the existing Reports admin/super-admin allowance and
individual-export permission. It binds identity fields to the verified session
and QA profile, rejects forged request identity, and restricts every source call
to the user's assigned offices. Omitted/all-office requests expand only within
that scope, including monthly trend requests that omit a location parameter.

CSV and audit metadata explicitly identify synthetic QA fixtures. The existing
`report_export_audit_log` table is used; a valid saved audit ID is required before
file delivery. Requests are limited to 16 KB and a 366-day date interval. Files
are generated in memory; no delivery or provider connection occurs. The existing
QA CORS policy exposes only the download/audit metadata headers needed by the UI.

All 107 retained/new QA backend tests PASS using the server's pinned dependencies,
with no skips. Fifteen new tests exercise the actual recovered CSV generator,
role and office boundaries, identity forgery, date/size validation, explicit QA
labeling, audit failure and request-scope cleanup. The first test archive omitted
two preserved fixtures needed by old tests; its 8 setup errors were resolved by
including those fixtures in the full run. No application test assertions were
weakened.

Deployment and live API verification are pending. The last QA API release remains
`8f86280efb3f08521ebaefba04a8a2f4412f08880b533365a0c2d8186dc4898b`.
Browser download and Reports UI checks remain pending browser reconnection.
