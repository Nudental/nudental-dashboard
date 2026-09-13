# NDASH-042 release review

Scope: Finance / Production & Adjustments and Collections only.

- Before: a January–June selection is called Month-to-Date; totals/charts are labeled Monthly/MTD.
- After: Selected Range labels and the actual applied start/end dates. The existing daily view is explicitly Today(UTC).
- Changes:35 labels and2 date captions. No calculations, data queries, credentials or business records change.
- Current baseline:128, deployment49a929fd-f926-4b17-b9a1-e6cde0e8ea86.
- Candidate: index-f88dae71cc0e.js; SHA256f88dae71cc0eb5595fe79d660548622218a7465159ec79e53cf9f1f2aec8d396.
- Verification:586 frontend tests; build34.53s; selected-range/current-day caption tests; full reversal to128; all previous dependent modules preserved.
- Deployment path: existing yadon-abem-01 server to the existing nudashboard.com Pages project. All prior releases stay recoverable.
- Status: ready locally; no upload/deployment performed. Specific approval is required because the earlier automatic review rejected042 when the recorded approval named041.
