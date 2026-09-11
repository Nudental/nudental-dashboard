# NDASH-016 — Provider Performance multi-office selection became All Offices

- Severity: High. Reproduced in the live screen: Barnegat+Brick selected, but request omitted location and displayed all-office net 274107.78 and collections 236276.09 for August 12–September 11. Independent selected-office sums were 209302.95 and 160634.99 at that checkpoint.
- Root cause: `dentrixLocationId` was set only when exactly one office was selected; two offices passed `null` to the existing API, which means all offices.
- Changed: only `src/pages/provider-performance/index.jsx`, plus focused tests.
- Fix: resolve and deduplicate every selected office; reject unresolved IDs; fetch each selected office through the existing scoped endpoint; merge net/collections by provider ID including unattributed activity; recompute combined collection rates; sum existing summary/reconciliation fields while preserving unavailable values; show selected office names. Single-office and all-office calls retain their prior paths. Failure clears stale results instead of leaving an old scope visible.
- Tests: 51 frontend regressions PASS; final production source build PASS (28.42s); four exact-artifact request-dispatch scenarios PASS; syntax and exact reversal PASS. No backend/configuration/business-data change.
- Code commit: `6ee164a`. Prior source and artifact preserved.
- Deployment: `92c3bcb8-6e21-4e55-979c-038b8750e6f3`, existing Cloudflare Pages direct upload. Asset `/assets/index-4e913264d935.js`, SHA256 `4e913264d93580858b8e3c6c7b3cf01a4f92fe6b93d4f8a20ca8261469aa9940`. Rollback `ndash013-v2-dist`; current `ndash016-dist` in private server audit directory.
- Live verification PASS: selected single office, then combined office view, then All Offices restoration. Today's data changed during initial checks, so final exact comparison used completed July 12–August 11.
- Stable-period API/UI comparison: Barnegat net 131832.00, collections 100396.24; Brick 76201.26 and 75395.37; combined 208033.26 and 175791.61, 16 unique provider rows. UI shows rounded matching totals, `Barnegat, Brick` scope labels, and reconciliation. All Offices restores 341388.22 / 284321.97 / 21 rows. No browser errors.
- Date-control test note: browser automation `fill()` changed date DOM values but did not commit React state; native arrow keys did commit dates and persisted across office changes. This is a tool interaction caveat, not a confirmed application date defect.
- No business records or temporary records created. Remaining Provider Performance category/trend/detail/type-filter checks continue separately.
