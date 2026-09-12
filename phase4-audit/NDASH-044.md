# NDASH-044 — Unreconciled benchmarks display zero deltas and OK

Section: Financial Analytics / Dentrix Reconciliation. Severity: High. Status: DEPLOYED; live verification PASS.

Read-only source HEAD counts:100benchmark rows,0reconciled; Barnegat1row. Live counters and office filtering match those counts. In that Barnegat row all3displayed dashboard values are missing(—), yet each comparison shows+$0.00 and statusOK. All100rows are pending reconciliation. Mismatches-only produces an empty result and retains controls; clearing restores the row. No import/sync triggered.

Root cause: DentrixReconciliationTab.jsx subtracts each benchmark from its own fallback when the dashboard value is null, yielding a false zero. MismatchBadge treats false flags asOK without requiring actual comparable values. Table status also checks3of6flags used by the summary/filter. A cursor/click changes expandedRow state but never renders details.

Source repair prepared: missing comparison pairs produce null/dash. Classify all6defined pairs using the existing±$1tolerance: any verifiable mismatch remains visible; otherwise any unavailable pair isPending; only complete comparable pairs canbeOK. Use the same status for badge/highlight/filter/mismatch count. Numeric database strings and actualzero remain valid. Keep reconciled_at workflow counts unchanged. Remove unusedexpandedRow state/cursor/onclick because it never rendersdetails. No data/query/authentication changes.

Tests: eight focused readiness/math cases PASS; 161 retained frontend cases PASS; source build PASS (34.74s). Rocket version 775 completed. Actual compiled candidate tests PASS for all six metric pairs, pending/mismatch precedence, filters/badges/null deltas, unchanged queries, complete reversal to live041, and seven dependency relinks. The compiled release preserves the unused hook state while removing its dead row click/cursor; this avoids unrelated hook changes and does not affect the repair.

Deployment: 98ee9921-21d8-48b3-ab57-dd55982d5dd5, asset /assets/index-3fde589b1281.js, SHA256 3fde589b1281d53d39a7a75d9ab38d3fc75878df479380c65193c33280170eb6. Released through the existing yadon-abem-01 / Cloudflare Pages process. Baseline041 remains recoverable at /home/openclaw/.cache/nudashboard-audit-20260910/ndash041-dist; new release is ndash044-dist. This separate candidate contains only the benchmark repair and excludes the still-pending042 label payload.

Live verification: PASS. Immediately before release, 100 rows showed OK with 300 false zero deltas despite 300 missing dashboard values. After release, the served script is the new asset; all100 rows show Pending and all300 deltas are blank, with no false zero deltas. Barnegat still has one Pending row; mismatches-only shows zero rows and retains controls; defaults restored. Browser error count0. No business data, import, sync, authentication, configuration, or backend change.
