# NDASH-042 — Selected-range metrics labeled as monthly totals

Section: Financial Analytics, Production & Adjustments and Collections. Severity: Medium. Status: tested candidate, deployment pending.

Reproduced on041: applied2026-01-01–2026-06-30, yet both tabs show Month-to-Date toggles, Monthly KPI labels and office charts labeled(MTD). Production adjustment breakdown also says(MTD). The preset caption is independent of applied dates. Current-day view does not identify that it uses today's UTC date even for a historical selection.

Root cause: presentation assumes month-to-date, while fetchProductionMetrics/fetchCollectionMetrics pass resolvedStartDate/resolvedEndDate into production, adjustments and collections queries. Internal *_mtd field names are compatibility aliases for the entire selected range. Daily requests intentionally use today's UTC date. No evidence justifies changing those financial query semantics.

Fix: only ProductionAdjustmentsTab.jsx and CollectionsTab.jsx labels/captions. Selected Range replaces monthly/MTD labels. Current-day toggle and summary say Today(UTC), daily labels say Today's, and caption states Current day(UTC). Range caption uses the resolved start/end dates. Office charts and adjustment breakdown remain explicitly Selected Range even when current-day KPIs are selected. No requests, state IDs, formulas, dates, currencies or business data changed.

Verification:153 retained frontend tests PASS; production source build PASS36.25s. AST-scoped actual release changes18production labels and17collection labels, plus one caption each; every other expression is byte-identical and exact reversal restores041. Fresh names for7dependent code files; complete previous graph retained. Full source build is verification only. Actual candidate index-4d9fee85d2b1.js. No new tests added for this label-only change.

Deployment/live verification: pending. Rocket task submitted for the same two-component scope.
