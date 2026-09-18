# Metric and helper read boundaries

Candidate, not yet deployed. Three actual handlers were reproduced accepting the shared application key without human identity, using synthetic service data under the test guard. Source inspection found the same absent downstream human check in five related legacy helpers. No real provider/database call was used in reproduction.

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
