# NuDental Dashboard — full release report

Documentation updated: 2026-09-18T00:10:40.210286+00:00. This update consolidates saved receipts; it does not rerun tests, deploy software or modify production/QA.

**September 17 application promotion: COMPLETE. Phase 6 production hardening: IN PROGRESS.** Group A and the first payroll API identity release are deployed. Groups B–E and the dependent frontend release are not deployed. The historical release results below remain valid for their stated scope; they are not a claim that Phase 6 is complete.

## Current source and deployment state

| Item | Recorded state |
|---|---|
| Production | https://nudashboard.com |
| Production frontend deployment | `277f68be-3819-410c-8ca6-6aa5ffa2a95e` — unchanged by Phase 6 |
| Production frontend source | `bac8407c55ed684ffb2ec5dc3dd639cc0a736b4b` |
| Canonical main | `820970ede7727830d95d8d03d518d02119da1acd` — has not absorbed Phase 6 |
| Phase 6 branch | `phase6/nudashboard-production-hardening-20260917` |
| Last verification checkpoint commit | `b748555f9dbb15e7548e30f204f0c10f563ee4b8`; this report update is documentation only |
| Deployed Phase 6 API source | `30521585ecb3f7e5f1d3651a817e0acc68000a3f` — bounded API files, not the entire branch |
| API main hash | `5270a49bb0623b96c5eb372dab409026adc257f0efcc5dacf3b10f33cb5c31f8` |
| QA frontend | `c3c958d8-fede-4be7-85e6-c7a61b635af9`, source `545068b96113d532dfa2b66c86b856fb7b5d8451` |
| Preserved Phase 5 QA branch | `feature/nudental-dashboard-qa-phase5` at `2859ae6416e59918af4487e781e343f790ab770a` |
| Latest recorded health / browser checks | 2026-09-17T23:15:36.133856+00:00 / 2026-09-17T23:28:00.2734097Z |

## Release inventory summary

| Change / group | Release class | Current disposition |
|---|---|---|
| Group A — profiles, user-office RPC, tasks, notifications | C — deliberate database/security adaptation | DEPLOYED and verified. Seven functions, two policies, five triggers; 4,425 rows unchanged. Office-assignment client activation remains pending. |
| Payroll identity and two validator identities | A — application/security repair | DEPLOYED. Eight GET routes require verified identity/permissions; two distinct expiring read-only job scopes. Existing calculations, schedules and provider settings unchanged. |
| Group B — Huddle/EOD | C | QA PASS; approval pending; NOT DEPLOYED. |
| Group C — implant/bone history and access | C | QA PASS; approval pending; NOT DEPLOYED. Preserve deletion history during any rollback. |
| Group D — supplies, Front Desk, urgent requests | C | QA PASS; approval pending; NOT DEPLOYED. RM/Admin/Super Admin only for review; no self-approval. |
| Group E — insurance and service-goal access | C | QA PASS; approval pending; NOT DEPLOYED. |
| Phase 6 client changes | A | Deployed to QA only. Production activation depends on A and D. No new production frontend deployment. |
| QA environment, synthetic offices/actors, simulations and QA storage/security | D | Excluded from production. QA remains isolated. |
| Frozen accounting corrections and metadata proposals | E | Excluded and unchanged. No reconciliation searches, corrections, imports or reclassification authorized here. |

The original 487-path inventory, including 79 promoted frontend paths and 42 original QA database entries, remains preserved. Phase 6 status is an additional review layer, not 487 newly released changes or 42 applied migrations. See [release inventory](INVENTORY.md), its machine-readable [JSON](release-inventory.json), and [migration classification](../phase6-hardening/MIGRATIONS.md).

## Role, access and audit verification

Eight actual role enum values were reviewed; five currently have accounts, with 13 active approved accounts in the captured production matrix. The [role matrix](../phase6-hardening/README.md) preserves existing grants and office scope. Rollback-only comparisons across 24 operational tables showed no increased visibility and unchanged Super Admin visibility.

Group A applied at 2026-09-17T21:51:04.267124+00:00. Its transaction guard preserved all 4,425 affected rows, existing owners and grants. Tasks/Profile read-only UI checks and the 13-actor Tasks/Notifications permission comparison passed. Write/denial/audit cases ran in isolated QA transactions, not against business records. The existing common audit writer records actor-role context; specialized clinical/supply history tables do not have immutable historical actor-role fields. Current profile roles must not be presented as historical proof.

The payroll API release applied at 2026-09-17T22:55:13.383363+00:00. Missing application key, missing user session and invalid session are rejected. Two existing validators have separate credentials restricted to their exact GET routes; unrelated reads are denied. No validator job, provider sync or financial write was executed. Credentials expire at 2026-12-16T22:55:05.380984+00:00; renew privately under the same scopes before expiry. No secret is included in these documents or Git. Coverage is limited to the eight reviewed payroll routes; remaining API route groups still require review.

## Tests and live verification

| Evidence set | Result / scope |
|---|---|
| Original production promotion | 1,630 frontend tests, 6 compiled checks per artifact, 17 backend suites, 13 materializer checks, 49 offline database suites, 14 migration checks: PASS |
| Phase 6 frontend candidate | 1,648 tests, zero skips/failures; production and QA builds; 6 compiled isolation checks: PASS. Candidate production frontend is NOT deployed. |
| Phase 6 database contracts | A 12, B 11, C 10, D 15, E 10 = 58 hosted QA checks: PASS in rolled-back transactions |
| Migration safety | All five idempotence/catalog/owner/grant/rollback preflights PASS; five extra history-safe rollback checks PASS. B–E preflight does not mean production apply. |
| Payroll API | 52 local tests and 58 native Python/FastAPI cases PASS; 17 retained backend suites and 13 materializer checks PASS. Five isolated harnesses adapted with prior assertions retained. |
| Production live UI | Tasks/Profile, Dentrix payroll, Gusto Overview, Payroll Runs, Employees and Contractors: PASS for the representative read-only checks |
| Dated Payroll Comparison | NOT VERIFIED. Date-required guard stayed visible after automated input; native picker interaction crashed the embedded tab. A fresh Payroll tab recovered. No confirmed application regression is inferred from this alone. |
| Production / QA health | Both frontend and API endpoints HTTP 200 in the latest saved check; both production API services active |

The two sets of 58 checks above are different suites. Counts are not added into a claim of unique end-to-end test cases. This documentation update does not claim fresh testing.

Live payroll readbacks: nine doctors/five hygienists for the selected Sep 4 run (Aug 17–30 period), 20 payroll runs, 164 employees with pagination, and 89 contractor payments across all years versus zero in 2026. A read-only source count confirmed the contractor counts. The existing missing-contractor-identity warning remains visible. These are regression observations, not accounting certifications. No captured console errors on the verified screens; the browser crash is retained as a validation limit.

## Data, isolation and performance

The historical application promotion preserved 44,868 original rows across 13 tables and the frozen evidence hashes. The later Group A apply separately preserved 4,425 affected rows; these overlapping scopes must not be summed. API calculation/data-reader syntax trees are unchanged, runtime environment bytes are unchanged, and no financial source records, classifications, archives, provider connections or business corrections were modified. Earlier statements that all policies/backend bytes were unchanged apply to the historical promotion only; Phase 6 deliberately changed Group A definitions and the bounded API source.

Production remains on the 8,836,680-byte entry `index-BBYhCGiP.js` (SHA256 `8283c272644d33cf02bd1bf669e38194a638d87268a1f680bead816572e719e5`), versus 21,742,079 bytes before the earlier promotion. The previous one-mount improvement remains the baseline. No new percentage speedup, native timing or complete duplicate-request profile is claimed. QA's current entry is 8,832,072 bytes. QA retains its isolated project and `product_api_ready=false`; no QA credentials, records, execution adapters, banners or storage configuration were promoted.

## Recovery, remaining gates and safe resume

- Preserve earlier release/QA branches and tags, including `backup/main-before-production-update-20260917`, `backup/production-before-operations-20260917`, `backup/production-before-phase6-group-a-20260917`, `backup/qa-before-phase6-20260917` and `backup/api-before-phase6-payroll-20260917`.
- Group A exact rollback and row/catalog evidence: `production-a-20260917T215054Z`. API previous source/config: `api-payroll-backup-20260917T225503Z`. Both are retained locally and under `/home/openclaw/.cache/nudashboard-phase6-20260917`; private contents are not committed.
- Automatic approval review rejected the attempted Group B production action because the latest explicit approval named Group A. The combined B–E approval request remains pending. This documentation request does not authorize those deployments.
- After approval, take a fresh per-group snapshot, apply and verify one group at a time. Preserve post-delete audit history in Group C rollback; never delete history to restore its old foreign key. Activate the client candidate only after A and D are live and verified. Complete the remaining API and comparison validation limits, then normally integrate only the verified intended production source into main.
- No additional accounting work or financial corrections are authorized. No new phase is started.

**Production remains usable for the existing supported workflows with these explicit limits. Phase 6 is not complete, and main does not yet represent every deployed Phase 6 component.** The [saved checkpoint](../phase6-hardening/CHECKPOINT.md) is the resume entry point.

---

## Preserved historical application-release report (before Phase 6)

The following is the original completed application-promotion report. Its unchanged-QA/backend/policy statements describe that release's verification time, before the later Phase 6 changes above.

### Verified production release — September 17, 2026

Production application update is deployed and live regression passes. Residual accounting work is unchanged and is not part of this release.

| Item | Result |
|---|---|
| Previous production | `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601` |
| Core batch | `6965614a-f8e2-43d8-b8b7-206617796646`, source `23204be68b098980726cc17ba8a01f741be8c921` |
| Final operational batch | `277f68be-3819-410c-8ca6-6aa5ffa2a95e`, application source `bac8407c55ed684ffb2ec5dc3dd639cc0a736b4b` |
| Previous main | `61c224b1bf9ec53d91ab69a8eb00e563204bf76d` |
| Release branch | `release/nudashboard-production-20260917` |
| QA preserved | Branch `feature/nudental-dashboard-qa-phase5` at `2859ae6416e59918af4487e781e343f790ab770a`; deployment `7e91a103-ef44-4f3a-a667-447e112e6997` |
| Main update | Normal fast-forward after live verification; closure documentation changes no application bytes |

#### Verification

- 1,630 frontend tests PASS, zero failures/skips. Includes 128 retained Phase 4 suites and 90 Phase 5 suites; historical artifact supplied for preservation checks.
- Core and final production builds PASS. Six compiled request-isolation checks PASS for each artifact.
- 17 retained backend suites PASS; 13 materializer checks PASS.
- 49 offline database/permission suites PASS; 14 production-specific migration checks PASS, including idempotence, oversell rejection/transaction rollback and historical-field preservation.
- Financial/clinical production writes, approvals, provider sync, imports, emails and destructive actions intentionally excluded from live regression. Production authorization policies were not changed; live UI checks used the existing administrator session.

#### Live production regression — PASS

Executive Overview, office filters, Production, Collections, A/R, RCM, Insurance, Reports, Huddle, EOD, Tasks, implant inventory, inventory hub, Front Desk, Clinical Supply/fulfillment history, Users, Providers, Offices, Profile, Payroll, imported Gusto overview and Expense rendering were checked in the actual production browser.

Observed readbacks include four Production/A/R office rows, A/R filtered to Eatontown then restored, 50 RCM rows, two insurance requests, 480 fulfillment-history rows, 25 users on the current page, 214 provider rows, four offices, 14 payroll rows and 32 report rows. These are UI regression observations, not accounting certifications. No browser error messages were observed during the section checks.

The August 2026 / All Locations overview matches the baseline: gross production 595641, net production 280649, adjustments -314992, collections 264130, collection rate 94.1%, operating-expense display 277589, payroll display 92658, and office net-production figures ET 94198 / SI 9521 / Brick 72424 / Barnegat 104505. Values are unchanged application displays; residual accounting limitations remain in force.

#### Data, configuration and performance

44,868 original rows across 13 financial/operational tables retain identical fingerprints, with zero missing, changed or added rows in the post-release comparison. For the additive receipt migration, original columns are compared; the two new historical fields remain null. Backend source hashes are unchanged. All 11 frozen residual-accounting evidence files retain their original SHA-256 values.

Production/API and QA HTTP health PASS. Production serves `index-BBYhCGiP.js` with production Supabase/API inputs, no QA banner. QA retains its own database project, synthetic QA actor/banner, connected QA database, `product_api_ready=false`, disabled external execution, blocked Internet sockets, and hidden production/root homes. No QA environment was copied into production.

Entry asset: 21,742,079 bytes before; 8,836,680 bytes after. The Executive Overview now has one DOM page mount instead of two. Navigation and data rendering completed across the tested sections without errors. No percentage speedup or native browser timing claim is made. Full network-request profiling was not available through the browser inspection interface; duplicate page mounting was directly checked and its retained regression test passed.

#### Recovery and deferrals

- Annotated tags `backup/main-before-production-update-20260917` and `backup/production-before-operations-20260917` preserve the old main and the verified core release.
- Server evidence: `/home/openclaw/.cache/nudashboard-production-release-20260917` contains both previous artifacts, source/schema backups, original-row fingerprints, manifests, individual migration receipts and bounded publishing/rollback scripts. The original stock-trigger definition is separately recoverable. Retain additive receipt columns when rolling back the frontend to preserve any future data.
- Only production migrations 001/002 in this directory were applied. The other QA migrations and storage/security work are individually deferred/excluded as documented in `INVENTORY.md` and `README.md`. This release does not claim the deferred QA-only atomic RPCs, Front Desk review restriction or broader RLS findings have been promoted.
- Frozen accounting items, financial metadata approvals, benefit/reimbursement/duplicate proposals, tax support and bank/AmEx export limitations remain follow-up only. No financial correction is authorized or performed.

Production is ready for daily use within its existing supported workflows and the documented deferred limitations. Phase 4/5 branches and earlier tags remain recoverable; no force push is used.
