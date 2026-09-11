# NDASH-036 — Attendance labels misstate coverage and availability

Status: deployed; live PASS. Severity: Medium.

Reproduced after035: Summary — Current Pay Period labels1353 entries spanning Sep15,2025–Jul3,2026; summary cards also claim This Period. The banner says API access is expected May2026 and data will become available, despite1353 entries,39 current-year requests and11 current-year hour summaries already displayed.

Root cause: fixed copy was never tied to the actual read scope. Parent hooks request all imported time entries/requests/balances and current-year hours. No current-pay-period filter is applied.

Fix only display text in GustoTimeAndAttendance.jsx and GustoTASummaryCards.jsx: Summary — Imported Records; Employees with Imported Time Entries; Total Imported Hours; Overtime Hours YTD. Banner explains the actual imported and current-year scopes. Two comments updated. No formulas, queries, filters, dates, data or configuration change.

Verification:125 retained tests PASS; build35.03s; six existing actual-module attendance filter cases PASS; target module parses and exact reversal confirms only five display regions changed. No new tests added for static wording. Full earlier code graph retained. Live verification pending.

Deployment2c563c49-7e4d-4543-bf72-a816f2ae51e8 succeeded. Main /assets/index-5cd2646c3645.js, SHA2565cd2646c3645e7dba0b708a012bcf8833ab3ba31da3f61036b8de5d6f717d612; private ndash036-dist. Previous035 graph preserved.

Live after refresh PASS: Summary — Imported Records, revised card labels and the imported/current-year scope banner display correctly. The expected-May2026 claim is absent. Counts remain1353 entries,14 tracked employees and10466.1 imported hours; overtime206.1 is labeled YTD. No data, financial formula, provider sync, date-offset or configuration changes.
