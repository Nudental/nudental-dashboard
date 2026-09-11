# NDASH-044 — Unreconciled benchmarks display zero deltas and OK

Section: Financial Analytics / Dentrix Reconciliation. Severity: High. Status: reproduced, root cause identified; repair pending.

Read-only source HEAD counts:100benchmark rows,0reconciled; Barnegat1row. Live counters and office filtering match those counts. In that Barnegat row all3displayed dashboard values are missing(—), yet each comparison shows+$0.00 and statusOK. All100rows are pending reconciliation. Mismatches-only produces an empty result and retains controls; clearing restores the row. No import/sync triggered.

Root cause: DentrixReconciliationTab.jsx subtracts each benchmark from its own fallback when the dashboard value is null, yielding a false zero. MismatchBadge treats false flags asOK without requiring actual comparable values. Table status also checks3of6flags used by the summary/filter. A cursor/click changes expandedRow state but never renders details.

Required narrow repair: missing comparison values must show unavailable/pending, never zero/matched; status/filter must consistently inspect the defined comparisons. Preserve stored benchmark/data values and do not run financial reconciliation to populate them. Remove or complete the unsupported row expansion affordance based on the available fields. Add isolated rendering/classification regressions before release. No edits/tests/deployment yet.
