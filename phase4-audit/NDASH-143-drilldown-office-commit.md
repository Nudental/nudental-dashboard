# NDASH-143 — Multiple drill-down offices do not update financial results

Severity: High. Status: deployed and live verified PASS.

Repeated live142 Jan1-Jun30 from cleared drill-down state: main office scope is Barnegat+Brick; selecting Eatontown+Staten Island and applying displays both Applied chips and two active filters, but the chart remains at Barnegat+Brick path65a52a42 without reloading. Original workflow reproduced twice before editing. All actions are local filters; no business writes.

Root cause: HierarchicalFilter.handleApply syncs exactly one office only; Financial Analytics handleOfficeSyncFromDrillDown accepts a scalar. Fix only these two callbacks: resolve/deduplicate all selected office IDs, reject unmapped selections, pass the complete array to the existing staged/applied office state and refresh counters. Parent retains scalar compatibility and validates known office IDs. Preserve Clear semantics, nonoffice filters/warnings, metadata, dates and financial formulas.

Verification:722 frontend tests PASS (eight new callback integration cases); production build26.56s PASS. Actual compiled parent/child callbacks pass pair/single/duplicate/nonoffice/invalid/scalar-compatibility cases. Two scoped regions plus seven dependency relinks; full reversal equals live142, all prior modules preserved, syntax PASS. Deployment/live verification PASS; details below. Separate metadata-scope behavior is not claimed fixed by this callback change.

The first Rocket request was refused for insufficient credits. After the user reported adding credits, one resubmission completed successfully as version872 with the two requested callback files. No billing action was taken by the agent.

Deployment c4299f5b-1211-45d6-aefe-cc33f984f09a: index-61e18dc81cad.js, SHA256 61e18dc81cad4af49dfb6e2a6d2ddff66887bb13ceba9241cdf2772bb8eb16f7. Prior142 deployment da3dbdbd-f54a-41b1-80a6-400062c1be6b remains recoverable. Initial health check saw a prior edge page; subsequent exact asset hash, frontend/API200 and all three services PASS. Backend131 unchanged. Source87f9cb7; no business/configuration changes;042/066 excluded.

Live143 original Jan1-Jun30 workflow PASS twice: Barnegat+Brick baseline path65a52a42; applying Eatontown+Staten Island starts refresh, selects exactly those two main options, shows two Applied filters, and updates chart path8c795baa. June net/collection cents fingerprints f4a06424/68265384 match independent read-only source aggregates. Clear removes drill-down chips while retaining committed main scope. Single Barnegat regression path18da9bd2 and June1b24b61c/32ce8d3c match source. Dates remain01/01/2026–06/30/2026; no new browser errors. No test records or business writes were created.
