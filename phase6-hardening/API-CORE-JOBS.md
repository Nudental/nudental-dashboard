# Existing background-reader compatibility

Candidate verification: 220 native identity/framework/helper tests PASS, with
zero blocked network or business-file attempts. The main application and all
route bodies are unchanged; 27 unrelated materialized files match production.
The 17 retained business suites passed for that identical implementation in the
preceding maintenance release. No deployment is claimed until a release receipt
and live read checks are saved.

This preparation changes only the scoped-job dispatcher and permits the existing
data validator to use its own read identity. Human core-read behavior is unchanged.
It precedes the later human identity gate to avoid disrupting current scheduled
readers during the transition.

| Existing reader | Additional exact GET paths |
|---|---|
| dashboard-validator | `/v2/production/by-provider` |
| reconciliation-validator | production/collections/adjustments summaries; goals; KPI/monthly reports |
| data-validator | production/collections summaries; daily/monthly/provider reports; goals; reconciliation; stream status |

The authoritative exact paths are `VALIDATOR_CORE_READS` in
`api_core_read_policy.py`. Both the reviewed identity-to-path mapping and the
private registry must authorize a request. The first two credentials and expiry
are preserved. A separate data-validator credential uses the same bounded expiry;
no credential is committed, printed, or sent to a provider. Existing all-office
validation jobs remain all-office read-only; no new operational action is added.

`patch-data-validator-access.py` changes only the actual request helper, forwarding
its credential to the existing fixed API origin and exact approved paths with
redirects disabled. Other existing reads keep their prior headers until reviewed.
No full validation job, provider action, schedule change or financial write is
performed. Configuration/source snapshots and rollback precede deployment.

Deployment order: install tested compatible source, restart and verify the existing
candidate then production services, extend the two existing private exact scopes,
provision the distinct data identity, patch the current helper, compare three live
read results, and verify off-scope reads and writes are denied. Roll back this
bounded source/configuration group if verification fails.
