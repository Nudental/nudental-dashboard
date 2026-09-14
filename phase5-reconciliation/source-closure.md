# Production source reconciliation

Scope: NuDental Dashboard only. No production deployment or business-data write
has accompanied this reconciliation. The final clean-install build and
retained regression run pass as recorded in the checkpoint.

## Preserved production

- Deployment: 4f583195-5bef-4c51-9e45-de3cc73819d1.
- Entry: index-0230990f6d6c.js, 21,740,870 bytes;
  SHA256 0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8.
- Rollback: 5abc436a-8bbb-4dcb-99db-6504de25ef7c.
- Original main: e4a2e0944f74514f6ea98e5ea32eb140333b964f.
- Reconciliation descends from the Phase4 audit branch. The fetched main is an
  ancestor, with zero main-only commits. The older root implementation remains
  preserved but is not used by the canonical frontend build commands.

## Reproducible inputs

The frontend is recovered-frontend/, Node22.22.1/npm10.9.4, React18.3.1,
Vite5.0.0, plugin-react4.3.4 and esbuild0.19.12. Its committed 607-entry lock
includes production-matching Supabase2.110.2, Papa Parse5.5.4, Floating UI
DOM1.7.6/utils0.2.11. Compatible core1.7.5 emits no code in this application;
the historical core installation cannot be inferred from the artifact.

Three private production build inputs were recovered by name and verified
without printing values: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and
VITE_ASCEND_API_KEY. They stay outside Git. Production and QA require separate
values and separate artifacts. The reference build directory is never served.

The latest aligned reference entry is index-DEzyMZYc.js, 8,820,106 bytes,
SHA256 386ff8ce3ff643e44233c518395a9d255a92df6a15273c61bc23aae7a992cbdb.
Its build passed in37.18s. A clean offline installation and the normal root
build command passed in32.73s, producing18 byte-identical assets with an
unchanged lockfile. All996 frontend tests passed with zero failures/skips.

This is semantic reconciliation, not byte-identical reconstruction of Rocket's
historical artifact. The live entry contains206,367 generated data-component
properties occupying approximately12.68MB. The reproducible build omits those
editor attributes; minified binding names, generated chunk names, module
factoring and compression consequently differ. These differences are known;
they are not described as random build metadata. Every emitted library and
dynamic module was compared separately from app behavior.

## Comparison coverage

- Exact structural/dependency comparison initially closes12,832 top-level
  bindings with zero conflicting aliases, including all16 previously pending
  dependency lists. All119 public exports resolve to their actual bindings.
- Fifty-eight explicitly reviewed source/component correspondences remain
  separate from automatic proofs. Their decisions are summarized below.
- Another46 complete structural bodies close over those reviewed dependencies,
  including the recursive financial service group and the final application
  tree. Total correspondence count is12,936 of12,946 production items.
- The remaining10 items are accounted for: six unreferenced old helpers/URL
  constants; the monthly-growth factory; the separately verified scatter
  helper; the benchmark badge whose caller changed its input contract; and the
  separately verified export declaration. None is an unexplained omission.
- All413 mutable production global bindings have corresponding mutation-site
  types/order and scope. The sole extra source global is the monthly-growth
  concurrency counter, previously inside the verified factory closure.
- Matched effectful initializers have zero order inversions. The remaining Set
  constructor, four lazy initializers and entry render match independently.
  Monthly-growth factory initialization/calls are covered by11 synthetic tests.
- Eight lazy modules match after module-specific filename mapping, with their
  main-entry imports checked by actual binding identity. Eight remaining public,
  CSS and HTML assets match. Successive Huddle/help builds have exact bounded
  entry deltas and no other unexplained asset changes.

## Reviewed differences

| Area | Resolution/evidence |
|---|---|
| Payroll Audit and custom ranges | Restored the deployed one-day Ascend query offset exactly once in existing callers;9 actual-query parity tests. Scheduled Gusto period labels remain unchanged. |
| Payroll service | After removing only its separately verified date prelude, the entire deployed service matches the source service with actual global dependencies. |
| Payroll presentation/export | Removed undeployed Rocket notices/debug displays and restored scheduled export naming/footer. Original source remains recoverable on the Phase4 branch;5 parity tests. |
| Help | Removed the sole undeployed article34 that described the removed payroll display. All33 remaining articles match the deployed IDs/order/content exactly. |
| Huddle | Restored unconditional effect cleanup, including the no-profile path;4 actual-callback parity cases plus retained request-order guards. |
| Monthly growth | Factory-to-module factoring, including queue state, direct calls, history and sparklines;11 cases verify scope, outputs, failure, concurrency, stale responses and deduplication. Five older helpers have zero incoming references. |
| Audit/EOD/Expense pagination | Eight local helper copies and11 additional helper definitions match actual dependencies. Thirteen shared functions are immutable with zero non-call references. Complete Audit service remainder matches after the verified reader extraction. |
| Expense service | The office/category/month aggregators match. Record/KPI failure guards move before pure JSON array/object preparation; request/error/output behavior is preserved. |
| Expense parent/export | Forty-eight cases compare actual deployed/source rendering and exports: tabs, permissions supplied to the component, errors, empty/populated rows, filtering notices, and Blob URL cleanup. This does not certify real API roles or accounting authority. |
| Period comparison | Twenty-two actual-callback cases compare synthetic request scope/order and results for partial failures, zeros and missing fields. |
| Import audit/summary | Exact alias tables and synthetic query/readback comparisons cover normalized statuses, failures and summary totals. No import executes. |
| Benchmark | Exact metric list/delta calculation and actual badge rendering agree for10 populated, missing, invalid and threshold cases. |
| A/R | Both office lookup maps match deployed literals and are read-only; eight synthetic scope/error/aggregation cases agree. No financial records were copied. |
| Office/contractor exports | Actual component props, display and intercepted export output agree across format, permission/loading/error states and synthetic payments. No browser file or business export is created. |
| Goal/actual | Only immutable local aliases for the same values/boolean expression; no additional request, calculation or effect. Retained service guards remain. |
| Remaining UI | Generated JSX versus createElement; unkeyed arrays/Fragments; null children; host property/class order; equivalent string assembly/optional-chain temporaries; pure derived-state placement; and equivalent early guards/setter forms. Effects preserve their relative execution order. No unrelated source refactor was performed. |

The direct static review includes filters, charts, revenue breakdown,
production/collection adjustments, financial summaries, Huddle, supplies,
performance/trends, operations, provider KPIs, claims, RCM, daily comparison,
audit/EOD/compliance, payroll and Expense subcomponents. Semantic review is
supported by retained behavior tests; it is not a claim of mathematical
equivalence for every possible input or an API permission certification.

## Backend and routing

Sixteen source/schema files reconstruct to exact captured bytes from typed
templates plus71 private configuration slots. No business database was copied.
The running API interpreter is the existing Python3.14.6 virtual environment,
not the server's default Python3.12.3. Its86 installed dependency versions match
the observed inventory. Seventeen isolated retained backend suites pass on
that interpreter, with zero blocked network/process attempts;13 materializer
checks pass. Provider/database side effects are replaced in the test harness.

Cloudflare Pages is direct-upload; there is no Git build integration to change.
The existing Dashboard tunnel is healthy. Its version7 configuration sends
api.nudashboard.com/v2/auth/* to8002 and remaining Dashboard API traffic to8001.
Cloudflared2026.9.1, gog0.11.0 and WeasyPrint68.1 runtime paths/hashes were
recorded privately. No tunnel, secret, service or provider configuration changed.

The private evidence directory preserves all raw artifacts, manifests, maps,
source comparison tools, bounded delta proofs and earlier failed harness runs.
Failed harness attempts are distinguished from app defects. No Phase5 defect
count is inferred from differences between recovered source and the live app.
