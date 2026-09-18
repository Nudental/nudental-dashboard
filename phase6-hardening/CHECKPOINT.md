# Phase 6 active checkpoint

Updated 2026-09-18T07:10:28.471835+00:00. Phase 6 remains IN PROGRESS; continue autonomously under Dr. G's explicit B–E/client approval.

## Do not repeat completed deployments

Groups A–E are applied and verified. Approved migration hashes and fresh backup directories are in the [full report](../production-release/CLOSURE.md) and [inventory](../production-release/release-inventory.json). Do not rerun apply scripts or regenerate the validator credentials. B's first attempt was rolled back because its verifier used stale counts; the unchanged SQL passed fresh in-transaction role guards on retry.

Production frontend `a81545bf-4463-4dc3-9b33-3cad855888d7` from `145adebb5e9367d3854fe96edd913464fd33053e` is live; entry `index-BnAyRbiv.js` SHA256 `3b395fa391d7b95f909644c528ef8b2290536fabef95a2edaaea7c929f09d715`. Dedicated Front Desk review UI passes, new client is active, QA unchanged. Fresh 1,648 tests, build and six compiled checks PASS.

API now includes payroll, report-export and provider-compensation identity releases from `a0454b2e243cce5be407bf8e900df1e066ffb61c`, main hash `cfd39140f772dd59a1fec46d4b22c1971cf1f6394ba0e600af275bed6df7d711`. Compensation applied at 2026-09-18T06:19:07.343197+00:00: 70 local/88 native tests, 17 retained suites, live 401/403 denial checks, existing payroll job 200, production/QA health PASS. All 17,218 financial/report-audit original rows and configuration/jobs unchanged. No actual report/export/email. Payroll and Provider Compensation UI PASS. Backup `api-compensation-backup-20260918T061853Z`, pushed tag `backup/api-before-phase6-compensation-20260918`. Do not reapply. Prior report source `fa1730c752c4f26956c4d79b21e025e035a69f55` and its backup remain preserved.

Latest API source is now `78cdc3c1994ac27dd3ac177abf1fd434984a8f06` following the one-file OTP administrative restriction at 2026-09-18T06:35:08.187866+00:00. Main hash is unchanged; OTP hash `c97d66935708e9b4a13151a73167d2f189e73645ed3d1ba6937e09d8aea4529e`. 99 native tests PASS; 20 unchanged materialized files retain the prior 17-suite verification. All 20,790 financial/device/settings/auth-audit original rows unchanged. Missing/invalid identity 401, jobs 403, existing payroll validator 200; production/QA health and refreshed Payroll UI PASS. Backup `api-otp-backup-20260918T063451Z`, pushed tag `backup/api-before-phase6-otp-admin-20260918`. Do not reapply.

Current deployed API source is `bad155018f53baaf129f0f8681481bea62b6b634`, main SHA256 `674c553d5b4905b7f0357abae64bce3cb7fd5f983295f2214edf7c7b827ded98`, after signed Plaid webhook release at 2026-09-18T06:56:25.484273+00:00. OTP module remains the preceding verified version. 124 native tests, 17 retained suites and live 401/403 probes PASS; existing payroll job 200. All 20,835 fresh guarded rows, Plaid connections and job/service configuration unchanged. Zero test-triggered provider calls/syncs/emails. Snapshot `api-webhook-backup-20260918T065608Z`, pushed tag `backup/api-before-phase6-webhook-20260918`. Executive Overview/production/QA health PASS. Do not reapply.

Canonical main remains `820970ede7727830d95d8d03d518d02119da1acd`; final integration pending.

## Remaining execution

1. Finish the remaining API authorization review and bounded safe protections. Static inventory is `work/phase6/evidence/remaining-api-route-inventory.json` (159 route declarations across main, OTP and report export). Inspect downstream identity, existing permissions/office scope and caller inventory; declaration counts are not vulnerability counts. Report export and provider-compensation identity are now fixed and deployed. Cache prewarming, scheduled Plaid reads and existing validators need exact scoped identities if their remaining routes are tightened. Preserve provider callbacks and normal schedules.
2. Dated Payroll Comparison UI PASS on August 2–15, 2026: 13 filtered rows and no date guard. Browser keyboard/fill succeeded; never reopen the native picker. Native source-response PASS at 05:48 UTC: the same selected dates and 13 rows, two Supabase GETs and read-only SQLite, zero provider calls/writes. No matching HTTP access log was available; transport identity is separately tested. This item is complete; do not repeat payroll checks.
3. Finish final read-only production/QA regression and data/config checks, record precise limitations, then normally fast-forward verified intended source into main and push. No force push; do not claim completion before these gates.

## Recovery and data notes

Frontend rollback: `277f68be-3819-410c-8ca6-6aa5ffa2a95e`, `backup/production-before-phase6-frontend-20260918`, `frontend-backup-20260918T045834Z`. All group snapshots and earlier tags remain preserved. Group C rollback must preserve deleted-object audit history. Financial proposals remain frozen.

One existing Huddle page auto-initialized an unsubmitted September 18 draft at 04:18:07 UTC with 19 blank checklist and four blank provider children. Preserve it; use history/review pages for further read-only tests. Original-row migration guards PASS; do not claim zero incidental operational inserts. Existing EOD freshness warning remains; no sync triggered.

Current browser: production tab 68 on Executive Overview, signed in; post-release UI PASS, zero captured errors. Previous tab 67 disappeared. Use current browser inventory if this changes. Server prefix: `/home/openclaw/.cache/nudashboard-phase6-20260917`; repository `work/phase6/release`. No password reset, bank login, provider sync, financial edit or new phase is authorized.

## Remaining review evidence

MCP review COMPLETE: existing Collaboration Platform FastMCP service on port 5222 uses its dedicated EnvironmentTokenVerifier. Mounted local `/mcp` without/with invalid identity returns 401; public `/mcp/mcp` returns 403. Public OAuth metadata does not grant downstream data access. No MCP tool executed and no Collaboration configuration changed. Evidence: `mcp-effective-boundary-review.private.json`.

Remaining findings to address in bounded groups: other Dashboard reads need verified human role/office checks; RCM contact writes trust body actor/office; Amazon approval handlers need current identity/office/no-self checks; Plaid webhook/Gusto callback need downstream verification review. Do not execute financial/clinical writes, callbacks, provider syncs, emails, purchases or scheduled jobs while testing. Compensation release is complete. OTP administrative helpers are now fixed. Plaid webhook verification is now deployed. Next: remaining read/job, operational write and Gusto/Amazon callback boundaries. Canonical main remains pending final gates.

## Remaining API review / next work

Plaid webhook release is complete. Current user-role/office reads, scoped job compatibility, RCM contact writes, Amazon order actions and Gusto/Amazon OAuth callbacks remain. Inspect actual consumers before tightening; do not trigger jobs, provider syncs, emails, approvals, purchases or financial/clinical writes. A new read-only `inspect-dashboard-api-callers.py` inventory covers middleware, existing scripts and Collaboration MCP references; retrieve `dashboard-api-callers-review.json` before implementing the next route group. No Collaboration Platform edits are authorized by this task.

Core-read design must preserve exact existing page permissions and Office Manager scope; do not treat arbitrary/ignored query parameters as proof of filtering. Current UserResolver retains only enabled permissions, so any mirroring of frontend Admin/regional fallback grants must also retain explicit false rows. Existing `get_providers` is professional reference metadata (ID/name/NPI/title/specialty, no office field); schedules/patient detail require a separate object/office review. Shared-key validators and scheduled Plaid/cache reads need exact service scopes before their routes are gated. Existing 90-day validator credentials must not be regenerated.

Gusto callback currently ignores state and saves a response before checking token success; bounded inspection found no pending Gusto state or Gusto-named authorization script. Amazon callback checks state only when a saved state exists, and includes state values in its error. Review legitimate setup consumers before choosing the smallest safe nonce/token-persistence repair. No OAuth flow or credentials have been changed.

Fresh webhook preflight already contained 43 additional expenses and two additional auth-audit rows compared with the OTP preflight; no cause is attributed. Each deployment's original rows were preserved. Do not reopen accounting investigations. Final main integration still awaits remaining API review and final regression.
