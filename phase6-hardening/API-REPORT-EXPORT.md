# Report export identity — bounded Phase 6 repair

Status: DEPLOYED and live boundary verification PASS at 2026-09-18 05:53:57 UTC from `fa1730c752c4f26956c4d79b21e025e035a69f55`.

Rollback: annotated tag `backup/api-before-phase6-reports-20260918` and private server backup `api-report-backup-20260918T055345Z`. Main source SHA256 changed from `5270a49bb0623b96c5eb372dab409026adc257f0efcc5dacf3b10f33cb5c31f8` to `a08923dcad7fad1cd935ba17c845255ea0c8a72c16da5ea5f83edbe0fc1921cc`. Pages deployment and QA remain unchanged.

The previous export endpoint trusted `user_id`, `user_email`, and `user_role` in the request body. Its role check accepted the claimed Admin/Super Admin role. The existing application key was not a signed-in user identity.

The candidate validates the existing Supabase session, active/approved profile, real role, role permissions and office assignments before export execution. Audit attribution comes from that verified identity. Request-body attribution fields cannot grant access or impersonate another actor. Existing application-key verification remains an additional check.

Every currently authorized exporter in the captured production matrix retains access: Admin and Super Admin retain their existing export override; Regional Manager retains the full-workbook grant. The full-workbook grant does not create individual-export permission. Several existing fetchers return corporate/all-office totals even with a filter, so the gate requires authoritative all-office scope. No current scoped Office Manager or staff exporter is removed, because those roles have no enabled export grant. This does not change report calculations to manufacture office-scoped accounting totals.

Internal report GETs carry the initiating verified bearer identity only to the fixed local Dashboard API. Redirects are rejected. Background-job tokens cannot export or create audit rows. Provider credentials, job scopes, schedules, role permissions and frontend bytes are unchanged.

Verification:

- 64 local identity/payroll/report policy and transport checks PASS.
- 75 native Python/FastAPI tests PASS; network/business-data guard active with zero blocked attempts on the final run.
- 17 retained native backend suites PASS under the network/business-data guard.
- 28 report calculation, audit-writer and rendering functions are AST-identical. Only the export entry identity and internal request transport changed.
- Native FastAPI report tests use synthetic sources and an in-memory audit. Earlier test setup failures are retained; no production application or financial data was modified by them.
- Production positive export execution is intentionally not used as a test because it creates a real report/audit record. Live rejection probes use an invalid report type that also fails before export on the old handler; full authorized export success is covered by the actual handler in the native synthetic tests.

Live candidate and production rejection probes passed: missing/invalid session 401; read-only job 403; existing payroll validator 200. All 17,218 original guarded rows in expenses, Gusto expense facts, expense facts and export audit are unchanged. The 93 export audit rows are exactly unchanged. No real export ran. Configuration, job files, schedules, source calculations and frontend bytes are preserved. Production and QA health PASS.

The remaining route review is separate. This repair does not claim all shared-key routes are fully protected.
