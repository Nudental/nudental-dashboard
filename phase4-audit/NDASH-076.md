# NDASH-076 — Single-office Daily Comparison breakdown is missing

Section: RCM / Daily Comparison / By Office. Severity: Medium. Status: isolated candidate and API preflight pass; release pending.

Reproduction: on frontend075, All Offices for2026-09-11 shows four office rows. Select Staten Island and By Office says “No by-office data available.” Daily still shows that office's gross production$6,443, net production$4,102 and collections$4,421. Returning to By Office reproduces the empty state again.

Exact root cause: rcm_daily_comparison builds by_office only when no location filter exists. The UI supports the global office filter and expects a breakdown, but the API omits it for every individual office.

Smallest repair: allow the existing daily/MTD office-building block for filtered requests, and skip every location other than loc_id when a filter exists. All-office requests still return four rows; filtered requests return exactly one. Existing metric calculations, date/provider filters, authentication and business records are untouched.

Source: main_candidate.py before SHA dec9768c7d981725d965c1c0fff6f47de8ec8c10ca41fd2ef14a80434a6a0f4a; isolated candidate SHA cbf327b030944d576fbc568d4ff3044ec8e79c9ac2013e53f5f04d898e66f0ab. Full reversal and syntax pass; source and service043 remain unchanged during preparation. Full private before/after copies are retained in the server's ndash076-backend directory; only safe patch recipes/tests are committed locally.

Tests: actual office-building block with synthetic aggregates reproduces two failures before and passes five tests after. Tests cover All Offices, filtered daily/MTD, excluding other locations, date/provider forwarding, and unchanged monthly/yearly response shape. Ten retained backend suites also pass: documentation, access, aging, claim filters, five Gusto/expense suites, and adjustment reversals. Frontend075 remains unchanged, with its334 tests/build/compiled-artifact/live checks already passing.

Release plan: compare aggregate APIs before any write; verify the candidate on the existing8002 service, then restart the existing8001 service. Preserve startup write flags, existing read-only cache warming, service configuration and rollback state. No rejected patient-detail route is used. After release, verify Staten Island's single row, All Offices, refresh, full reload and earlier Daily/MTD display repairs live.

API preflight PASS: All Offices returns4 rows, filtered daily/MTD by_office is null, and the filtered daily metrics exactly match Staten Island's populated All Offices row. Current frontend075 and source070 are unchanged; startup write flags remain disabled. The preflight harness initially assumed empty sections were arrays; corrected null normalization. A separate status-only probe confirmed the default client is denied403 at the public gateway while the ordinary browser header reaches the existing missing-key401 response; the check now uses the same browser header as retained API tests. No authentication behavior or production source changed during preflight.