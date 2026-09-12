# NDASH-079 — Sorting Patient Portion moves an open drill-down to a different row

Section: RCM / Patient Portion. Severity: High. Status: tested candidate; deployment pending.

Reproduced twice on frontend078: expand a uniquely identifiable numeric row, then sort Charge in the opposite direction. The original row remains loaded but closes, while another row opens automatically. Only boolean identity checks and aggregate amounts were recorded; patient identities and detail text were not printed. No record changed.

Root cause: GuarantorReconciliationTab.jsx stores the sorted array index in expandedRows and uses it for the expansion predicate and toggle. Sorting, filtering or loading a new page changes which record occupies that index.

Smallest repair: use the actual loaded row object in the existing expansion Set and toggle/predicate; clear the Set at load start. Sorting and filtering preserve those row objects, including distinct rows with identical values or missing identifiers. A new page or refetch starts collapsed and releases obsolete references. No synthetic identity scheme, deduplication, financial calculation, request parameter or unrelated React key change is introduced. ExpandedDetail is a pure rendering component.

Tests: five synthetic behavioral failures reproduced before; all350 frontend tests PASS after. Cases cover sort reversal, filtered row positions, identical-looking records, independent toggles and replacement-page/reset behavior. Production build31.49s PASS. Rocket807 completed the exact repair.

Release: three scoped AST edits to the actual078 component. Actual compiled expansion logic reproduces the old wrong-row behavior and passes sort/filter/identical-row/reset cases. Entire entry reverses to078; all prior repairs and seven dependency relinks PASS. Candidate index-9b44a0424870.js; backend076 unchanged. Blocked042/066 remain excluded;078 rollback preserved.

Live verification pending: expand an original row and sort in both directions; verify it remains expanded and no different row opens. Test filtering, collapse, page replacement, refresh and full reload; confirm counts and scorecards remain unchanged. No business writes or exports.
