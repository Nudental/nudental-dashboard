# Payroll continuity release — September 20, 2026

Status: COMPLETE. Production application commit `9581d5f384f4ef320e9eaee4fad7b89089922abd`; Cloudflare Pages deployment `b0f773f4-276b-4a6d-9888-e00b4d7971e9`. Canonical main was fast-forwarded normally. This closure adds documentation only; it requires no further deployment.

The nine approved doctor-office rules retain their historical August–September dates and continue from October 1 without expiry. Protected policy version `6762ff5cc340ea0722637440e83fde1c35ab4d16514b365bef23344994ef83f7` records the owner approval and administrator provenance. Source financial records, paid payroll, credentials, permissions, schedulers and accounting proposals were not changed.

## Verification

- 1,742 retained frontend tests PASS.
- 337 backend/permission tests PASS: 334 retained plus 3 new.
- 112 focused payroll tests PASS: 90 retained plus 22 new.
- 13 materializer tests PASS; production build/configuration isolation PASS.
- All 275 independent HR daily controls, 18 monthly collection bases and 27 tier/calculation checks remain unchanged.
- Live September 4: 9 monthly rows and 95 doctor/office/Applied Date detail rows exactly match the independent baseline.
- Live September 18: 18 monthly rows and 64 detail rows exactly match the independent baseline. Its September 12 cutoff remains fixed. Switching to September 4 and back clears old rows and returns the correct independent result.
- Actual synthetic application path: October 2, 16 and 30 pass with one build and policy. Complete Gusto/source pagination, signed offsets, late revision, unknown provider, source failure, true zero, unknown category, access denial, explicit-period refresh and saved-result behavior are covered. Calendar/year/leap boundaries, effective-date changes and cent thresholds also pass focused regression.
- Native synthetic CSV and PDF downloads arrived in the local Downloads folder. Contents match the calculation, policy, cutoff, rate and amount. PDF layout was visually checked.
- Three live derived snapshots persist privately with valid integrity hashes. Two September 18 reads have distinct calculation IDs without changing the earlier result. Live saved-history readback PASS.
- Both Dashboard APIs, production frontend, existing QA frontend/API and Collaboration health PASS. QA remains isolated; Collaboration was not restarted. Source schema, financial fingerprints, environment, job definitions and service configuration remain unchanged.

Production correctly reports genuine identity and office/negative-amount exceptions as **Needs review** and labels incomplete scope as a subtotal. This is not a declaration that all payroll is approved. No guessed assignment, source correction or payment was performed. The nine approved doctors' independently reconciled amounts are preserved.

## Recovery

Previous main: `6c78afc079249fe6433ae92339d5da30718d3a59`.
Previous Pages: `bc7aa5ae-99a5-439a-a726-aefa3f9fdb50`.
Annotated remote tags: `backup/main-before-payroll-continuity-20260920T154528Z` and `backup/production-before-payroll-continuity-20260920T154528Z`.
Private source/configuration rollback: payroll-continuity server cache `release-backup-20260920T154536Z`. Earlier branches, tags, source evidence and the release branch remain preserved. Derived snapshots and policy versions are separate from the source financial database.

## Next ordinary cycle

No new HR PDF/CSV, confirmation of unchanged office assignments, code edit or deployment is required for an ordinary newly imported eligible regular Gusto run. Opening/refreshing Provider Compensation uses the approved configuration and validated read-only Ascend source path.

HR must still approve payroll and review genuine source/identity/office exceptions. A new provider, actual policy change, unavailable/incomplete source, or previously unevidenced historical assignment needs its specific evidence or approval. Month-end adjustments require verified already-paid compensation and separate HR approval; no additional pay is automatic. Routine source retrieval still takes several minutes because complete historical revision coverage is retained.

See `PAYROLL-CONTINUITY.md` for the protected configuration procedure and retained synthetic harness. Private underlying evidence remains outside Git.
