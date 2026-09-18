# Administrative API boundary

Candidate for the ten administrative routes listed in `api_admin_policy.py`.
Deployment is pending until its fresh backup, retained-suite and live gates pass.

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
