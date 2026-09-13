# NDASH-126 — Admin benchmark table invents zero differences for missing values

Severity: High. Status: CLOSED — deployed and live-verified PASS.

Reproduced on125 in Admin Reconciliation > Benchmark Row Data: all100 rows show both Dashboard values missing, yet both differences are green +$0.00. All100 have Pending reconciliation status. Filtering Barnegat reproduces both false zero differences in its one row. No financial values, identities or business records modified.

Root cause: the benchmarkRows render callback in dentrix-diagnostics/index.jsx substitutes each benchmark's own value when the corresponding Dashboard value is absent, then subtracts it from itself. This separate admin view retains the same defect pattern previously repaired in Financial Analytics by044.

Smallest fix: compute each difference only when both values exist; otherwise render a neutral dash. Preserve existing benchmark-minus-Dashboard direction, actual numeric zero, tolerance, reconciliation status, source reads, historical reference disclaimers, filters, calculations and all other behavior.

Predeployment PASS: six actual source-row rendering tests (four fail before fix), all575 frontend tests, build30.83s, Rocket852. Actual compiled old callback reproduces both false zeroes; candidate passes null/undefined/missing benchmark/partial comparison/true zero/numeric strings/positive and negative differences with Pending status unchanged. Full reverse125 byte-for-byte and seven module relinks PASS. Candidate index-0143b5ec5eff.js; deployment/live verification pending.

Release: sourcedf1b25b;deploymentbfb1da9b-23e7-464f-820b-f03fb3bc7949;entry index-0143b5ec5eff.js SHA0143b5ec5eff22bb9920fd2638b616b26c9eb28f49d32004a9135815a529c3d8. Prior125 retained. Live fresh reload:100 Pending rows,200 neutral dashes,0 false zero differences. Barnegat1 retains2 neutral dashes after Refresh Metrics. All Offices restores100; adjacent Source Lineage10 rows preserved. New errors0; frontend/API200,3services active,backend113 unchanged. No production data changed.
