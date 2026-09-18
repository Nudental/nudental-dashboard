# Expense ratio selected-office read dependency

Candidate tested; deployment is not yet claimed.

The existing Expense Overview reads production and collections solely as ratio
denominators. Its helper sent a global request for multiple selected offices,
duplicate selections or an unknown office. Four of six synthetic tests reproduced
those failures before editing; the single-office and explicit all-office cases
already passed.

The targeted client change deduplicates and validates the office selection, then
reads each selected office separately. It sums only complete numeric denominators.
If any selected office is unavailable, that denominator stays unavailable rather
than showing a partial total. Existing single-office/all-office parsing and ratio
calculations remain unchanged. No expense source record, classification, provider
connection, accounting correction or expense total is modified.

All 1,660 frontend tests pass with zero skips. Production and QA builds pass;
environment keys/connect policies remain separate. The actual compiled helper
passes six cases in each environment. Six compiled Expense request-isolation checks
and three preserved RCM status cases per environment also pass.

Production candidate: `assets/index-CmE5HSJ_.js`, 8,833,924 bytes,
SHA256 `c05fd851703e35599daaafaf7c3d16ed229e9e29ebcc35bdc8d9979ff71a8545`.
QA candidate: `assets/index-D04awMLd.js`, 8,832,755 bytes,
SHA256 `3a93f9fc0461cb757da1a10610718845332629462bea9684b2a43940c40a046a`.

This client dependency must be verified before activating the core-read API gate.
The API candidate separately preserves the existing Expense parent plus Overview
permission for production/collection summary reads, scoped to the actor's offices.
It does not grant raw records, adjustments or cross-office reads from that permission.

## Expense denominator office-scope repair — deployed

Frontend source `7f9502208cd261684f064bc76e16ecb79b1d561c` is live in production `9509cba3-dd00-4084-9c14-e64ffd7ff390` and QA `559189b1-5a28-4cea-90ba-c0e00bbe2a5e`. Selected offices are validated and deduplicated before denominator reads. Multiple selected offices receive separate scoped requests; their results are combined only when all required numeric values are present. Unknown offices fail before fetching. Existing single-office/all-office parsing and calculations are preserved. Four new tests failed on the old implementation before the small repair.

All 1,660 frontend tests (zero skips), both builds and production/QA configuration-isolation checks PASS. Compiled checks: six retained Expense request-isolation cases, six new office-scope cases per environment, and three preserved RCM cases per environment PASS. Production entry `index-CmE5HSJ_.js` is 8,833,924 bytes; QA entry `index-D04awMLd.js` is 8,832,755 bytes. This is a 623-byte increase from the prior scope release; no speedup claim is made.

Live production Expense Report / Last Month / Eatontown completes and renders denominator ratios without captured console errors or alerts. Production has no QA banner; QA visibly retains its banner and intentionally disabled product API. Multiple-office request behavior is covered in compiled tests; the live administrator filter offers one office at a time. All six August 1–31 production/collections comparisons (all offices, Eatontown and Brick) are unchanged, all 17,363 guarded original rows are preserved, and backend source is unchanged. Business writes: zero. Existing accounting caveats and the frozen residual register are unchanged; displayed diagnostic totals are not claimed as reconciled accounting totals.

Recovery: prior production `08f84700-056f-4af4-8f13-526a66ad8187`, tag `backup/production-before-phase6-expense-scope-20260918`, snapshot `expense-client-frontend-backup-20260918T105236Z`. This completes the frontend prerequisite. The separately tested core-read API gate is not yet claimed live by this entry; remaining API review and canonical main integration are pending.
