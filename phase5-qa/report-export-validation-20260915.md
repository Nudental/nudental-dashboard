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

All 109 retained/new QA backend tests PASS using the server's pinned dependencies,
with no skips. Seventeen new tests exercise the actual recovered CSV generator,
role and office boundaries, identity forgery, date/size validation, explicit QA
labeling, audit failure, parallel office isolation and request-scope cleanup. The first test archive omitted
two preserved fixtures needed by old tests; its 8 setup errors were resolved by
including those fixtures in the full run. No application test assertions were
weakened.

Deployed only to the existing QA API through its restricted publisher, from source
`539bee604eadd04335c018f8a6ccf5101b3b9430`. Current release:
`581c259b50e6bce9cf6f1f14f88cfa51070c548ca9f07ae3afd80c38117daccd`.
Previous release `8f86280efb3f08521ebaefba04a8a2f4412f08880b533365a0c2d8186dc4898b`
and a newly packaged rollback archive remain recoverable. QA configuration and
the production entry artifact were unchanged by deployment.

Live verification: **45/45 PASS**. Five deliberately requested synthetic CSVs
were parsed, saved locally, hashed and read back; all temporary downloads were
removed. Their five distinct audit records remain as legitimate QA history.
Office-manager export permission was temporarily enabled for the positive test,
then restored to false and denial reverified. Admin all-office and single-office
exports, ordinary-role scoping, monthly trend scope, identity forgery, invalid
sessions and unsupported reports behaved as expected. No business rows were
created or changed. The initial verifier setup used a nonexistent role field in
the private actor file; that failed before export or permission changes. The
corrected verifier derives roles from the checked-in synthetic fixture manifest.

Post-release regressions: **205 route restrictions, 23 office/API checks and
22 EOD/API checks PASS**. Only the three reviewed QA routes are enabled; the
health response still deliberately reports `product_api_ready=false`.
Browser download and Reports UI checks remain pending browser reconnection.
