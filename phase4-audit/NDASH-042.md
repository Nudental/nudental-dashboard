# NDASH-042 — Selected-range metrics labeled as monthly totals

Section: Financial Analytics, Production & Adjustments and Collections. Severity: Medium. Status: tested candidate, deployment pending.

Reproduced on041: applied2026-01-01–2026-06-30, yet both tabs show Month-to-Date toggles, Monthly KPI labels and office charts labeled(MTD). Production adjustment breakdown also says(MTD). The preset caption is independent of applied dates. Current-day view does not identify that it uses today's UTC date even for a historical selection.

Root cause: presentation assumes month-to-date, while fetchProductionMetrics/fetchCollectionMetrics pass resolvedStartDate/resolvedEndDate into production, adjustments and collections queries. Internal *_mtd field names are compatibility aliases for the entire selected range. Daily requests intentionally use today's UTC date. No evidence justifies changing those financial query semantics.

Fix: only ProductionAdjustmentsTab.jsx and CollectionsTab.jsx labels/captions. Selected Range replaces monthly/MTD labels. Current-day toggle and summary say Today(UTC), daily labels say Today's, and caption states Current day(UTC). Range caption uses the resolved start/end dates. Office charts and adjustment breakdown remain explicitly Selected Range even when current-day KPIs are selected. No requests, state IDs, formulas, dates, currencies or business data changed.

Verification:153 retained frontend tests PASS; production source build PASS36.25s. AST-scoped actual release changes18production labels and17collection labels, plus one caption each; every other expression is byte-identical and exact reversal restores041. Fresh names for7dependent code files; complete previous graph retained. Full source build is verification only. Actual candidate index-4d9fee85d2b1.js. No new tests added for this label-only change.

Deployment/live verification: pending. Rocket task submitted for the same two-component scope.

BLOCKED-DEPLOY-042: automatic approval review rejected the normal upload because explicit destination authorization named041 rather than042. No042files uploaded or deployed. Exact042upload/release approval requested; continue read-only audit while waiting. Candidate/source preserved at24a5ce1; no workaround attempted. Production remains verified041.

2026-09-13 revisit on128: applied January1–June30,2026. Production still displays Production Summary — Month-to-Date, Monthly Production/Adj/Net Monthly Production and MTD charts. Collections displays Collections — Month-to-Date, monthly KPI labels and MTD chart. Both defects re-reproduced before preparing the current release.

Prepared a new local042-v2 candidate from verified128 (49a929fd-f926-4b17-b9a1-e6cde0e8ea86). Exactly18 production labels,17 collections labels and2 captions change; all query/metric expressions remain unchanged. Existing source matches the mirror used by the latest586-test PASS/build34.53s; current caption fixtures pass selected Jan1–Jun30 and Today(UTC) cases. Exact full reversal to128 and all seven unchanged dependent modules PASS. Candidate index-f88dae71cc0e.js SHA256f88dae71cc0eb5595fe79d660548622218a7465159ec79e53cf9f1f2aec8d396. No files uploaded or deployed. The first local proof initially used JavaScript replacement-string semantics; corrected it to literal callback replacement and boolean comparisons before accepting the successful proof. Candidate itself was already generated with literal replacements and did not change.

BLOCKED-DEPLOY-042 remains pending specific user approval for this repair through the existing yadon-abem-01/nudashboard.com deployment path. Older042 candidate retained; no blocked upload was retried. Continue other safe audit work while waiting.
