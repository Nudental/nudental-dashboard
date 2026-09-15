# PH5-PERF-001 — Duplicate responsive page mounts

The live QA Management route contained two `Management & Settings` page instances, one hidden by responsive CSS. This was observed twice. Its visible component had independently selected settings state while the hidden component retained its own default state. The source mounted an Outlet under both `hidden lg:block` and `lg:hidden`; CSS visibility does not prevent React from rendering their children or mounting their effects.

The targeted repair keeps one Outlet and applies the desktop-only sidebar offset through responsive CSS and the existing sidebar-width value. Authentication gates, subscriptions, child routes, and other layout controls are unchanged.

- Actual-layout JSX rendered with React: original 0/2 PASS (two route renders at both sidebar widths), repaired covered by 1,338 retained PASS, zero skips.
- 510 source files match; QA build and credential/isolation checks PASS.
- Source `47e50df0aff288da0d3bdba71ff3359cdf68beea`; QA deployment `d7acf707-f2e4-4078-aac9-7ba30762fb1e`; previous `0dbd298d-1cf5-446c-b843-e43156643dd6` retained.
- Entry `assets/index-CulBfsyv.js`, 8,828,365 bytes; SHA256 `59bda0d6be4eb38edf97aed7d1dd552f3ab5c3d7fa65eda0bcaac3096d16e2b1`. All 17 hosted checks PASS. Production release unchanged.
- Live desktop: one page instance; expanded sidebar margin 240px, collapsed 64px.
- Live mobile: viewport content area 375px under a 390px override, document scroll width 375px, zero sidebar margin, one page instance.
- Resize back to desktop: still one page instance, 64px collapsed margin, selected August 2027 goal section/month preserved.
- Temporary responsive tab closed and viewport overrides removed. The SQL tab was separately saved (Saved state verified) and closed because an initial viewport attempt targeted it; that attempt was not counted as QA mobile verification. Main QA tab retained.

This proves removal of duplicate route rendering and preservation across breakpoints. It does not quantify network-request savings, native first paint, memory reduction, or a percentage improvement in page-load time; those measurements remain unavailable through current browser inspection. Bundle reduction was negligible. No production performance release was performed.

Service-goal preview guard checked before this repair: one QA office, one explicitly synthetic category, 12 insufficient-baseline rows, zero Ready, Save disabled. Preview cancelled; no matching `service_category_goals` rows persisted. Positive generation from provider actuals remains pending an isolated data adapter. Receipt: `qa-service-goal-preview-20260915.json` outside source control.
