# NDASH-017 — Provider-type headline totals ignored the selected types

- Reproduced twice live: Hygienists narrows provider rows/count while Net Production and Total Collections remain all-provider API totals.
- Root cause: the page filtered rows but the headline expressions always preferred the unfiltered office summary.
- Changed only Provider Performance: selected types sum their normalized rows; All retains authoritative office totals. Negative/zero values are preserved, missing/nonfinite amounts remain unavailable, and loading/error totals are unavailable. Missing row collections no longer become zero. The reconciliation panel explicitly labels its all-provider scope for a type selection.
- Verification: 58 frontend tests PASS; source production build PASS (30.94s); six actual artifact scenarios, syntax, and exact reversal PASS. Rocket Version 749 contains the corresponding repair.
- Candidate asset: `index-98f1e745901f.js`, SHA256 `98f1e745901fd1c16f5e52248beabc4e2af584f350ccb820c125b6161182669d`.
- Deployment/live verification pending. Previous `ndash016-dist` preserved; no backend, configuration, credentials, or business-data changes.
