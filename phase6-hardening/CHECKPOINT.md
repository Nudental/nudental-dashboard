# NuDental Dashboard - active Phase 6 checkpoint

Updated 2026-09-18T14:57:45.285536+00:00. **Phase 6 remains in progress. Do not begin another phase.**

## Current release

- Phase 6 branch: `phase6/nudashboard-production-hardening-20260917`.
- Canonical branch: `main`, normal fast-forward to the verified Phase 6 closure containing this checkpoint. Previous main: `820970ede7727830d95d8d03d518d02119da1acd`. Exact new main SHA is in the external saved release pointer/closure receipt after push; application source remains `78cc78da4affc54f4308a4731551a46f30854e17`.
- Live API source: `78cc78da4affc54f4308a4731551a46f30854e17`; main SHA256 `7b85a17d6a9bac738bb4239b83326199c99957b499d14335e7d6934a95607917`. All 36 materialized files match production.
- Production Pages: `dcf8bc42-1a06-45f6-8010-80c1db7595be`; `/assets/index-DRITFcr0.js`, 8,835,047 bytes.
- QA Pages: `ae279546-abd2-4720-a052-a9a34aa2d60b`; `/assets/index-BXvFvJGj.js`, 8,833,878 bytes; `product_api_ready=false` is intentionally QA-only.
- Frontend source: `009005b03767dc3dc9facdbfc5f9fa81fa001d49`; retained full 1,678 frontend checks and both builds PASS, with 21 compiled checks in each environment. No frontend change in the provider release.

## Completed - do not repeat deployment

Adapted Groups A-E, atomic office assignment/review client, dated August 2-15 Payroll Comparison, and independent API boundaries are deployed and verified. Provider access/OAuth is the latest release: 324 native tests, 17 retained suites, 13 materializer tests and two exact external-caller checks PASS. 79,171 original Supabase rows and 83,991 original SQLite rows preserved. Same-period metrics, provider configuration, schedules and schema unchanged. Final source/asset/health parity PASS at 2026-09-18T14:52:28.766982+00:00.

Seven separate exact-GET job identities exist: the three validators, cache-prewarmer, plaid-sync, morning-brief, payroll-balance-watch. Existing expiry is `2026-12-16T22:55:05.380984+00:00`. Do not display credentials. The previously exposed reconciliation token is revoked; never restore it from an older backup.

## Pending decision and remaining work

1. `/v2/rcm/ar-aging-official` and `/v2/rcm/ar-location-health` human gates remain deliberately inactive. Collaboration caches its daily-report caller; restarting its API immediately runs the scheduler and may dispatch due work. A pending user question asks whether to defer to a planned restart or allow restart and normal scheduled work. **No answer is recorded. Do not treat elapsed time as approval.** No Collaboration source/config/credential/service was changed. Its pure adapter is prepared only in `patch-daily-report-read-identity.py`.
2. Independent read-only regression and canonical source closure are complete. Before resuming, read the saved Git verification receipt to confirm main/branch equality. All earlier branches/tags remain; no force push. No independent Dashboard implementation remains queued.
3. If the decision remains unavailable, keep Phase 6 explicitly incomplete with this exact external activation dependency; do not repeat completed investigations or provider/login/sync work.

Final UI PASS: Executive Overview, Financial Analytics, Reports, Inventory, Huddle History and Insurance. Prior RCM/Expense/dated Payroll evidence remains. QA label and API isolation flag preserved. No real provider or workflow execution.

## Recovery and safety

Latest backup `/home/openclaw/.cache/nudashboard-phase6-20260917/api-provider-read-backup-20260918T143542Z`; Git tag `backup/api-before-phase6-provider-reads-20260918`. Existing frontend rollback and earlier API/schema backups remain. Production and QA remain healthy. Private snapshots stay on the server.

One earlier daily-Huddle visit initialized a September 18 draft with 19 blank checklist and four blank provider children; preserve it. Avoid daily-Huddle auto-initialization. Huddle History mount was source-reviewed: it selects offices/history and subscribes to changes; no write occurs without a separate user action. Automatic review initially blocked its navigation, then allowed the source-confirmed read-only history view. No approval, unlock or review action was performed.

Financial residuals remain frozen: no reconciliation searches, bank logins, provider syncs, source/classification/archive/card metadata edits, real purchases, emails, approvals or clinical writes. No QA records/configuration promoted. No watchdog or new phase.

See `production-release/CLOSURE.md`, `production-release/INVENTORY.md`, `phase6-hardening/API-ACCESS.md` and `API-PROVIDERS.md`. Earlier checkpoint versions remain recoverable in Git, including `c0ae90bb23a423f93745ba0ba99b13a66a415d74`.
