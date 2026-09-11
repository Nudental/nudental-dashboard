# Remaining investigations — checkpoint 2026-09-11

These are not all assigned defects yet. Reproduce the original UI workflow before editing.

- NDASH-004: Monthly Growth reads stale legacy MEA financial fields (August net stored 0, collections differs from live Dentrix). Investigate a safe authoritative read-only query path; never substitute gross for net or run financial backfills.
- Operations Performance: table calls actual netProduction “Scheduled Prod” under “Scheduled vs Open Breakdown.” Source maps scheduled_production directly from netProduction. Repeat before a narrow label correction.
- Clinical source coverage: patient_procedures ends June 8, 2026; August cohort absent. All 3,253 August ledger rows unmapped in patient_procedure_map; only 196 join patient_procedures. Demographics zero and service-category unknown results reflect missing upstream history. No backfill performed. Record incomplete source behavior, continue unrelated work.
- Operations Payors Section 2: source sends officeId only for exactly one selected office; multiple selection sends all. The A/R fix NDASH-009 covers Section 1 only. Reproduce claim-level multi-office behavior and inspect pagination/aggregation before fixing.
- Office Performance: source transactionData, activityFeedData and expenseCategoryData are literal empty arrays. Transactions presents pages 1/2/3 regardless of zero rows, and handlers only console.log. handleExport only logs options. Reproduce Generate Report and pagination; investigate existing safe report/audit components to reuse.
- Office Performance TimeRangePicker: static labels “This Quarter (Q1 2026)” and “Last Quarter (Q4 2025)” appear in September. getDateRange uses dynamic current/previous quarter, so labels disagree with selected period. Repeat through UI before fixing.
- Office Performance summaries render internal range values such as this_month as text; presentation defect pending repeat.
- Expense AmEx source/location discrepancies described in earlier checkpoint remain open. Access guard NDASH-007 is resolved.
- Additional focused backend permission review remains pending; old fallback A/R routes have no obvious decorator guard. Inspect parameter/middleware enforcement and reproduce read-only before edits.

Office Performance secondary read-only browser tab 41 opened while the main tab waited for live A/R; main tab 38 remains the active repair verification surface. No business writes, exports saved or temporary records created in this checkpoint.
