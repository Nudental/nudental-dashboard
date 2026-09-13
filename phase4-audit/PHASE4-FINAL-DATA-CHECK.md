# Final Expense comparison — 2026-09-13

This is an unresolved data-authority observation, not a newly proven code defect and not a claim that NDASH-066 changed Expense calculations.

Live scope: This Year, All Offices, all departments/categories/sources/payment sources/statuses. A second Reset reproduces the current result. Eighteen cards and five charts render; all five chart fingerprints exactly match the previously verified157 baseline, including the11-slice category pie with Remaining categories. No new browser errors were captured.

Nine headline fingerprints changed: Total Expenses, AmEx / Corporate Card, WF Direct Operating Expense, Expense % of Collections, Expense % of Gross Production, Expense % of Net Production, AmEx % of Total Expenses, Net Operating Income and Net Operating Margin. Other headline fingerprints remained unchanged. Raw financial figures and record bodies were not copied into this evidence.

One read-only `GET /v2/expenses/summary` for2026-01-01 through2026-09-13/all offices returned200. Current WF Direct agrees with the UI fingerprint `14b9694f`; the old observation was `26b7470e`. API AmEx and total do not match the current UI composite/fallback figures. Existing service logic can prefer posted-AmEx fallback data and combine sources. This demonstrates an unresolved source/accounting reconciliation, not that either amount should replace the other. The precise reason each historical headline changed is not established.

The066-v2 candidate reverses byte-for-byte to immediately previous042-v3 by undoing only its comparison-table replacement and seven import relinks. Backend148 files retain exact verified hashes. Expense code, accounting rules, query scopes, credentials and configuration were not changed. No financial or clinical records were edited. No broader employee/Benefits or previously rejected large AR queries were attempted.

Disposition: targeted066 and retained157 chart regressions PASS; the entire Expense headline dataset is not certified. Resolve the existing financial-source-authority limitation with a designated accounting/source owner and an approved read-only reconciliation scope before treating these composites as independently verified financial statements. Do not alter production classifications or amounts on the basis of this observation.
