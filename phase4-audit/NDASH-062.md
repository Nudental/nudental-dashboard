# NDASH-062 — Aging boundaries disagree with the labeled intervals

Section: RCM / Patient AR Follow-Up and legacy AR Aging API. Severity: High. Status: tested; deployment/live verification pending.

Reproduced on061: five visible rows show30d/b30 while the summary labels are Current0–30 and31–60. API August has10 exactly30-day balances totaling4907.13, all assignedb30. Total balance53862.72; old current15486.10/b3038376.62. Expected inclusive thresholds move only4907.13 into Current, preserving the total and all ledger inputs. No60/90 boundary records occur in this live August dataset.

Root cause: rcm_ar_aging uses<=29/59/89; frontend fallback and Over90 filter use>=30/60/90. Repair: backend inclusive<=30/60/90, frontend fallback>30/60/90, Over90filter>90. Explicit source bucket codes, date basis, patient identities, financial query predicates, amounts, contact operations and configuration preserved. Raw bucket-code presentation is a separate display observation, not changed here.

Recovery: current backendSHA64bb98858a7fa661a535c189f0520b312cbf55800849f0e2ac776b6c0bc3a1a5 snapshot privately on server. CandidateSHA8117c4026155dccb1e08d9db5e0978df2972c5b9f75850d4f1a25881e64b4ed4. Only three numeric thresholds in rcm_ar_aging changed; exact reversal PASS. Frontend candidateindex-3d951b3386b2.js; prior061 graph retained.

Tests: three backend boundary failures reproduced before/six testsPASS after (adjacent days, conservation, date basis). Two frontend failures reproduced before/all284source testsPASS after; build30.71sPASS. Retained10claim-status tests, five backend suites and adjustment reversalsPASS. Actual compiled normalizationFwt and component$wt Over90 predicate testsPASS; all other fields and prior patient-office identity preserved. Full frontend reversal/7relinksPASS. Initial local packaging syntax guard caught a removed parenthesis before any frontend upload; generator corrected and syntax/regression checks rerunPASS. Rocket792complete.

Release plan: existing candidate8002/live8001 backend process, retain source snapshot and verify all non-bucket row fields and production/collections summaries unchanged. Then guarded frontend release from061. No business data writes, exports, sync or configuration changes.
