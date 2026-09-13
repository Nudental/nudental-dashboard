# NDASH-151 — Operations grouping capability

Status: CLOSED — deployed and live-verified PASS.

Severity: Medium — an available report control claimed a grouping that Operations did not perform.

Reproduction: twice select Provider Type from Operations / Cancellations / Last Month / All Locations, then Update. The filter claims Provider Type, but the report retains its Office columns and identical August location aggregate fingerprint e11f9310. No limitation was shown.

Root cause: the shared filter advertised Provider Type for every caller. Operations only forwards dates and office scope to its reports and does not implement provider grouping.

Small fix: add an allowProviderType capability, defaulting true for existing shared callers. Operations alone passes false. Its Provider Type option is disabled with an explicit explanation; initial state, selection callbacks, and saved-filter readback resolve to Location. Date, custom-date, office and other filter fields remain intact. This corrects a misleading control; it does not implement a new provider-grouped Operations report.

Changed components: GlobalFilterBar.jsx and operations/index.jsx. Nine focused tests PASS; five fail against the preceding source. All 787 frontend tests PASS; production build PASS (31.77 seconds). Actual compiled dropdown, callbacks, synthetic saved-filter readback and shared-caller behavior passed before candidate generation. Full reversal and seven dependent-module checks recorded separately.

Rocket completed version 881. No backend, configuration, credentials, permissions or business-data changes. Production saved filters are not modified; readback tests use synthetic local fixtures only. Backend remains NDASH-148. Publication excludes blocked NDASH-042 and NDASH-066.

Release: source 25eac23; deployment 29a569f0-310e-4bc4-aad5-60ab6c0038a3; entry `/assets/index-f7f325c7c50b.js`; SHA-256 f7f325c7c50b06f8627f63becfa3687f6a73c26940e291e0b2909297a45e76e1 (21740194 bytes). Full reversal to NDASH-150, seven retained dependent modules, syntax and exact live artifact PASS. Frontend/API 200, all three services active, backend148 hashes unchanged.

Live PASS: Operations displays Location; Provider Type is disabled with the explicit limitation. Original Cancellations August All Offices fingerprint remains e11f9310 before and after Update. On KPIs the shared Provider Type option remains enabled, selecting it activates the Providers tab, and Location can be restored. Operations defaults restored; zero new browser errors. No production saved filters or temporary business records created.
