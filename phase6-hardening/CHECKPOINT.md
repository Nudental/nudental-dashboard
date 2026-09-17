# Phase 6 release checkpoint

Status: **IN PROGRESS — Group A and bounded payroll API identity release deployed; Groups B–E await exact approval after automatic review rejection**. This is not a Phase 6 completion report.

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
- Dr. G explicitly approved Group A and separate restricted background-job API access. Group A applied 2026-09-17 21:51 UTC; 4,425 row fingerprints unchanged, seven functions/two policies/five triggers, existing owners/grants preserved. Fresh rollback directory: production-a-20260917T215054Z on the existing server. Live Tasks/Profile PASS; all 13 active actors across Tasks/Notifications match reviewed visibility; production and QA frontend/API HTTP 200.
- Automatic review rejected Group B because the latest explicit approval named only Group A. One combined B–E approval request is pending; do not retry production apply until answered.
- API design decision approved: signed-in user access plus separate scoped unattended access. The reproduced payroll probe formerly accepted missing/invalid user sessions with the shared application key. The eight-route payroll release now rejects those requests. Two existing validators have separate expiring read-only credentials, limited to their exact reviewed routes. The original application key, provider credentials, schedules and environment configuration are unchanged. Source inspection found 100 shared-key route declarations; this is not proof that every route lacks indirect authorization, and remaining route groups are not claimed complete.
- Specialized implant/bone/supply audit tables have actor/office/action/state/time fields but no immutable historical actor-role field. Common `audit_logs` candidate context records actor role. Current-profile role lookup must not be presented as historical proof.

Continue with the approved API design while B–E approval is pending: fresh per-group backup/data guards → bounded production apply → live workflow/permission/audit verification → main fast-forward only after PASS. Frozen accounting remains outside this phase.


## Approved API release

The first bounded API release protects eight existing payroll read routes with current Supabase identity, active/approved profile, page permissions and office scope, plus separate scoped read-only identities for the two existing validators. Calculation/data-reader syntax trees are unchanged. Other API route groups remain explicitly unclosed; see API-ACCESS.md. The reviewed API modules and two validator request helpers are deployed through the two existing API services. No schedule, provider configuration or financial record changed.

Deployed API main SHA256 5270a49bb0623b96c5eb372dab409026adc257f0efcc5dacf3b10f33cb5c31f8, source commit 30521585ecb3f7e5f1d3651a817e0acc68000a3f, applied 2026-09-17 22:55 UTC. Nineteen-file materialization PASS; 13 materializer tests PASS; 52 local tests and 58 native runtime/framework tests PASS with guard active and no blocked network/data attempts. All 17 retained backend suites PASS; five isolated test harnesses were adapted without removing assertions or changing original test files. QA identity resolution PASS for three existing active fixtures plus invalid-token rejection.

Server deployment and post-release checks PASS: both API services active; missing application key, missing human identity and invalid human identity return 401; the two separate validators pass only their allowed empty-result reads; unrelated reads are denied. Zero write requests and zero scheduled job execution. Frontend/API HTTP 200 in production and QA; QA retains `product_api_ready=false`; production environment bytes unchanged. Existing frontend asset hash remains the baseline above.

Recovery: annotated tag `backup/api-before-phase6-payroll-20260917` preserves prior main. Private rollback source/config directory `api-payroll-backup-20260917T225503Z` is retained on the server and copied locally. Job credentials expire 2026-12-16 22:55 UTC; renew privately with the same restricted scopes before expiry. No credential is stored in Git.

Live signed-in production representative checks PASS: Dentrix selected Sep 4 run / Aug 17–30 period, nine doctors/five hygienists unchanged; Gusto Overview loads; Payroll Runs 20 records; Employees 164 with pagination; Contractors 2026 empty state and All-years 89 payments with preserved missing-identity warning. Read-only source count independently confirms contractor counts (89 overall, zero in 2026). No console errors captured on the checked screens. The comparison page loads its date-required guard, but its dated result was NOT VERIFIED: automated date filling did not update the guard, and invoking the native date picker crashed the embedded browser tab. A fresh tab recovered the signed-in Payroll page with no captured console errors. This is a recorded browser-validation limit, not proof of an application or authorization defect. No frontend change or rollback was made.

The deployment receipt records the server checks; the separate `production-api-payroll-browser-verification.json` records representative UI results and the comparison limitation. No claim is made that every API route or business workflow is closed. Group A's atomic office-assignment client is prepared in the broader frontend candidate, which also depends on Group D; that frontend has not been promoted. Groups B–E, their dependent frontend release and final main integration remain pending.
