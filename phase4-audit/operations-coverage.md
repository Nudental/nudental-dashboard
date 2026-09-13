# Operations audit coverage — 2026-09-11

This records observed coverage, not full section completion. No business writes or test records created.

| View | Live read-only observation | Outstanding verification |
|---|---|---|
| Offices | August all-office gross $595,640.94, adjustments -$314,991.51, net $280,649.43 and collections $264,129.64 reconcile to prior verified API totals. Four office rows. | Sort, comparison modes, saved views, CSV save, combined filters. |
| Production | Provider-attributed plus unattributed residual equals office net production. Chair hours explicitly N/A. | Office combinations, date changes, source completeness. |
| Performance | Net production and collection goal percentages recalculate correctly. Missing case acceptance explicitly not wired. | Misleading Scheduled Prod label actually maps netProduction; repeat and repair. Provider filtering, chart interactions. |
| Providers | 17 provider/residual rows rendered; trust/source and residual explanations present; search available. | Search, sorting, drilldown, office mapping, scheduled-hours semantics. Office column displays dashes in all-office aggregate. |
| Services | All 3,253 August ledger rows show Unknown / Unmapped, net $280,649.43; demographics shows zero. | Source gap below, cohort buttons, goals/annual controls, category filtering. |
| Payors | Aging buckets sum to total $541,342.52; insurance office rollup sums to $244,872.43. Claim estimates clearly distinguished from AR. | NDASH-009 selected-office repair live verification pending; claim pagination/filter/sort detail. |
| Trends | Production, adjustments, collections, new-patient and broken-appointment charts render for twelve months. Missing data explicitly described. | Tooltip values, multi-office/date ranges, source completeness. |
| Cancellations | 39 no-shows +181 broken +0 cancelled =220; 220/1,338 scheduled =16.4%. | Individual/combined office selection, independent appointment source counts. |
| Claims / AR | Same verified aging snapshot; NDASH-008 denominator repaired and live 37.9% PASS. | NDASH-009 selected-office repair live verification pending; refresh persistence. |
| Marketing | Four office rows; total spend $12,609, new patients 202, group cost/new patient rounded $62. Source/status/date explanations present. | API category sum comparison and filters. Sync status read only; no sync triggered. |
| Scorecards | All four office scorecards render August production/collections goals and ratios matching KPI values. Missing metrics show dashes. | Local month/year filters, office combinations, threshold boundary tests. |

## Confirmed source-data limitation (no backfill run)

Read-only SQLite aggregate evidence saved privately in source-coverage.json. patient_procedures has 225,064 rows but latest service_date is 2026-06-08. No August procedure cohort exists. Of 3,253 August ledger rows, none joins patient_procedure_map and only 196 joins patient_procedures. Thus August demographic cohort is unavailable and CDT attribution is overwhelmingly absent from the persisted source. Raw patient records were not printed. A historical data import/backfill needs a separately scoped safety decision; do not infer demographic zero means zero patients or replace financial values with guessed values. Continue other audit work.

## Deployment/testing checkpoints

NDASH-007 backend access guard PASS. NDASH-008 aging percentage PASS. NDASH-009 selected-office repair passes 36 frontend tests, build and five actual-artifact cases; live Barnegat, Barnegat + Brick, Payors Section 1 and all-office restoration PASS. Every prior production dist and backend source backup is retained.

## Follow-up verification through NDASH-151 — 2026-09-13
The original checkpoint above is historical. Current evidence is in the individual repair records.
- Offices: current/prior-year/percentage/difference views and Location ascending/descending sort verified; negative percentage/count signs corrected in NDASH-147.
- Payors: Section 1 selected-office scope retained; Section 2 all/single/pair source parity and sorting verified in NDASH-145.
- Performance: all/single/pair production and collection source paths verified in NDASH-146. Unsupported Case Acceptance remains explicitly gated.
- Trends: all five charts now honor multi-office selection; six source metrics, overlapping distinct patients/clinical days, all/single parity and invalid scopes verified in NDASH-148.
- Cancellations: August all/single/pair source and KPI parity verified; Year To Date resolves the actual year interval in NDASH-149. Complete custom calendar months and explicit partial-month guard verified in NDASH-150.
- Shared filters: Operations now declares unsupported Provider Type grouping; Location, original August totals, synthetic preset readback and supported KPI caller behavior verified in NDASH-151.
All actions in these follow-ups were read-only with respect to business records. Partial-day Operations reporting and unsupported provider/detail mapping remain explicit limitations, not completed features.

- Providers follow-up NDASH-152: paired-office record selection and scope reset corrected; unchanged 15-row baseline, exact five detail values, single-office nine rows, All eighteen rows, search and both numeric sort directions verified. Existing unsupported detail charts remain gated.

- Marketing NDASH-153: paired-office spend scope corrected. August selected rows and all three headline KPIs match independent source aggregates; both charts use only the selected pair. All/single paths, repeated Update and default restoration PASS. Separate credit-adjustment field naming follow-up remains.

- Marketing NDASH-154: actual plural credit field now read; four known-zero credits and single-office readback verified. Other row values and all/pair KPI totals unchanged; signed cases covered synthetically. Credit-field follow-up closed.

## Scorecards follow-up — 2026-09-13
Read-only PASS: August 2026 Net Production, Collections, New Patients and Collection Rate for all four offices match independent backend148 aggregate fingerprints. Barnegat/Brick pair and single Barnegat exactly preserve the corresponding all-office card values. Switching the scorecard's own month selector to July changes the period and all four available metrics to matching July source references; restoring August recovers the initial cards. Four displayed goal attainments and both collection-rate benchmark badges match existing thresholds (90%/75% goal bands; 92% collection benchmark with its existing warning band). Unsupported Case Acceptance and Chair Utilization remain unavailable with no status badge. All Locations/August restored exactly and no browser errors. No goals, source records or saved filters changed; no provider sync. Failure injection and goal editing were not performed on production. No new scorecard defect was reproduced in these checks.
