# NDASH-015 — Provider export used primary-office filtering on all-office amounts

- Severity: High. Reproduced with deployed builder and read-only August API responses. Barnegat export contained eight rows, net 89734.00 and collections 90559.01; the authoritative scoped API contained nine rows, net 104505.24 and collections 113242.92.
- Root cause: builder fetched all-office provider amounts, then filtered by each provider's primary `locationId`. This discarded cross-office/unattributed activity and retained unscoped amounts for other rows.
- Changed: only `_fetch_provider_production_collections` in existing backend `report_export.py`.
- Fix: validate/deduplicate requested offices through existing mappings; request authoritative activity once per selected location; retain all returned providers including unmapped/unattributed rows; label each scoped row with its activity office. Multiple-office exports keep separate office/provider activity rows. All-office behavior remains one aggregate request with original labels.
- Preservation: private `ndash015-backend` snapshot; previous P&L repair and earlier backend/frontend states retained.
- SHA256 before: `34b56a09a864583d4348e0acf44b9475732b904e36b2d1ec06daa2c84c106372`.
- SHA256 after: `dd5379c4bdf82dbe321c2fe81fc2a00562e59b6dc1991dfd19031374993a9350`.
- Tests: seven provider-scope tests PASS (baseline selected-scope failures); eight P&L tests and 21 expense access-guard assertions retained PASS; exact byte comparison confirms no changes outside the builder.
- Deployment: PASS through existing candidate then production services, with atomic replacement and rollback protection. No configuration changes or background sync.
- Live API/CSV verification: PASS for Barnegat (104505.24 net, 113242.92 collections), Barnegat+Brick (176929.61, 176655.21), August 20–31 Barnegat (24156.24, 40647.19), and all offices (280649.43, 264129.64). Audit IDs returned and scoped rows checked. Unknown-office request rejected before fetch; expense missing-key guard remains 401.
- Live browser: PASS for Office Performance → Last Month → Barnegat → Provider Production & Collections → Generate Report. Busy state and persistent success observed, filters retained, audit row contains the same UUID/date range and nine rows. No browser errors observed.
- Browser-managed file save remains the shared export-verification limitation described in NDASH-013; direct API file and aggregate-content checks PASS.
- No financial, clinical, provider, payroll, or other business records changed. Only normal export audit records were created.
