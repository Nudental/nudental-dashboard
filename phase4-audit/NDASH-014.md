# NDASH-014 — P&L export discards office and partial-month scope

- Severity: High. Reproduced using the deployed builder and read-only API aggregates. Barnegat/August produced all-office net production 280649.43 instead of 104505.24. The builder also started a custom period at the first day of its month.
- Root cause: `_fetch_pl_summary` accepted `office_filter` but omitted it from every API request; `m_start` unconditionally used the first of the month.
- Changed: existing backend `report_export.py`, only `_fetch_pl_summary`; public-safe patch and synthetic test retained beside this record. No credentials, configuration, policies, schema, background sync, or business records changed.
- Fix: resolve and validate selected offices through existing mappings, deduplicate locations, scope production/collections by location and expenses by canonical office name, aggregate only selected offices, weight combined collection rate, clamp the first month to the selected start, reject reversed dates and unknown offices. All-office requests retain the existing aggregate API path.
- Preservation: private `ndash014-backend` snapshot in the existing server audit directory; previous frontend artifact and all earlier recovery points preserved.
- Source SHA256 before: `cfb884e9be69f0592f0507bf748f90fbc7ef00c1f3c6a83b6364519f09101692`.
- Source SHA256 after: `34b56a09a864583d4348e0acf44b9475732b904e36b2d1ec06daa2c84c106372`.
- Tests: eight synthetic scope/date cases PASS (baseline seven fail); retained 21 expense access-guard assertions PASS. Exact comparison proves every byte outside this builder unchanged.
- Deployment: PASS through the existing candidate service, then live service, with atomic file replacement and rollback on failure. No frontend deployment required.
- Live API/file verification: PASS. Actual CSV response metadata and rows verified for Barnegat (net 104505.24; collections 113242.92), Barnegat+Brick (176929.61; 176655.21), August 20–31 Barnegat (24156.24; 40647.19), and all offices (280649.43; 264129.64). Existing audit IDs returned; private test artifacts preserved. Unknown-office and reversed-date requests return 400; expense route missing-key guard remains 401.
- Original browser action repeated on https://nudashboard.com/reports with Last Month/Barnegat. Preparing state observed; action reaches the export audit trail. Browser-managed file save and its brief success label have not been independently confirmed in this browser. This is tracked separately from the now-verified CSV scope repair.
- Residual: underlying expense-source discrepancies remain under investigation; this repair does not certify those source amounts. NDASH-013 inactive Office Performance export controls remain next.
