# NDASH-030 — Contractor source disconnected and displays used misleading substitutes

Status: IMPLEMENTED / tested; deployment and live verification pending.

- Section: Payroll / Imported from Gusto / Contractors and Overview. Severity: High.
- Live reproduction: both2026 and2025 Contractor views say the endpoint is not connected; export disabled. `/v2/payroll/contractors` returns404. Overview silently substitutes zero for that failed query, and its annual Contractor chart actually plots payroll net pay.
- Existing source verified read-only:89 imported payments, one nonempty company ID, no missing amounts.64 funded/noncancelled payments total61,847.92;23 unfunded/noncancelled and2cancelled records must not be called paid spending. Raw payment amounts total468,956.63.2025 has23 payments, all funded/noncancelled, total32,291.68;2026 has none.
- Annual paid totals:2020 2700.00;2021 0;2022 180.00;2023 4082.65;2024 22593.59;2025 32291.68. Definition follows the existing expense source's funded-payment criterion and excludes canceled payments. No imports, financial changes or synchronization performed.
- Other connected issues in this flow: table requests50 rows but renders no pagination; total/unique cards only use the current page; empty results claim disconnected endpoint;404 is swallowed; Overview lacks unavailable-state handling for contractor values.

Implemented repair scope:
- Added a read-only contractors GET in the existing API namespace, with date/name/wage/status filters, deterministic pagination, complete filtered paid totals and annual paid aggregates. Optional strict mode prevents failed/truncated reads from being reported as zero while retaining existing callers' default behavior.
- Reused the existing `otp_auth` Supabase session validator and active-profile check. Existing `role_permissions` govern access: Overview may request summary-only data; detailed payments require the Contractors grant. Super administrators retain their existing override. Existing API-key guard is also retained. No policies, credentials, authentication configuration, or other routes' authorization changed.
- Require an explicit summary-only/data selector for the new client; stale pre-repair clients must receive a refresh instruction rather than raw payment rows that their old code would sum as paid spending.
- Wire Contractor table to complete summary metadata, pagination, accurate page-export/summary labels and clear error/empty behavior. Preserve paid/unpaid/canceled records and distinguish their totals. Reset pagination/guard stale requests as needed.
- Overview should request summary-only totals and annual paid series; replace payroll-derived contractor bars, retain all unrelated Gusto calculations, and show unavailable rather than zero on failure.
- Test with synthetic rows and existing read-only source, build the frontend, preserve both rollback points, deploy frontend first so its unavailable state is safe before the new backend activates, then deploy backend using the existing candidate-first process and live-verify.

Verification before deployment:
- 99 frontend regression tests PASS; Vite production build PASS (31.23 seconds).
- 29 isolated contractor API/session/role cases, 6 complete-source reader cases, retained 16 run + 16 employee cases and 21 expense guard assertions PASS.
- 10 actual-bundle checks PASS, including current-page export, pagination/filter reset, stale request rejection, missing-session denial, unavailable totals and contractor chart data binding. Exact patch reversal restores the previous bundle byte-for-byte.
- Rocket version 761 records the six frontend file changes.
- Frontend candidate SHA256: `5ae3302f87ad2e388657ab03a49da25d5cd69f731dde6d02edb12aa64dfe0fba`; previous NDASH-029 release preserved.
- Backend candidate SHA256: `6454af130067d29f9679a0a6c070a6bf11419934a8322bd8292a94ecfd024be1`; baseline `8c769b4cc140fcf2e35e6969143f23fcd3ae57c5f608fceac41d6901229e04ba` preserved in `ndash030-backend/main_candidate.before.py`.
