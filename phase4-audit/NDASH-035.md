# NDASH-035 — Attendance employee filters use names as IDs

Status: deployed; live PASS.

Time Entries initially1353 rows/14 employee-name options. Selecting the first employee produces0 rows and removes all three filter selectors, preventing reset. Time Off Requests initially39 current-year rows/12 employee-name options. Selecting one employee produces0 rows and collapses the employee choices to All Employees. No source records changed.

Both components populate option values with employee_name but pass the value as employeeId to a hook that filters employee_id. Choices are then recomputed from already-filtered results. Time Entries additionally returns an empty-state block before rendering its controls.

Smallest complete repair: retain the already-loaded unfiltered time-entry dataset and current-year time-off dataset; apply employee-name and remaining display filters in the components. Keep options based on the original loaded scope. Keep Time Entries controls visible for zero matches. Preserve server year filtering for Time Off, all existing guards and the complete-read hook from034. No payroll calculations, date-offset changes, writes or provider access.

Files: GustoTimeEntries.jsx and GustoTimeOffRequests.jsx. Eight rendered-source tests cover positive name filters, combined office/type/status selections, empty-reset behavior, stable options, unrestricted results and year scope. Before2/8 pass; after8/8 pass. All125 frontend tests PASS; production build34.17s. Six actual patched-module renders PASS using synthetic QA records, including both empty cases. No business requests or exports during isolated tests. Seven targeted artifact regions; other component bodies and the full previous code graph preserved.

Deploymentbce13a03-e14c-4a4b-8adb-14f76002657e succeeded. Main /assets/index-7255faae59d4.js, SHA2567255faae59d4dd3cb4cac018d70ac3412d21cc6817381bc50b336f3bc2eadc4c; private ndash035-dist. Prior034 graph retained. Rocket version767 completed the same source changes.

Live after refresh:1353 entries retained; first employee selection returns34 rows, all matching the selected name, with15 chooser options retained. Rejected status produces a resettable empty state; clearing filters restores1353. Time Off employee selection returns1 matching record while all13 employee choices remain. Denied status gives a resettable empty state. Clearing filters restores39 current-year requests. Switching to2025 shows125 rows, all requested in2025;2026 restored. No business records, payroll calculations, source date offsets or configuration changed.
