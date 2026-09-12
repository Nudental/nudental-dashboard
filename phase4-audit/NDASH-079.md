# NDASH-079 — Sorting Patient Portion moves an open drill-down to a different row

Section: RCM / Patient Portion. Severity: High. Status: repaired, deployed, live verification PASS.

Reproduced twice on frontend078: expand a uniquely identifiable numeric row, then sort Charge in the opposite direction. The original row remains loaded but closes, while another row opens automatically. Only boolean identity checks and aggregate amounts were recorded; patient identities and detail text were not printed. No record changed.

Root cause: GuarantorReconciliationTab.jsx stores the sorted array index in expandedRows and uses it for the expansion predicate and toggle. Sorting, filtering or loading a new page changes which record occupies that index.

Smallest repair: use the actual loaded row object in the existing expansion Set and toggle/predicate; clear the Set at load start. Sorting and filtering preserve those row objects, including distinct rows with identical values or missing identifiers. A new page or refetch starts collapsed and releases obsolete references. No synthetic identity scheme, deduplication, financial calculation, request parameter or unrelated React key change is introduced. ExpandedDetail is a pure rendering component.

Tests: five synthetic behavioral failures reproduced before; all350 frontend tests PASS after. Cases cover sort reversal, filtered row positions, identical-looking records, independent toggles and replacement-page/reset behavior. Production build31.49s PASS. Rocket807 completed the exact repair.

Release: three scoped AST edits to the actual078 component. Actual compiled expansion logic reproduces the old wrong-row behavior and passes sort/filter/identical-row/reset cases. Entire entry reverses to078; all prior repairs and seven dependency relinks PASS. Candidate index-9b44a0424870.js; backend076 unchanged. Blocked042/066 remain excluded;078 rollback preserved.

Live closure PASS: deploymentf0b02d78-43d0-4207-b8ab-fe48374f1bae, index-9b44a0424870.js, SHA9b44a0424870a17de9a88130bde71e6d25cd1bfed643752930ce81e6a145edb6. The original expanded row remains open after both Charge sorts; no different row opens. Office search preserves the same row; no-match hides it and clearing restores that same expansion. Finite charge values sort correctly; missing charges stay unavailable rather than being coerced into numeric test results. Pagination100/100/7 of207, last Next disabled, each replacement page collapsed. Refresh from an expanded final-page row clears expansion and returns page1/100. Full reload/reopen returns page1/100 with no details expanded. All six scorecards unchanged:19325.27/9065.33/14983.08/154/18/154. Alerts/errors0, frontend/API200, three services active. Backend076 unchanged;078 rollback preserved. No business writes or exports.
