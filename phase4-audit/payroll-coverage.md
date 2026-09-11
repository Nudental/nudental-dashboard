# Payroll coverage — Phase 4 in progress

Dentrix Ascend read view: scheduled, custom, partial, empty, and future-year states checked. NDASH-021 prevents read-time mapping writes; NDASH-022 removes blank placeholder run; NDASH-023 prevents stale financial rows and misleading empty-state KPIs. Read-only fingerprint unchanged for 37 saved mappings after final live checks. Mapping tools, payroll/compensation editing, employee modifications, and email delivery intentionally untouched.

Imported from Gusto Overview: opens without browser errors; current and historical totals checked against private read-only API/database aggregates. Reconciliation RPC source contains only SELECT calculations; mount does not invoke the disabled sync RPC. Re-sync remains disabled. NDASH-024 period fix in progress.

Confirmed remaining Gusto defects, not yet repaired:
- Contractor spend KPI silently shows zero after `/v2/payroll/contractors` returns 404. Contractor Spend by Year chart uses annual payroll net pay and even labels its series Payroll. Needs a valid read-only contractor source plus accurate unavailable/error handling.
- Off-cycle chart receives literal `offCycleCount={0}`. Source/API have 2 off-cycle runs in 2026 (18 regular), 7 in 2025 (26 regular), and 35 among all 157. Assign next defect after024; calculate from imported flag.
- Reconciliation badge says 100 unresolved offices, but source fetches up to 100 unresolved expense fact rows. Need count/label verification; it is neither a distinct-office count nor complete above the cap.
- Next Payroll sends ascending sort but existing backend always returns descending runs; only one row requested. No future run currently exists, so positive live ordering is unavailable; isolated future-run test and narrow correction needed.
- Failed subqueries generally fall back to zero; never assume a rendered zero establishes data availability.

Not yet audited: Gusto Employees, Payroll Runs, Contractors, Benefits, Pay Schedules, Import History, Time & Attendance; Comparison and Provider Compensation subviews. Inspect mount effects before opening. Do not start imports or write workflows on real records. No Phase4 payroll fixtures created.
