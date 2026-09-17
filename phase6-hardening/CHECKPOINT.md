# Phase 6 release checkpoint

Status: **IN PROGRESS — production migrations not applied**. This is not a Phase 6 completion report.

## Verified candidate

- All 42 original QA migration entries classified; Groups A–E adapted without importing synthetic records or simulation adapters.
- All 1,648 frontend tests PASS, no skips/failures; production/QA builds PASS; 6 compiled request-isolation checks PASS; 17 retained backend suites and 13 materializer tests PASS.
- Hosted QA contracts: A 12, B 11, C 10, D 15, E 10 = 58 PASS, using production permission configuration and rolled-back synthetic fixtures.
- All five group catalog/idempotence/owner/grant/rollback checks PASS. Native production rollback-only preflights PASS. Additional history-safe rollback checks: 5 PASS.
- Existing 13 active production accounts across 24 operational tables compared under baseline/candidate policies in rollback-only transactions. No increased record visibility; Super Admin visibility unchanged.
- Revised Group D closes a reproduced candidate reviewer-edit bypass. Approval-only access cannot create, edit request content, fulfill or self-approve.

## Live state

Production remains `277f68be-3819-410c-8ca6-6aa5ffa2a95e`, source `bac8407c55ed684ffb2ec5dc3dd639cc0a736b4b`; main remains `820970ede7727830d95d8d03d518d02119da1acd`. Asset `index-BBYhCGiP.js`, 8,836,680 bytes, SHA256 `8283c272644d33cf02bd1bf669e38194a638d87268a1f680bead816572e719e5`. Production frontend/API HTTP 200. Existing Tasks screen loads with two completed tasks; Executive Overview baseline figures unchanged in read-only UI checks.

QA frontend only is updated: `c3c958d8-fede-4be7-85e6-c7a61b635af9`, source `545068b96113d532dfa2b66c86b856fb7b5d8451`, asset `index-BLRu3uLQ.js`, 8,832,072 bytes, SHA256 `8239368b48cb28f0f8586e10d9091a15e117f59972ff83f26cab3ee0c3aa8c6b`. QA frontend/API HTTP 200; API intentionally remains `product_api_ready=false`. Database, API configuration and external-execution guards are unchanged.

Live QA Front Desk route: Super Admin PASS; Office Manager direct URL denied with review heading absent; Regional Manager navigation/access PASS; one review-page heading/mount; zero captured console errors. Only QA Office A/B appear. Existing QA identities were used; no password change or business test record was needed. Temporary login-helper process stopped and its tab closed. The browser is left signed in as the synthetic QA Regional Manager.

These client checks do not claim production migration deployment or persistent QA installation of the new SQL. Native candidate database write/bypass/audit tests were performed in rollback-only QA transactions.

## Recovery and outstanding gates

- `backup/production-before-phase6-group-a-20260917` preserves previous main.
- `backup/qa-before-phase6-20260917` preserves previous QA source `be846c8`; previous Pages deployment `7e91a103-ef44-4f3a-a667-447e112e6997` remains available. Source QA branch remains `2859ae6`.
- Per-group private schema snapshots, rollback SQL, row hashes and native receipts are retained locally and on the existing server. Never delete historical audit rows to restore Group C's old FK.
- Exact Group A production approval is pending after automatic approval review rejected the combined script's possible persistent path. The separate forced-rollback preflight was allowed and passed. Do not infer approval from elapsed time.
- API design decision is pending: separate scoped unattended access versus signed-in user sessions for every caller. One empty-result payroll probe accepted missing/invalid user sessions when the shared application key was supplied. Source inspection found 100 shared-key route declarations; this is not proof that every route lacks indirect authorization. Known validation scripts call business APIs; the watchdog references health only. No API authentication change or secret change has been made.
- Specialized implant/bone/supply audit tables have actor/office/action/state/time fields but no immutable historical actor-role field. Common `audit_logs` candidate context records actor role. Current-profile role lookup must not be presented as historical proof.

Continue after required decisions: fresh per-group backup/data guards → bounded production apply → live workflow/permission/audit verification → main fast-forward only after PASS. Frozen accounting remains outside this phase.
