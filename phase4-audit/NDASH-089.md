# NDASH-089 — Valid zero denominator mislabeled as unavailable data

Section: RCM Dashboard / Collection %. Status: source fixed; compiled validation and deployment pending.

Repeated settled Q4/Staten test on087 and088: MTD Net Production0 and Collection%N/A accompanied by unavailable-data text and a source-not-wired warning. Existing read-only API for2026-12-31/Staten confirms net_production0.0 and total_collections0.0. N/A is mathematically appropriate; claiming a missing source is not.

Two display expressions in RcmDashboardTab.jsx now describe zero net production when the numerator is also available and omit the missing-source warning for that case. Real missing values keep their warning. Valid positive percentages, null/negative calculation rules, value/color, API calls and all business data remain unchanged.

Six behavior cases, three failed before; all379 frontend tests PASS after. No typecheck script exists. Production build, Rocket, compiled artifact and live checks pending. Current live088 remains healthy; its scope key must be retained.

Build29.88s/Rocket814/actualcompiledzero-ratio messages and retained missing/positive/negative states PASS. Ratio calculation unchanged; fullentry reverses to088.088scopekey/087receiptstatus/064dateguard/allpriorrepairs and7dependencyrelinks PASS. No payroll change. Controlled release ready.

