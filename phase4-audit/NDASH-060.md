# NDASH-060 — Late Patient Balances responses overwrite the selected office

Section: RCM / Patient Balances. Severity: High. Status: repaired, deployed, live verification PASS.

Reproduced twice on frontend058: selecting Staten Island then All Offices leaves count63 instead of1278; Barnegat then All Offices leaves585. Visible rows retain mixed offices and exceed pageSize50 (57/58). Independent default API summary1278 agrees with a settled all-office load. No financial records altered.

Root cause: PatientBalancesTab.jsx accepts every overlapping response without a generation guard or effect cleanup. An obsolete result updates data, totals, metadata, errors and loading. The smallest repair adds useRef generation, clears stale display state at request start, guards success/error/finally, and invalidates pending requests on cleanup. API queries, financial values, filtering, row semantics, exports and configuration stay unchanged. Repeated provider patient identifiers remain a separate unconfirmed source observation; no deduplication applied.

Verification: five deferred-request failures reproduced on old source; all276 source tests PASS after repair. Production build PASS32.52s. Actual production componentPwt tests PASS for reversed responses, obsolete errors/loading, current failures, empty results, cleanup and preserved query parameters. Six scoped AST edits; exact reversal to058, all prior repairs and seven dependency relinks PASS. Rocket version790 completed.

Release candidate: index-f223db137ed0.js; expected prior deployment3bcd97e5-baf7-4952-8271-d712d3d097b1. Entire prior graph retained. Backend059 unchanged; no business data writes, exports or provider configuration changes.

Live closure: deployment2fa13056-854b-46fc-963e-870f04f076be, SHA f223db137ed0b565fd4cccda5cb05950651ac953b55e32e43b4fa16e2cdd769e. Both rapid Staten→All and Barnegat→All retain1278/50rows; page2 remains50. Aging90 returns800; minimum10000 returns1, both matching API. No-match search returns0/empty table/export disabled. Refresh restores default filters1278/50rows and no browser errors. No new financial records or exports.
