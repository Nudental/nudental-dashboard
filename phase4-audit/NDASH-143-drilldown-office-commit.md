# NDASH-143 — Multiple drill-down offices do not update financial results

Severity: High. Status: reproduced; targeted repair under verification.

Repeated live142 Jan1-Jun30 from cleared drill-down state: main office scope is Barnegat+Brick; selecting Eatontown+Staten Island and applying displays both Applied chips and two active filters, but the chart remains at Barnegat+Brick path65a52a42 without reloading. Original workflow reproduced twice before editing. All actions are local filters; no business writes.

Root cause: HierarchicalFilter.handleApply syncs exactly one office only; Financial Analytics handleOfficeSyncFromDrillDown accepts a scalar. Fix only these two callbacks: resolve/deduplicate all selected office IDs, reject unmapped selections, pass the complete array to the existing staged/applied office state and refresh counters. Parent retains scalar compatibility and validates known office IDs. Preserve Clear semantics, nonoffice filters/warnings, metadata, dates and financial formulas.

Verification:722 frontend tests PASS (eight new callback integration cases); production build26.56s PASS. Actual compiled parent/child callbacks pass pair/single/duplicate/nonoffice/invalid/scalar-compatibility cases. Two scoped regions plus seven dependency relinks; full reversal equals live142, all prior modules preserved, syntax PASS. Deployment/live verification pending. Separate metadata-scope behavior is not claimed fixed by this callback change.

Rocket synchronization is temporarily blocked: its response to the143 request reports exhausted/insufficient credits and a September27 refresh. No143 Rocket change/version is claimed. The user has been notified and asked to restore usable credits; no billing action taken. Continue the already authorized recovered repository and existing deployment path while that separate workspace update waits.
