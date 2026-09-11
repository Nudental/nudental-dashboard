# NDASH-009 — Selected offices ignored by Operations A/R snapshots

Section: Operations / Claims / AR and Payors Section 1. Severity: High.
Reproduced in both live views with Barnegat selected: practice total $541,342.52, insurance $244,872.43 and all four office rows remained. Repeated after the NDASH-008 release. Expected Barnegat-only totals and rollup.

Root cause: fetchARAgingData and PayorsTab discard officeIds when calling fetchAgingReceivablesLive, which has no scoping support; Payors snapshot callback also has no office dependency. The primary endpoint already returns the complete, verified per-office numeric snapshot.

Fix: optional officeIds in the shared fetcher; scope the verified per-office rows before normalization, sum each selected office once, preserve missing fields as null and real zero, and fail closed for unknown/missing/duplicate office rows. All-office callers remain unchanged. Both affected callers pass officeIds; Payors reloads when selection changes. Snapshot remains current/as-of dated, not a historical range calculation. No data, authentication, backend or infrastructure changes.

Independent authorized read-only API verification: Barnegat total A/R $226,930.39, insurance $116,938.02, over 90 $76,628.74; Brick total $109,581.93, insurance $62,505.92, over 90 $30,596.96. No patient-level records returned to the audit output.

Tests: seven new regression cases, six fail against baseline and all pass with fix; all 36 retained frontend tests PASS. Production source build PASS in 34.59 seconds with existing chunk-size warning. Actual artifact fetcher and helper: five synthetic scenarios PASS. Five unique bundle edits; reversing them yields byte-identical prior production code. Other assets unchanged; HTML changes only asset reference.

Rocket Version 743 reports the same three-file scope. Local reviewed source and tested production-artifact patch are the release authority; Rocket's implementation has not been exported for byte comparison at this commit.

Previous asset SHA256 d24473609d7eb85e501107d2c18f0e801e8cee07f05104673ecca74077675fd6.
Candidate SHA256 07313e91ca8a3e688019744a7137789c023f4ac78e8d7644c8a48254d85d86c7.
Deployment: PASS, Cloudflare Pages 0ee8aff8-5ce4-4456-b813-38e5c848f6ff, asset index-07313e91ca8a.js. The initial attempt stopped during pre-deployment path validation; correcting its rollback-directory reference allowed deployment. No production change occurred in the failed validation attempt.

Live verification: PASS. Claims / AR with Barnegat shows $226,930.39 total, $116,938.02 insurance, $76,628.74 over 90 (33.8%) and one office row. Barnegat + Brick shows $336,512.32 total, $179,443.94 insurance and exactly two office rows, matching independent endpoint sums. Payors Section 1 shows the same combined values. Returning to All restores $541,342.52 total, $244,872.43 insurance and four offices. No browser errors. No production business-data changes or temporary records.
