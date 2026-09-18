# Existing background-reader compatibility

Candidate verification: 220 native identity/framework/helper tests PASS, with
zero blocked network or business-file attempts. The main application and all
route bodies are unchanged; 27 unrelated materialized files match production.
The 17 retained business suites passed for that identical implementation in the
preceding maintenance release. Deployed and live-verified; the receipt and bounded read checks are saved.

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
private registry must authorize a request. The dashboard credential is preserved; the reconciliation credential required equivalent rotation after a deployment-logging defect. Both retain their original scopes plus the reviewed reads and their original expiry. A separate data-validator credential uses the same bounded expiry;
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

## Existing validator read compatibility — deployed

Source `471290102ae1c28bcd08170529cbc97adcfdbb10` applied at 2026-09-18T10:13:00.519802+00:00. The existing dashboard and reconciliation validators now have only their reviewed additional GET routes; the existing data validator has its own separate exact read-only identity. Schedules, provider configuration, calculation logic and human access are unchanged. All application route bodies and 27 unrelated materialized files match the preceding release.

220 native identity/framework/helper tests and 13 materializer checks PASS. The 17 retained business suites are reused from the identical maintenance implementation, not claimed as rerun. Three live validator reads return 200 with unchanged responses; off-scope reads and writes return 403. No full job, provider action, financial write or schema change was executed. All 78,449 guarded original rows and 83,957 SQLite rows are preserved. Production/QA health PASS; current frontend remains `08f84700-056f-4af4-8f13-526a66ad8187`.

A release-script variable collision exposed the existing reconciliation-validator credential in tool output. It was replaced privately; the prior token now returns 401, the replacement read returns 200 and off-scope/write attempts return 403. Its routes and December 16 expiry are unchanged. Other job credentials are unchanged. Receipt handling was repaired and private original evidence preserved. Never reinstate the exposed credential when restoring an earlier configuration snapshot.

Recovery: `backup/api-before-phase6-core-jobs-20260918`, `api-core-jobs-backup-20260918T100733Z`, plus the equivalent-rotation record `core-job-equivalent-rotation-20260918T101520Z`. Source and private configuration backups remain on the server. Only the sanitized receipt is copied locally; automatic approval review rejected local transfer of credential-bearing recovery files. The human core-read gate is the next separate candidate; Phase 6 and main integration remain in progress.
