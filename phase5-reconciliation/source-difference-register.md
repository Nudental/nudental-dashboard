# Production/source difference register

This register is incomplete. The full recovered build is not approved for production or promotion to main.

| Area | Deployed artifact | Recovered source | Disposition / evidence |
|---|---|---|---|
| Rocket editor attributes | 206,367 generated `data-component-*` properties; 12,683,582 source bytes | No editor properties | Generated difference established. Omission is not whole-application semantic equivalence proof. |
| Supabase package | Embedded client version 2.110.2 | Previously installed 2.116.0 | Private static reference build uses 2.110.2. Remaining packages still under comparison. |
| Production build inputs | Existing Dashboard Supabase URL and anonymous client key | Missing from original local full build | Recovered privately into a reference-only build workspace. Never use that workspace as QA; no app/network/database execution occurred. |
| Expense middleware header | Existing Dashboard API header | Empty when `VITE_ASCEND_API_KEY` is omitted | Recovered the existing value privately into the reference-only environment. This accounts for a real build-input gap without changing production authentication. |
| Payroll provider compensation | Component passes Gusto dates; service subtracts one day before Ascend | Component subtracts one day; service accepts final dates | Valid-period query agrees. Other display/debug differences still under review. |
| Payroll Audit | Component passes Gusto dates; shared service subtracts one day | Both component and shared service passed dates unchanged | Confirmed source gap, repaired only in reconciliation worktree using the existing calendar helper at the caller. Four cases failed before; five checks pass after, including execution of the exact preserved production service date prelude. No payroll data read or write. |
| Main Payroll custom ranges | Shared production service subtracts one day for every caller, including custom dates | Rocket source originally exempted custom dates from subtraction | Reconciliation preserves production's current query behavior: the recovered caller now shifts custom dates once, before the final-date source service. Four actual-callback parity cases failed before and pass afterward, including comparison with the preserved production service. Raw chosen/display dates stay intact. Rocket's alternate behavior remains recoverable on the Phase4 branch and commit106a2ee; this is source alignment, not a production payroll-rule change or accounting certification. |
| AuditTrailManagement filter reset | Reset effect follows derived calculations | Same reset effect precedes derived calculations | Present in both; same effect ordering relative to loading. NDASH-112 retained. |
| Expense Report helpers/state | Some Phase4 guards/helpers and error state inserted locally in compiled component | Shared date helper plus declared source state | Under review. No financial totals changed or certified. |
| StatisticalSummary API helper | Two retained null guards check the `Ue` API object before invoking the replacement report helper | Direct helper call | Actual guard target is the API object, not the helper. Verified its initializer is an object literal and its binding has0 assignments after initialization. Report helper/arguments remain subject to overall dependency comparison. |
| insurance-verify rendering | `jsxs` at one call | `jsx` at counterpart | Verified production `n.jsx` and `n.jsxs` initialize to the same `c9e` function through `use`/`KSe.exports`; one assignment per property and no direct `n` mutation. This resolves the function-name distinction for the actual runtime; imported-module analysis remains separate. |
| provider-performance caption | Concatenated string child | Array of adjacent string children | Actual host paragraph and string-only branches reviewed. Five synthetic cases render identical markup through the retained React18 production server renderer; no application/API import. |
| Lazy module references | Versioned incremental-release module names | New full-build module names | All8 module bodies match after the explicitly reviewed generated differences below; all119 entry export bindings match the existing structural/dependency graph. |
| Office report handler / Payors read | Extra constant aliases of existing state/parameters | Direct use of those bindings | Local alias normalization produces matches in both components. Guarded against assignments, imports with live bindings, forward initialization, and direct eval. External dependencies still require their separate comparison. |
| React DOM / compression library | Minified control-flow labels and external assignment-target identifiers differ | Alternate generated names | Label-target and read/write binding normalization accounts for these differences; no package upgrade/downgrade was made based on name-only differences. |

## Comparison-tool limits

Structural hashes that replace every external binding with a placeholder are triage only. A second pass examines the ordered graph of actual global bindings, but does not by itself certify global object mutation/initialization ordering or dynamic module identity. Template literal raw/cooked values are retained in current comparison results; an earlier diagnostic serializer omitted nested non-AST objects and has been corrected. No promotion or deployment was based on those preliminary results.

## Completed lazy-module review

Reference entry: `index-Boxpjk7X.js`, SHA256 `64377d6f6c2f948d114b285260bb679990d374dfc9727b56048cc2d1c1374b6d`.
Production entry: `index-0230990f6d6c.js`, SHA256 `0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8`.

- Canvg, date-fns, Gusto Import History, Gusto Pay Schedules and Help Manual are byte-identical after replacing only the versioned entry filename. DOMPurify is byte-identical without any replacement.
- Gusto Benefits differs in generated local variable names; its entire AST, including imported export names, matches after scope-aware local-binding normalization.
- Gusto Time and Attendance retains the same import names, statements and expressions after compiling both sides with the observed esbuild/Vite target. Remaining differences: two uninitialized `var` declarations appear before versus after an early export return (JavaScript hoists these declarations); the same host button supplies `disabled: !rows.length` and an already initialized constant click handler in opposite property order. Both differences were inspected and asserted before normalization. The complete resulting module then matches.
- All119 exports of the main entry resolve to matching actual binding/dependency graph counterparts. This covers the imports used by the lazy modules; no import was accepted merely because its public export letter was unchanged.
- The production DOMPurify module is retained in the earlier NDASH031 asset folder and remains referenced by the final entry; it was not missing from the application simply because it was absent from the last incremental asset folder.

Evidence outside the public repository: `module-content-comparison.json`, `lazy-module-verification.json`, `module-export-binding-verification.json`, and the static `verify-lazy-modules.cjs` verifier under the Phase5 working evidence folder. No application module was imported/executed, and no provider or database was contacted by these checks.

Main-entry review remains in progress. These completed module checks do not certify the remaining main-entry source differences. The later custom-range source correction is separately covered by actual-callback tests; these module artifacts predate that correction.

## Custom payroll query alignment

The current deployed `Sve` service shifts every request date by one day, including custom ranges. The recovered V734 caller explicitly bypassed the shift for custom dates, and its helper test repeated that bypass locally instead of executing the page. To make the baseline reproduce current production, a narrow custom-range branch now uses the existing calendar helper once. Scheduled-run code and the source service remain unchanged.

The original custom input object is unchanged, and the recorded applied query window agrees with the final service call. Synthetic August21, month boundary, year boundary and leap-day comparisons failed4/4 before editing and passed4/4 afterward against the actual preserved production service. The combined Payroll Audit/custom parity and retained request-state checks pass14/14,0 skipped. Calendar helper checks pass too. No provider/database requests, production deployment, data change or payroll execution occurred.

## Rocket re-export attempt

Opened the existing authorized NuDental Dashboard workspace's Code view through its toolbar menu. Download Code produced neither a download event (12-second bounded wait) nor a new Dashboard ZIP in Downloads. No visible error appeared. Existing code tree is available; use other safe source inspection while this export path is unresolved. No Rocket code/configuration changed.
