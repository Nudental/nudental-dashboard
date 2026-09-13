# NDASH-126 — Admin benchmark table invents zero differences for missing values

Severity: High. Status: reproduced; verification pending.

Reproduced on125 in Admin Reconciliation > Benchmark Row Data: all100 rows show both Dashboard values missing, yet both differences are green +$0.00. All100 have Pending reconciliation status. Filtering Barnegat reproduces both false zero differences in its one row. No financial values, identities or business records modified.

Root cause: the benchmarkRows render callback in dentrix-diagnostics/index.jsx substitutes each benchmark's own value when the corresponding Dashboard value is absent, then subtracts it from itself. This separate admin view retains the same defect pattern previously repaired in Financial Analytics by044.

Smallest fix: compute each difference only when both values exist; otherwise render a neutral dash. Preserve existing benchmark-minus-Dashboard direction, actual numeric zero, tolerance, reconciliation status, source reads, historical reference disclaimers, filters, calculations and all other behavior.

Predeployment PASS: six actual source-row rendering tests (four fail before fix), all575 frontend tests, build30.83s, Rocket852. Actual compiled old callback reproduces both false zeroes; candidate passes null/undefined/missing benchmark/partial comparison/true zero/numeric strings/positive and negative differences with Pending status unchanged. Full reverse125 byte-for-byte and seven module relinks PASS. Candidate index-0143b5ec5eff.js; deployment/live verification pending.
