# NDASH-148 — Operations Trends selected-office scope

Status: candidate verified; deployment/live verification pending.

Reproduced twice on the live Dashboard: Barnegat plus Brick, Last Month, Trends, then Update. All five chart paths remained identical to All Locations. Four legends still said All Offices.

Root cause: TrendsTab converted every selection other than exactly one office to a null location, which means all locations. Patient and appointment aggregate readers accepted only a scalar location; per-office addition would overcount patients and clinical days.

Targeted changes:
- TrendsTab validates/deduplicates selected offices, uses the retained financial aggregation helper, and sends a combined numeric location scope for patient/appointment summaries. Legends identify the selected scope. Dates, formulas, and null behavior remain unchanged.
- Two existing API wrappers validate/map/deduplicate the supplied location scope; their authentication and routing remain unchanged.
- Two existing SQLite aggregate methods use parameterized combined-location predicates. Distinct patients, earliest appointment dates, and distinct clinical days are calculated across the complete selected scope.

Recovery: exact production source snapshots are preserved in the existing private server repair directory under `ndash148-source-before`; the previous frontend graph is retained. Full reversal checks pass for both backend files and the frontend graph.

Verification before release: 762 frontend tests PASS; production build PASS (25.61 seconds); 17 backend suites PASS, including eight new synthetic read-only summary cases; compiled scope/legend checks PASS. Four new backend cases fail against the original code. The retained financial-scope suite initially received the already-repaired baseline; rerunning with its original historical baseline passed. No product change was made to resolve that harness error.

Backend candidate hashes:
- main_candidate.py: a3961f234a8895617052de9cce99306cb6380f48c2d650f4395ab2c160bf0336
- ascend_service.py: 85b660c8bd0e5da672636915aa3942ec3f0cc97870839de15acd681f1ec74664

Read-only preflight PASS: current API All/single baselines captured, selected distinct-count references checked, startup write flags disabled, existing two GET cache warmers preserved. No business data, authentication, credentials, configuration, or deployment infrastructure changes.

Rocket: first workspace update 877 required a narrow correction to invalid-office handling and reuse of the existing financial helper; follow-up completed in version 878 with invalid-office rejection and the retained financial helper.
