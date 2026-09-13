# NDASH-042 release review

Scope: Finance / Production & Adjustments and Collections only.

- Before: a January–June selection is called Month-to-Date; totals/charts are labeled Monthly/MTD.
- After: Selected Range labels and the actual applied start/end dates. The existing daily view is explicitly Today(UTC).
- Changes:35 labels and2 date captions. No calculations, data queries, credentials or business records change.
- Current baseline:157, deploymentba5c0880-8176-4cec-9ebb-e2d2918e7b25, closure5927024.
- Candidate042-v3: index-c3cb27982b4d.js; SHA256c3cb27982b4d7bef13a7df181841bffd705ae224d83f5748b24e332d4ad70323;21,740,852bytes.
- Verification:833 frontend tests; current source build36.29s; actual compiled selected-range/current-day caption cases PASS; full byte reversal to157 and all seven dependent modules preserved. Only the35labels/two captions differ in the affected components. Existing042/066 source candidates remain separate from live;066 is excluded from this candidate.
- Deployment path: existing yadon-abem-01 server to the existing nudashboard.com Pages project. All prior releases stay recoverable.
- Status: ready locally; no upload/deployment performed. Specific approval is required because the earlier automatic review rejected042 when the recorded approval named041.

Reproduced on current live157: both Production & Adjustments and Collections show01/01/2026–12/31/2026 controls alongside Month-to-Date/Monthly/MTD captions. The repair labels the selected range accurately and retains current-day UTC behavior. No dates, financial values, source queries, configuration or business records are modified. Earlier128 review files remain recoverable; this current candidate supersedes their release applicability.

2026-09-13: user explicitly approved NDASH-042 publication through the existing server/production path. Current candidate upload/preparation authorized; original publication blocker resolved. Live verification remains required before closure.
