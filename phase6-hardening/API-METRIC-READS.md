# Metric and helper read boundaries

Deployed and live-verified. Three actual handlers were reproduced accepting the shared application key without human identity, using synthetic service data under the test guard. Source inspection found the same absent downstream human check in five related legacy helpers. No real provider/database call was used in reproduction.

| GET route(s) | Existing access preserved and boundary |
|---|---|
| `/v2/hygiene/retention-metrics`, `/v2/hygiene/procedure-metrics` | KPI child grants or existing administrative reader; actual assigned office aliases |
| `/v2/provider-performance` | Same policy as the already protected provider-performance report |
| `/v2/financial/filter-options` | KPI child or Finance parent/relevant child grants; actual numeric, potentially multiple `locationId` values |
| `/v2/providers/email` | Existing compensation grant, all-office scope and configured email allowlist |
| `/v2/daily-entries` | Privileged raw legacy reader; administrative all-office reader, preserving actual officeId UUID/numeric and locationId numeric grammar |
| `/v2/metrics` | Cross-domain legacy diagnostic; administrative all-office reader, numeric location filter |
| `/v2/stream` | Global raw event stream; administrative all-office reader, no misleading office filter |

No active frontend or unattended caller was found for the raw daily-entry, normalized metric or stream routes. `start.sh` line 32 merely echoes the stream URL; it does not execute a request. The provider-email client already forwards signed-in identity through `dashboardFetch`. No new job routes, schedules, credentials or provider configuration are introduced.

253 native policy/framework/actual-handler tests and 13 materializer tests PASS; zero network/business-file guard attempts. All route bodies and 27 unrelated materialized files are unchanged. Sixteen new cases cover allowed and denied roles/grants, explicit denials, actual versus ignored selectors, cross-office attempts, no unintended job access and missing/invalid identity rejection before reads. All 17 retained backend suites also PASS under the guard. Live deployment is recorded separately after its result exists.

Deployment requires a fresh private source/configuration backup and original-row fingerprints, candidate-service checks before production restart, eight missing-identity 401 checks, eight denied job reads, preserved current validator summary/payroll reads and denied writes. Positive human browser checks must follow. No real provider sync, export, email, purchase, approval, clinical or financial write is authorized by this candidate.

Private recovery files remain on the existing server. Any rollback must retain the currently rotated reconciliation-validator credential; never restore its revoked predecessor.

## Metric and legacy helper read boundary — deployed

Source `749d8ee3900c25169f7c59e467f764665c91329b` applied at 2026-09-18T11:37:25.643504+00:00; main SHA256 `bbfa92220cdc8ca29592393b69ea84dffa1943ea39a1eaf9bc6b60b9f6c789a0`. Eight remaining metric/helper reads now require current human identity and their existing page/office authority. KPI hygiene and the provider alias retain actual scoped readers; Finance filter options validate the numeric multi-location parameter the handler consumes. Provider-email access follows existing compensation authority. Raw legacy diagnostics without a current frontend/job caller require the existing all-office administrative reader. Startup's stream reference is echo-only. No new background-job scope was granted.

253 guarded native tests, 17 retained backend suites and 13 materializer tests PASS. The original shared-key-only bypass was reproduced in three actual handlers using synthetic data. All route bodies and 27 unrelated materialized files are unchanged. Candidate/live missing identities return 401 on all eight routes; unattended job reads are denied 403. Existing scoped summary/payroll reads remain 200, summary content is unchanged and job writes remain 403. All 78,465 guarded original business/audit rows and 83,957 SQLite rows are preserved. Provider/configuration/job/frontend checks and production/QA HTTP/API health PASS.

Live signed-in KPI Main and Specialty views and Financial Analytics render without unavailable/permission warnings, alerts or captured console errors. Live positive checks used the existing Super Admin session. Raw legacy reads and provider-email lookup were not exercised against real records; their positive/negative cases passed natively. No provider sync, export, email, purchase, approval, clinical write or financial correction was executed.

Recovery: `backup/api-before-phase6-metric-reads-20260918`, `api-metric-read-backup-20260918T113657Z`. Private source/configuration recovery files remain on the server. Do not restore the revoked reconciliation-validator credential from an older backup. Remaining financial/RCM/provider route review, final regression and normal main integration are still pending.
