# Provider Compensation imported periods — production release

Status: DEPLOYED, LIVE VERIFIED — 2026-09-20.

## Root cause and bounded repair

Provider Compensation used a static schedule ending with the September 4 payday and selected index 8 by default. Imported Gusto already contained processed regular run `b7965646-c133-4584-b2b6-dcf9910cf614`, payday September 18, period August 31–September 13. Its blank optional operator/employee metadata is not an eligibility condition.

The new period service reads every page of the existing authenticated `/v2/payroll/runs` endpoint, validates pagination, and selects processed regular non-reversed runs. It preserves dated historical schedule entries absent from imports with an explicit historical label. Imported special, reversed, correction/off-cycle, and unprocessed runs cannot reappear through the historical fallback. Gusto supplies identity/dates/status only; compensation continues to use Ascend collections and the existing provider matching, formulas, rates, and monthly tiers.

The initial selection is the latest eligible processed payday on or before today. Explicit historical selections survive refresh. Refresh reloads both the period list and compensation data. Generation guards and selection keys prevent stale requests and previous-period rows from appearing under a new selection. Strict source completeness checking is opt-in for this view; missing or incomplete Ascend data produces a visible error while the valid Gusto run remains selectable.

## Files

- `recovered-frontend/src/services/providerCompensationPeriods.js` — imported period metadata and complete pagination.
- `recovered-frontend/src/hooks/gusto/useCompensationPeriods.js` — selection, refresh, cancellation, and list error handling.
- `recovered-frontend/src/pages/payroll/components/ProviderCompensationNew.jsx` — dynamic selector, request isolation, distinct date labels, visible source errors.
- `recovered-frontend/src/services/payrollService.js` — opt-in completeness checks and preservation of genuine zero monthly inputs.
- `payroll-repairs/test-provider-compensation-periods.cjs` — 37 focused cases.
- `payroll-repairs/test-compensation-source-completeness.cjs` — 14 focused cases.

## Verification

| Payday (2026) | Displayed Gusto period | Ascend query window | Live result |
|---|---|---|---|
| August 21 | August 3–16 | August 2–15 | PASS |
| September 4 | August 17–30 | August 16–29 | PASS |
| September 18 | August 31–September 13 | August 30–September 12 | PASS |

The existing calendar-date helper applies the one-day shift in the component only. The service and backend forward the resulting dates without a second shift. The production asset is hash-verified against the tested build. Live date labels, returned values, and independent reads of the exact Ascend window agree. A separate browser network trace was not captured; the bounded journal lookup exposed no GET access entries, and no logging configuration was changed.

- Frontend: **1,729 passed**, including **51 new focused checks**, zero skipped. The sole initial environment failure was a missing dependency junction; its file passed all three checks after restoring that junction without source changes.
- Backend: **328 guarded native tests passed**, no blocked side-effect attempts. Existing payroll and office/role permission regressions included.
- Production build: PASS. QA URLs/credentials/configuration excluded.
- Focused cases: new imported run without deployment; calendar/year/month/leap boundaries; pagination; off-cycle/reversed exclusion; missing optional metadata; historical retention; refresh; tab remount; denied access; office query forwarding; unavailable/partial source; old response rejection.
- Live: September 18 default/selection; all three mappings; September 4 explicit selection retained during refresh; older/back navigation; rapid September 4 → August 21 → September 18 switching; Eatontown/all-office filtering; Imported from Gusto tab and compensation remount; no captured browser errors.
- Source comparison: all **15 displayed named provider rows** match the September 18 Ascend source identities, collections, doctor monthly-tier inputs, selected percentages, and displayed estimates. Canonical name/office presentation and placeholder exclusion remain the existing mapping behavior. The raw response has 17 rows: one existing non-provider placeholder remains excluded and unattributed collections remain separately excluded from compensation. No equality to Gusto's entire payroll total is asserted.
- Preservation: all **158 imported payroll row fingerprints**, **72 backend file hashes**, payroll permission rows, all three report responses, and Dashboard/Collaboration process IDs match the pre-release snapshot. No API or Collaboration restart.
- Health: production frontend/API PASS; QA frontend unchanged and isolated API still `product_api_ready=false`; Collaboration frontend/API PASS.

## Deployment and recovery

- Previous canonical main: `26938627bc7b59f6c0ff384fe5d2393456483164`.
- Focused branch: `fix/provider-compensation-imported-periods-20260920`.
- Deployed source: `2eaa9da14ee12398aa3ac67d565ec02a064c85f3`.
- Previous production Pages: `dcf8bc42-1a06-45f6-8010-80c1db7595be`.
- New production Pages: `5dcca0c6-69b7-4125-833d-16cb02be19c1`.
- New entry: `assets/index-CNx-lSna.js`, 8,840,603 bytes, SHA-256 `acbf5c4b4eea466eb567fd95431325d6d7032e3279344346e08e513a8ebfda55`.
- Preserved QA Pages: `ae279546-abd2-4720-a052-a9a34aa2d60b`.
- Annotated backup tag: `backup/production-before-compensation-periods-20260920` → previous main.
- Private rollback snapshot: `/home/openclaw/.cache/nudashboard-payroll-fix-20260920/frontend-backup-20260920T062833Z`, containing previous frontend asset/deployment rollback reference and unchanged API/config/process snapshot.
- Verification receipts: same server directory, plus local task `work/payroll-fix`. No private credentials or raw source business records are committed.

The first publishing attempt stopped before mutation because the pinned deployment tool was absent from the offline cache. Restoring the same pinned Wrangler 4.131.0 from npm allowed the existing release process to complete. No deployment configuration changed.

Canonical main is advanced normally only after these live checks. Financial/accounting records, provider credentials, schedules, and residual accounting proposals remain unchanged. No payroll submission, compensation email, provider sync, or broad audit was performed.
