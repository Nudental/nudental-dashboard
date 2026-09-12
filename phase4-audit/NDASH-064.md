# NDASH-064 — Reversed custom dates mount an apparently valid empty report

Section: shared RCM date controls. Severity: Medium. Status: repaired, deployed, live verification PASS.

Reproduced twice on063 using native date-field keyboard events: Aug20→Aug15 and Aug26→Aug25. End input is invalid (rangeUnderflow), but no validation message appears and Claims renders a normal empty-result state. ValidAug2→15 works. Automation note: filling native date fields alone does not commit React state in the current browser tool; use native changes before evaluating app behavior. The fill-only mismatch is not an app defect.

Root cause: end-input min constrains native validity but the effective range has no report-render guard. Targeted RcmModule/index.jsx repair: reversed effective dates show an accessible alert instead of mounting the nine reports that consume shared dates. Independent PatientBalances/DailyComparison/DentrixDailySummary remain available. Existing permissions, tab content, valid/same-day/default ranges, calculations and all business data are preserved.

Tests: actual JSX fragment render fails the invalid-range case before repair; after repair all291 source testsPASS, including valid and same-day ranges, independent views and permission denial. Existing esbuild used for JSX tests (no new dependency installed; tests need local process permission). Production build32.39sPASS. Actual compiled E_t report-content gate testsPASS across all nine date-dependent reports, with exact valid/independent content equivalence and permissions preserved. Full reversal to063/prior repairs/sevenrelinksPASS. Rocket794 completed the matching date validation.

Candidateindex-6ecef88c82a4.js; expected prior deploymentc9318daf-ac3e-41e7-a5b4-13533e1c0ab7. Prior063 retained. No backend/configuration changes, data writes, exports or sync.

Live closure: deploymente6ab7483-1e42-4ee3-b85b-35156270e56a, SHA6ecef88c82a4643c748193f75f1ee77cfde0a9e6cc0bafd33e3e96f4cb427f50. ReversedAug20→15 nowshowsalert/zeroClaims tables/only2global selects. PatientBalances independentlyloads1278/50rows/noalert. CorrectAug20→25 restoresClaimscontrols/noalert; same-dayAug20accepted. RefreshLastMonthAug1–31/1011claims/50rows/noalerts/errors0. Prior063retained; no businesswrites.
