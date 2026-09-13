# NDASH-152 — Provider detail selection and report scope

Status: CLOSED — deployed and live-verified PASS.

Severity: Medium — office-specific provider detail can be cross-selected or retained after its office is excluded.

Reproduction: Operations / Providers / Last Month / Barnegat + Brick returns 15 rows, including three pairs of same-name providers with distinct office contexts. Twice, selecting row 7 (Brick) highlighted both rows 7 and 9 (Barnegat); clicking row 9 closed the detail instead of switching it. Selecting Brick's detail and then filtering to Barnegat left that excluded-office detail visible beside the new nine-row report.

Root cause: all three desktop/mobile selection checks compared providerName rather than the actual mapped record. The report loader also retained selectedProvider across a new office/date read.

Small fix: compare the selected row object with the actual mapped record in the three selection checks. Clear selectedProvider at the start of a valid report load. Source mapping, dates, office request scope, calculations, missing-value handling, search and sorting remain unchanged.

Changed component: ProvidersTab.jsx only. Eight focused tests PASS; four fail on the preceding source. Complete frontend suite 795 PASS; production build PASS (33.33 seconds). Rocket completed version 882. Release artifact verification and live results follow below.

Safety: no backend, authentication, infrastructure, configuration, provider-record or business-data changes. Synthetic row fixtures are local only. Backend remains NDASH-148; blocked NDASH-042 and NDASH-066 remain excluded. Unsupported provider-detail charts keep their existing mapping-required messages.

Release: source 731e1f8; deployment b5fe7f39-ed95-4e0d-a9dc-4af821ee35a1; entry `/assets/index-fbe4196ab0cf.js`; SHA-256 fbe4196ab0cf20581dc46926f151b6dedaf97fa84f1102d709cb39592abe57b4 (21740036 bytes). Compiled row-identity cases, reset inside the valid-date guard, unchanged remaining load body, reversal of all four AST changes, full reversal to NDASH-151 and seven retained dependency modules PASS. Exact live artifact, backend148 hashes, frontend/API health and all three services PASS.

Live PASS: all 15 paired-office row fingerprints match the pre-fix baseline. Only Brick row 7 is selected; switching to Barnegat row 9 keeps one selection and an open detail whose five displayed values match that row. Clicking the selected row closes it. Excluding Brick clears its old detail and leaves nine Barnegat rows. Empty and case-insensitive search, search cleanup and both numeric sort directions PASS. All Locations/default descending restored with 18 rows, no detail and no new browser errors. Three unsupported detail-chart mapping messages remain visible. Mobile selection paths are covered by source and actual compiled checks; desktop behavior was verified live. No business records were created or changed.
