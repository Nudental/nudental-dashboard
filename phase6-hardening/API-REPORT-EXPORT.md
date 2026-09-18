# Report export identity — bounded Phase 6 repair

Status: tested candidate; production activation pending its recorded deployment receipt.

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

The remaining route review is separate. This repair does not claim all shared-key routes are fully protected.
