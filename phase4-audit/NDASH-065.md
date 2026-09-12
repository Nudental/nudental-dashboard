# NDASH-065 — Year comparison chart uses a different production measure from its KPI

Section: shared Year Comparison panel, reproduced in RCM. Severity: Medium. Status: repaired, deployed, live verification PASS.

Reproduced on064: choose2025; annual Net Production (MEA) card6580370 matches stored net_production6580369.65, but monthly Production chart January is567750.50 (verified from rendered SVG coordinates against its0–600K axis), matching production_total rather than net_production571981.73. Switching to Collections and back reproduces the same amount. All12 months differ between these source fields. Read-only aggregate probe:48rows,4offices,12months,0duplicateoffice-monthgroups. Other cards match collections2810361.78/newpatients1642/expenses1902290.15. No raw patient records accessed or retained.

Root cause: YearComparisonPanel.jsx passes production_total explicitly to buildMonthlyComparisonData, overriding its net_production default, while the annual KPI uses net_production. Smallest fix: first CHART_FIELDS key/label becomes net_production / Net Production (MEA), and activeField initial state becomes net_production. All other chart fields, query behavior, date filters, annual cards, null/zero handling, permissions and payroll preserved. No database changes.

Source verification: before repair2 regression failures/1pass; after294testsPASS. Production build30.11sPASS. Rocket795 implemented the same two source-line changes. Actual deployed component packaging changes only3string literals across its261-byte field array and29022-byte panel component. Candidateindex-63461c634706.js; prior064deploymente6ab7483-1e42-4ee3-b85b-35156270e56a retained. Compiled artifact regression/full reversal/seven dependency relinks PASS.

Data limitation remains BLOCKED004:2026has36rows/9months/4offices and20storedzero net amounts. Net total999776.92 versus legacyproduction_total4851788.24. This display repair does not certify financial completeness or substitute gross for storedzero, repair the upstream writer, or backfill records. Financial-source authority remains unresolved separately.

Live closure: deployment8afdd341-91fb-4509-9727-76d98c62b03e, candidateSHA63461c634706998b637eece1fb35e70216a8b6c602a19c017ec5ccad6faad9e3. First navigation briefly served064 during edge propagation; repeated navigation confirmed065asset. January net chart571981.73, Collections245705.56 unchanged, switching back and fullrefresh/reselect return571981.73. Annual cards unchanged; RCMClaims50rows/mainAugustdates/zeroalerts/errors0. No financialwrites. All priorgraphs retained.
