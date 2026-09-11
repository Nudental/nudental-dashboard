# Financial Analytics audit checkpoint

- Trend repair040: unsupported invented expense/profit series replaced by supported Net Production and Total Collections; live PASS.
- Trend repair041: selected ending date scopes trailing12calendar months; live PASS atDec31andJun30,2026. Source/actual-artifact tests cover partial last month and stale requests.
- Reporting labels042: reproduced in Production & Adjustments and Collections; tested local candidate, Rocket774complete. Existing production041stillusesoldlabels. Exact upload approval pending after automatic review rejection.
- Production/adjustments043: gross/net/adjustment aggregate verified UI→API→read-only SQLite forJan1–Jun30,2026. Breakdown excludes reversal types included in established production calculation; tested separate API candidate.
- Collections: selected-range insurance961380.88 + patient625746.40 =1587127.28 matches UI/API. No database-level payment attribution check claimed yet. Payment Source Breakdown and current-day unavailable/zero behavior need further investigation.
- Service Categories: live gate correctly says coverage88.97% is below99%required; no table or enabled category filters shown. Clinical mapping/backfill intentionally not run. This data-quality blocker is related to previously recorded clinical history/mapping gaps. Source loading/error races remain unverified.
- Dentrix Reconciliation:100visible rows=exactsourcecount100; pending100/reconciled0; Barnegat filter1row=sourcecount1; mismatch-only empty and clear recoveryPASS. Source limit200doesnottruncatecurrent100rows. No import/sync. Missing values misleadingly render zero deltas/OK, assigned044. Row click has no rendered expansion.
- Remaining: Analytics scatter, multiple-office trend/comparison/forecast behavior, request-failure/zero distinction, goals/ranges, saved analyses, scoped exports, Collections methods/source checks, Expense Report and remaining Finance/Resources/Admin navigation. Audit not complete.

No Phase4business/testrecords created or changed. No real payroll, patient, employee, clinical, provider-sync, financial import/reconciliation or email actions executed. Current private evidence only; do not push it to the public repository.
