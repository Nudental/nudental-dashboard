# NDASH-105 — Reports provider view ignores combined offices

Section: Reports / Provider Production & Collections. Severity: High.

Reproduced on live104 before editing: select Barnegat, add Brick; selected filter reads2 Offices but the provider table has28 rows. Remove Brick (single Barnegat produces19 rows), add Brick again:28 rows. Switching the combined result to All Offices leaves exactly the same full-table fingerprint and28 rows. Provider home-office labels alone were not used as proof of activity scope; the identical combined/all response and source contract establish the defect.

Root cause: parent only computes reportLocationId for a single selected office. RevenueByProviderChart ignores its officeFilter, sends null for combined offices, and therefore requests all offices. The callback dependencies also omit the actual combined selection.

Fix: this component resolves/deduplicates all selected locations using the existing canonical maps. It keeps single/all-office paths, fetches each selected location for combined selections, requires valid provider arrays and stable IDs, merges disjoint office activity by provider ID, recomputes combined collection rates, and labels activity office scope. Unknown scope or any selected-office failure fails visibly with no partial result. Existing dates, API, charts and normalization are retained. No business writes or configuration changes.

Seven synthetic cases:6 failures before; all464regressionsPASS after. Production source buildPASS34.52s. Rocket831 requested/verification pending. Compiled artifact/deployment/live verification pending;104 recovery preserved.

Rocket831 confirms scoped file only. Actual compiled callback testsPASS for selected locations, merged totals/rate, single/all paths, unknown/malformed/missingID/partial failures. Canonical compiled office maps validated. Full reverse to104, all retained repairs and7dependency relinksPASS. Candidate index-4d6d2e73f46e.js. Deployment/live pending.
