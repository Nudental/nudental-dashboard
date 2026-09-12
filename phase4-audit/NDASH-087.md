# NDASH-087 — Zero missing-report records incorrectly claims confirmed receipt

Section: RCM Dashboard / Data Source Status. Status: repaired, deployed, live verification PASS.

Reproduced twice on the current086 release: Missing Reports0 is green and says all expected offices reported. Following its eAssist link shows three latest office records explicitly missing. A bounded read-only status check confirms coverage date2026-09-11, missingCount0/missingReports0, and three latest missing placeholders dated2026-09-10. The source route queries missing placeholders for its coverage date; a zero result does not prove completed report receipt. No raw report or job-log contents were exposed.

Smallest fix: two expressions in RcmDashboardTab.jsx. Zero-count text states that no missing reports were recorded, includes coverage.lastBusinessDay when present, and explicitly leaves receipt unconfirmed. The Missing Reports card uses neutral slate for zero/unknown counts, retaining red for a positive count. Count/date derivation, API calls, positive office names, conflicts fallback, ingestion rules and business data are unchanged.

Verification: five behavior cases, three failed before; all367 frontend tests PASS after. Production build30.25s PASS. No typecheck script exists. Compiled patch will be applied only to exact086 production source; no full recovered frontend deployment.042/066 remain excluded.

Rocket812 completed the exact two expressions. Actual compiled behavior PASS; old receipt claim reproduced in compiled code, zero/unknown neutral, positive and conflict fallbacks retained. Entire entry reverses exactly to086; prior repairs and seven dependency relinks PASS. No payroll chunk changes. Ready for controlled existing-path release.


Live PASS: deployment0eacf72e-5688-40a7-894b-dfa9acd40bff, index-b30821e53d7e.js, SHAb30821e53d7e200110c70921cdf21e7f4574811cc4deaefc2909b87216d7de1a. After full reload and settled Refresh, count0 remains, label reads No missing reports recorded for09/11/2026; receipt not confirmed, neutral slate, no false receipt claim. Claim122, portiondue14983, POS108440, refunds347, MTDnet280649 unchanged. eAssist link retains3missingwarnings/63reports/50rows; draweropens/closes. Browsererrors0, frontend/API200, three servicesactive, backend085hashunchanged.086rollback retained. No business writes.

