# Administrative API boundary

The ten routes in `api_admin_policy.py` are DEPLOYED and verified from `cf9cff66d030b7c14943f60d10f51e895a9cc650`. Applied 2026-09-18T07:26:41.952563+00:00.

The preserved cache-clear handler accepted a valid application request without
checking a person. This was reproduced by extracting the actual old handler
and substituting an in-memory cache action; no production maintenance ran.
The other nine handlers likewise have no downstream user/role authorization.

The candidate verifies the current active/approved Supabase user before any
handler executes. The existing application key remains an additional check.
All ten handlers have global scope and require existing all-office access.
Admin/Super Admin retain diagnostic views, matching the deployed Sync and Data
Health page guards. Other roles require the exact existing page permission to
read a diagnostic; that grant never becomes maintenance authority. Maintenance
requires Super Admin, or Admin with the existing Sync/Data Health permission.
Every job credential is denied. Callback, payroll, regular financial reads,
provider credentials and schedules are outside this batch.

The middleware is the only main-module change. Every existing route body is
AST-identical to the deployed webhook release. Native tests use intercepted
actions; live verification uses GET denial checks, including GET on POST-only
maintenance paths, so a previous release could not execute a maintenance action.

136 native cases PASS with network/business-data guard active and no blocked
attempts. These include retained identity/payroll/report/compensation/OTP/Plaid
tests and administrative role, scope, forged query, duplicate credential and
wrong-method checks. No production financial, clinical or operational write is
part of verification.

## Administrative API boundary — deployed

Source `cf9cff66d030b7c14943f60d10f51e895a9cc650` applied at 2026-09-18T07:26:41.952563+00:00; main SHA256 `8b057829ac239c2d4aa4b9815b6823ea114fb90a3885829c669235728655e8ef`. Ten diagnostic/maintenance routes now require verified human identity, existing role/page permission and all-office scope. Jobs are denied. Existing route bodies are unchanged. 136 native tests, 17 retained backend suites and 13 materializer checks PASS. Candidate and production denial probes PASS; the existing payroll validator remains 200.

Fresh guards preserved all 20,868 original rows; provider configuration, job credentials, schedules, service settings and frontend artifact are unchanged. Live Sync Dashboard renders API Proxy Online and 29 job entries, with no captured console errors. No sync, recomputation, seed or other maintenance action was triggered. Production and QA HTTP/API health PASS. Recovery: `backup/api-before-phase6-admin-20260918`, `api-admin-backup-20260918T072624Z`. The full private backup is preserved locally and on the existing server.

These row counts are per-deployment snapshots. Intervening records existed before this release; no cause is attributed and accounting follow-up remains frozen.
