# PH5-IMPLANT-007 — CSV report selection

The live low-stock report displayed the imported QA inventory row (quantity 2). The exact deployed CSV handler instead exported the separate QA usage row, including a Patient column: `exportCSV` always mapped `filteredUsage` regardless of the selected report. Running the hash-verified deployed handler against the same persisted fixtures reproduced the mismatch before publication.

The handler now flattens the displayed `reportData` groups and selects usage or inventory columns by report type. CSV quoting escapes embedded quotes and retains numeric zero. No query, permission, clinical record, or stock behavior changed.

- Focused tests: before 1 PASS / 6 FAIL; after 7 PASS.
- Retained tests: 1,318 PASS, zero skips. Build, all 510 source-file comparisons, and QA environment guards PASS.
- Source `b0723ff2a237b7a747c285f030b16ed89527db0e`, pushed.
- QA deployment `df98cec2-c05f-4723-957a-fe34df727ac8`; previous `ca0a75da-7000-466f-b933-fb8390ed0bd7` retained.
- Entry `index-CmVBhiiL.js`, 8,829,488 bytes, SHA-256 `179a3e7f5e277da361f434d2ea62163d5c48fed9e4ce46f5a0ffb59ce7f89a28`.
- Hosted checks: 17 PASS, establishing that the handler artifact tested is the one live and production remains unchanged.
- Live refreshed low-stock report still showed the correct row. The exact repaired artifact's CSV is 191 bytes with one inventory row and no unrelated usage/patient column: PASS (`verify_implant_csv_artifact.cjs`). Original artifact output was 268 bytes and mismatched the visible report.

Native browser Save As is not verified: no download event or saved Downloads file was visible through the available browser tools. This limitation is separate from the verified report-content repair and is not reported as a successful browser save.
