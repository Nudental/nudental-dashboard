# Live navigation inventory — 2026-09-12

Observed from the visible nudashboard.com navigation after restart. This is a remaining-work index, not a claim that each section is complete. Prior coverage documents and individual defect closures must be read together; early coverage notes can predate later repairs.

| Navigation group | Visible destinations | Coverage / next pass |
|---|---|---|
| Home | Overview, Performance, KPIs | Prior executive and operations coverage; remaining combinations, chart interactions, source gaps and safe controls. |
| Operations | Office Perf., Provider Metrics, Monthly Trends, Regional Mgr | Prior operations/provider/regional-manager coverage; trend availability and remaining filters/exports need closure. Real supply decisions and notifications remain untested. |
| Finance | Payroll, Finance, Expenses, RCM | Payroll/finance/expense coverage retained. RCM currently completing Daily Comparison, then Dentrix Daily Summary, Patient Portion and eAssist Reports plus remaining Command Center/detail checks. No financial/clinical/payroll writes. |
| Audit | Audit Log, Audit Reports, Compliance, Heatmap, Alerts, Error Logs | Prior finance-audit-tools coverage and045–047 closures. Alternative-role access and unsupported/purge/security writes remain untested. |
| Workflow | Huddle, Insurance, EOD, Tasks, EOD Queue, Approvals Queue | Continue read-only navigation, counters, filters, validation and safe isolated writes only if architecture supports them. No real schedule, clinical record or approval changes. |
| Resources | Reports, Inventory, Directory | Continue live functional coverage; no real supply/staff changes or external report delivery. |
| Admin | Users, Providers, Settings, Sync, Data Health, Import Audit, Manual Entry, System, Reconciliation, Alert Thresholds | Continue read-only controls, connection/source health and validation. Do not alter users/permissions, sync/backfill/import, thresholds/security, business records or configuration to test them. |

Protected unresolved items:004 source history gap;042 upload approval pending;066 rolled-back candidate lacks root cause and stays excluded. The rejected AR patient-detail500 comparison and broad Employee Benefits read remain prohibited. No ordinary-role test account or isolated Dashboard write environment has been established; record those limitations precisely rather than claiming positive write/access tests.
