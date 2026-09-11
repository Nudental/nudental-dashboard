# NDASH-035 — Attendance employee filters use names as IDs

Status: scoped correction tested; deployment pending.

Time Entries initially1353 rows/14 employee-name options. Selecting the first employee produces0 rows and removes all three filter selectors, preventing reset. Time Off Requests initially39 current-year rows/12 employee-name options. Selecting one employee produces0 rows and collapses the employee choices to All Employees. No source records changed.

Both components populate option values with employee_name but pass the value as employeeId to a hook that filters employee_id. Choices are then recomputed from already-filtered results. Time Entries additionally returns an empty-state block before rendering its controls.

Smallest complete repair: retain the already-loaded unfiltered time-entry dataset and current-year time-off dataset; apply employee-name and remaining display filters in the components. Keep options based on the original loaded scope. Keep Time Entries controls visible for zero matches. Preserve server year filtering for Time Off, all existing guards and the complete-read hook from034. No payroll calculations, date-offset changes, writes or provider access.

Files: GustoTimeEntries.jsx and GustoTimeOffRequests.jsx. Eight rendered-source tests cover positive name filters, combined office/type/status selections, empty-reset behavior, stable options, unrestricted results and year scope. Before2/8 pass; after8/8 pass. All125 frontend tests PASS; production build34.17s. Six actual patched-module renders PASS using synthetic QA records, including both empty cases. No business requests or exports during isolated tests. Seven targeted artifact regions; other component bodies and the full previous code graph preserved.
