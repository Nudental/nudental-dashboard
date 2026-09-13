# NDASH-149 — Operations YTD range and cancellation period

Status: CLOSED — deployed and live-verified PASS.

Severity: High — YTD reporting silently used the current month rather than the selected reporting interval.

Reproduced twice on the live Operations Cancellations view with Barnegat plus Brick. Selecting YTD and Update returned September-only appointment totals (source fingerprints 903677d1 / 97fbeb1a), not January–September totals (0c94914f / 0194fb63). Last Month restored the original August values. This was initially suspected to be a label problem; direct source comparisons established that the requested date range was also wrong.

Root cause: the shared monthly `buildDateRange` function lacked a `ytd` case and defaulted to the current month. The cancellation Period cell also assumed every aggregate covered only one month.

Small fix: add the YTD case from January through the current reporting month. Render the cancellation period as a start/end month range when it spans multiple months or years. Preserve the existing monthly reporting contract, other presets, counts, rate calculations, office selection, and API/backend.

Verification: seven focused tests pass, including year rollover, January/December YTD, unchanged existing presets, and single/month-range/year-range labels. Four focused cases fail against the previous source. The initial test harness selected an enclosing JSX expression and its historical-read subprocess needed a repository-specific safe-directory setting; both were corrected without changing product scope. Full frontend suite: 769 PASS. Production build: PASS, 31.84 seconds. Rocket workspace: version 879.

Backend remains the live verified NDASH-148 source. No business records, configuration, credentials, authentication, or infrastructure changes.

Release: source b949313; deployment 8ed98311-263f-4d86-9928-8795981e9000; entry `/assets/index-c38e49b05d0e.js`; SHA-256 c38e49b05d0e535f6c7d2642f805366dfaaee6d09d8142f442c728de96a24479. Compiled date/period tests and full reversal to NDASH-148 PASS; all seven dependent modules preserved. Exact live artifact and unchanged backend148 verified; frontend/API 200 and three services active.

Live PASS: YTD pair fingerprints match the January–September source values and the table shows `Jan 2026 – Sep 2026`. All Locations YTD also matches its source fingerprint a8aa6a59. Quarter pair values remain 94276e43 / e22355dd, with the accurate `Jul 2026 – Sep 2026` label. Last Month retains its August labels and values. Repeated YTD matches exactly; default Last Month/All Locations restored exactly; no new browser errors. No temporary business records created.
