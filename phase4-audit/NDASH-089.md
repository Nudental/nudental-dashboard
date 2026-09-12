# NDASH-089 — Valid zero denominator mislabeled as unavailable data

Section: RCM Dashboard / Collection %. Status: repaired, deployed, live verification PASS.

Repeated settled Q4/Staten test on087 and088: MTD Net Production0 and Collection%N/A accompanied by unavailable-data text and a source-not-wired warning. Existing read-only API for2026-12-31/Staten confirms net_production0.0 and total_collections0.0. N/A is mathematically appropriate; claiming a missing source is not.

Two display expressions in RcmDashboardTab.jsx now describe zero net production when the numerator is also available and omit the missing-source warning for that case. Real missing values keep their warning. Valid positive percentages, null/negative calculation rules, value/color, API calls and all business data remain unchanged.

Six behavior cases, three failed before; all379 frontend tests PASS after. No typecheck script exists. Production build, Rocket, compiled artifact and live checks pending. Current live088 remains healthy; its scope key must be retained.

Build29.88s/Rocket814/actualcompiledzero-ratio messages and retained missing/positive/negative states PASS. Ratio calculation unchanged; fullentry reverses to088.088scopekey/087receiptstatus/064dateguard/allpriorrepairs and7dependencyrelinks PASS. No payroll change. Controlled release ready.


Live PASS: deployment0355db65-cfb2-401c-8716-4fa808659ff3; index-0ee92c9d8d65.js; SHA0ee92c9d8d6561bff29bb30a801bb1a693788812fb4870dc3c2b0631bae76fa5. FreshQ4Staten and settledRefresh show net0, ratioN/A, N/A—netproductioniszero, no source warning. August rapidAllStaten remainsclaims11/POS8095/MTD9521/ratio63.9; restoreAll122/POS108440/MTD280649/94.1.087receiptlabel retained; alerts/errors0;frontendAPI200/threeactive/backend085unchanged.088rollbackretained. No businesswrites.

