# NDASH-044 — Unreconciled benchmarks display zero deltas and OK

Section: Financial Analytics / Dentrix Reconciliation. Severity: High. Status: reproduced, root cause identified; repair pending.

Read-only source HEAD counts:100benchmark rows,0reconciled; Barnegat1row. Live counters and office filtering match those counts. In that Barnegat row all3displayed dashboard values are missing(—), yet each comparison shows+$0.00 and statusOK. All100rows are pending reconciliation. Mismatches-only produces an empty result and retains controls; clearing restores the row. No import/sync triggered.

Root cause: DentrixReconciliationTab.jsx subtracts each benchmark from its own fallback when the dashboard value is null, yielding a false zero. MismatchBadge treats false flags asOK without requiring actual comparable values. Table status also checks3of6flags used by the summary/filter. A cursor/click changes expandedRow state but never renders details.

Source repair prepared: missing comparison pairs produce null/dash. Classify all6defined pairs using the existing±$1tolerance: any verifiable mismatch remains visible; otherwise any unavailable pair isPending; only complete comparable pairs canbeOK. Use the same status for badge/highlight/filter/mismatch count. Numeric database strings and actualzero remain valid. Keep reconciled_at workflow counts unchanged. Remove unusedexpandedRow state/cursor/onclick because it never rendersdetails. No data/query/authentication changes.

Tests:8focused readiness/math casesPASS and161retainedfrontendcasesPASS. SourcebuildPASS34.74s. Rocket775completed samecomponentscope. Status check initiallyblockedbyautomaticreview; user explicitly approved existingRocketworkspace and statusreadthenpassed. Actualartifact/deployment/liveverificationpending;042browseruploadapproval is still unresolved, so do not overwrite its preserved candidate or bypass the rejected upload. This candidate is notlive. Private source/test commit a527cd8.
