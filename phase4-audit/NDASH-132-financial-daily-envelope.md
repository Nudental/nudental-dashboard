# NDASH-132 — Daily financial summary envelope read as zero

Severity: High. Status: reproduced; targeted source fix under verification.

Reproduction: the exact metric-reader declarations in current live131 browser asset were extracted and confirmed byte-for-byte. Read-only live daily-summary responses for 2026-08-14, All Offices and Barnegat, supplied nonzero nested gross/adjustments/net and insurance/patient/total collections. All twelve current compiled outputs were zero and mismatched the source. No business amounts or credentials were printed or saved. Today's 2026-09-13 live source and browser are zero; a positive current-day browser mismatch is not claimed.

Root cause: `fetchProductionMetrics` and `fetchCollectionMetrics` expect flat daily fields; the live endpoint nests them under `production` and `collections`. The signed multi-office reader inherited the same flattened-field expectation.

Changed component: `recovered-frontend/src/services/dentrixNormalizedService.js`.

Exact fix: normalize the two daily envelopes at read time by retaining top-level metadata and overlaying the corresponding nested section. Legacy flat payloads, numeric production shorthand, signed values, existing range/date/office requests and missing-response behavior remain unchanged. Input responses are not mutated. No API, accounting, authentication, provider or deployment-configuration change.

Verification/release: pending. Deploy only a scoped patch on current131 and retain all earlier assets, including the unreleased042/066 boundary.

Pre-release verification: 621 frontend tests PASS (8 new daily-envelope tests); production build PASS in 33.11s. Rocket version860 reports the same two-line source change. Scoped compiled artifact changes two daily expressions and relinks seven retained modules; complete reversal equals live131. Repeating both historical live-response reproductions with the exact candidate readers now matches all twelve nonzero fields. No backend changes.

Status: CLOSED — PASS. Source commit df74b8f. Deployment d3f41d67-6543-430c-8830-b57e04306856; asset index-964efe6fddbc.js; SHA256 964efe6fddbc5175110be2b7472766576684e24e3011a2ea711d5fcbef2682b5. Prior131 retained.

Live verification: exact published asset hash and browser-loaded asset PASS. All twelve historical nonzero daily fields now match live API readback through the exact released metric readers. Current-day Daily views for All Offices and Barnegat+Brick correctly show source zeros. Positive current-day browser values were intentionally not fabricated. After refresh, selected-range collections/headlines and all13payment rows for All, Barnegat, and Barnegat+Brick match the retained129/131 fingerprints. Combined selector and production range headlines remain correct. Fresh browser errors0. Frontend/API200, all three services active; backend131 hash unchanged. No business-data writes, configuration changes, or test records.
