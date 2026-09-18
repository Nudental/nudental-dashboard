# RCM read scope client dependency

Deployed and live verified September 18, 2026. See the release result below.

The A/R service previously retrieved a company response before filtering selected offices locally. eAssist status omitted the parent office, and its local report filter could override the parent selection. Fifteen checks failed on those actual functions/callbacks before the repair.

Selected A/R offices now generate distinct, validated office requests. Unknown offices, global responses to scoped requests and incomplete responses fail closed. Existing normalization and financial calculations are preserved. The eAssist status query carries the selected office; report queries and the local selector respect the parent scope. Parent office/date changes remount the report view so previous responses cannot fill the new scope. Unavailable status counts display an em dash rather than an invented zero. This is a client prerequisite; backend eAssist status response restrictions are a separate pending change.

Verification: 1,678 frontend tests PASS, zero failures/skips. Eighteen new scope/UI checks and seven retained A/R office calculation checks PASS. Production and QA builds PASS; their credentials, database references and connection policies remain isolated. Compiled checks PASS in each environment: six A/R scope, six Expense request isolation, six retained Expense denominator scope and three retained RCM daily-summary scope checks. No real network/provider/business writes occur in these tests.

Production candidate entry: `assets/index-DRITFcr0.js`, 8,835,047 bytes, SHA256 `25917d222e808abba8861d054c048cac90f7a6677743e9837d8c9023821a55fc`. QA: `assets/index-BXvFvJGj.js`, 8,833,878 bytes, SHA256 `48716bfc332598a4462e23fa5cb92cf59a934c3f7eff475195ad4890ac05d8c8`. No speedup is claimed. Existing build warnings are retained; no dependency upgrades or unrelated refactoring were made.

The initial aggregate runner lacked its required historical-artifact input and included three database tests without their fixture path. That setup failure is preserved in `rcm-read-client-frontend-tests.log`; the corrected complete run is `rcm-read-client-frontend-tests-complete.log`. No assertions were weakened.

Financial source data, classifications, provider connections and the frozen residual accounting register are unchanged. Backend source and database policies are not part of this client batch.

## RCM A/R and eAssist request scope — deployed

Frontend `009005b03767dc3dc9facdbfc5f9fa81fa001d49` is live in production `dcf8bc42-1a06-45f6-8010-80c1db7595be` and QA `ae279546-abd2-4720-a052-a9a34aa2d60b`. Selected A/R offices generate distinct validated requests; global or incomplete scoped replies fail closed. eAssist status carries the selected office, report filters honor the parent office, and parent scope changes isolate earlier responses. Existing calculations are unchanged. This completes the client dependency; the six-route snapshot/eAssist API candidate is local and NOT deployed.

All 1,678 frontend tests PASS with zero skips, both builds and environment isolation PASS. Each compiled environment passes six A/R scope, six Expense request isolation, six retained Expense denominator and three RCM status checks. Production entry is 8,835,047 bytes; no speedup claim. Live production eAssist Eatontown/Brick selection and settled Brick A/R Aging PASS with no captured errors, alerts or scope warnings. QA layout/banner PASS; its financial API remains intentionally disabled.

Six August 1–31 read-only metric comparisons are unchanged. All 17,363 original guarded rows are preserved; backend source is unchanged and business writes are zero. Recovery: `9509cba3-dd00-4084-9c14-e64ffd7ff390`, tag `backup/production-before-phase6-rcm-read-scope-20260918`, snapshot `rcm-read-client-frontend-backup-20260918T130751Z`. Remaining RCM/financial/provider API review, final regression and normal main integration remain open.
