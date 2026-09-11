# NDASH-018 — Fabricated provider categories and ineffective controls

- Reproduced live twice: category tabs hide all named providers; the separate category dropdown changes its value without constraining results. Expanded rows assign all amounts to General.
- Root cause: Provider Performance invents a `categories.general` record from total production/collections. Actual filter options use category UUIDs, which never match; dropdown selection is unused by its API request.
- Safe correction: remove the fabricated attribution, remove specific category options from this page, disable its category select with an explicit unavailable label/tooltip, and show an unavailable breakdown in expanded rows. Date/office/provider-type functionality and real totals remain intact. Three scoped frontend components changed.
- Source limitation remains open: the existing provider/CDT endpoint for August returns only Unknown / Unmapped categories and has no category-level collections. Current provider-performance response supplies neither verified category attribution nor category collections. Do not claim positive category analysis is complete. No ingestion/backfill or source-data change performed.
- Tests: 58 frontend regressions PASS; production source build PASS (28.91s). Exact artifact scope/reversal and syntax checks required before release.
- Deployment and live verification pending.
