# Phase 5 — source reconciliation in progress

Scope: NuDental Dashboard only. Complete source reconciliation before QA/role/write testing and Expense authority resolution. Do not repeat Phase4 or modify the Collaboration Platform. Do not promote/deploy the full recovered frontend before semantic differences and all157 repair guards are verified.

## Latest checkpoint — aligned source and libraries

The production baseline is still being reconciled; GitHub main and production remain unchanged. The sections below this checkpoint retain earlier investigation history and their older counts/build names.

Latest additional verification:

- Current full frontend run:914/914 PASS,0 failed/0 skipped,91.95s (837 retained +77 Phase5). The latest source change restores production's unconditional Huddle cancellation cleanup; two no-profile parity cases failed before and all4 effect comparisons plus7 retained request-order cases pass after. This aligns recovered source only; production was already using that cleanup.
- Fresh Huddle-aligned build PASS in36.93s: `index-BbtMFuzs.js`,8,821,614bytes, SHA256`2df2727a6aa8588d7cd9cd567dd8aa4d02b5bf18bfa345edc2e650cbcdf7c1db`. Compared with the previous reference after matching known module filenames, the entire entry differs only in the36-character conditional-cleanup expression becoming its27-character production counterpart. All8 lazy modules and8 other HTML/CSS/public assets match. Private source maps are excluded from publishable asset comparison. Neither reference was served or deployed.

- Actual running API entry is `.venv/bin/python3.14`, Python3.14.6, for both Dashboard services. The server default Python3.12.3 is not the live service interpreter. Both service environments contain the same86 package/version pins already preserved here. Following the resolved base binary alone loses the virtual environment; two synthetic suites initially lacked FastAPI through that base path. The correct virtual-environment run passes17/17, with0 external/data boundary attempts. This was a runner-path issue, not an application defect.
- All8 lazy modules match the `index-B4ss0_dI.js` reference, including imported binding identities. Fresh entry binding check:12,809 mapped units,12,793 exact ordered dependency mappings,16 pending,0 alias conflicts,119/119 exports matched. These are partial structural results, not a whole-app certificate. These artifact reports precede the latest one-line Huddle alignment; its fresh build is being generated separately.
- New Expense rendering/export comparisons pass48/48 using the actual SHA-verified production component and current source component, synthetic state and stubbed child components/parameters. Coverage includes7 tabs, loading/failure branches, supplied role/permission combinations, unsupported filter notices, invalid dates, empty/populated export guards and Blob URL cleanup. No provider, database, browser download or effect ran. These tests establish component presentation/export parity, not API authorization, supported-role provisioning or accounting authority.
- Ten additional factored helper definitions and their actual global dependencies match: Audit pagination/year range, financial trend periods, office monthly totals, provider scope, P&L scope, EOD pagination/page bounds and benchmark delta. They are closure-free, immutable and used only as calls. Their9 shared source bindings plus the earlier3 shared helpers are immutable with0 non-call references.
- Bounded React-only initializer execution confirms React18.3.1's direct/default interop aliases are the same object in both artifacts; neither object has a separate default export or ES-module marker. No app/browser/provider code ran. Verified module-specific references also resolve the jsPDF plugin expression's two filename differences without conflating distinct lazy modules.
- Five Expense service counterparts now align. Office/category/month aggregators have0 remaining expression differences. Record/KPI readers move a failure guard before pure intermediate array/object construction; calls, error and returned results remain the same for their JSON response inputs. The record reader's exclusion predicate only reads `allocation_metadata.excluded_from_expense`.
- Tunnel version7 routes `api.nudashboard.com/v2/auth/*` to local8002 and the remaining Dashboard API to8001. The Dashboard tunnel remains healthy. Cloudflared2026.9.1, gog0.11.0 and WeasyPrint68.1 are present. No tunnel configuration, service, credential or production data changed.

Main-entry initialization/dependency review remains open. No main promotion or QA setup has occurred yet.

- Frontend production build PASS on Node22.22.1:44.30s, private entry `index-B4ss0_dI.js`,8,821,623bytes, SHA256 `e743824ad4bbd852918c3d3f80a6da438c45f2ba1609a364f16a6986b3f4bc86`. It includes the current query/display alignment and pinned production-matching libraries. It has never been served or deployed.
- All862 frontend checks PASS,0 failed/0 skipped:837 retained Phase4 +9 payroll query parity +5 payroll display/export parity +11 monthly-growth production/source parity. Runtime54.13s. Backend17 retained suites and13 materializer checks previously passed; those source files are unchanged.
- Actual production identifies Papa Parse5.5.4, Floating UI DOM1.7.6 and utils0.2.11; the candidate previously resolved5.7.0/1.8.0/0.2.12. The607-entry dependency lock now pins these versions and compatible core1.7.5, preserving the prior peer-package model. No core code is emitted, so its original historical version is not inferable from the artifact.
- Undeployed Rocket payroll notices/debug additions and changed scheduled CSV naming are retained in the existing Phase4 recovery branch, while the reconciliation candidate now reproduces the deployed display/export behavior. The deployed Provider Compensation explanatory caption is preserved. The earlier calendar-query alignment remains in place and verified.
- Expense export's two missing disabled-style classes are restored. No financial values or export data change.
- Monthly-growth production factory and source module agree on synthetic outputs, request scope/order, failures, concurrency limit and duplicate prevention. Four older functions left in the compiled artifact have0 incoming binding references; source omits those unused helpers.
- Backend source reconstruction remains exact for16 source/schema files with71 private configuration slots; no business database was copied. See `recovered-backend/README.md` and `backend-source-provenance.md`.
- The previous42 comparison reports are preserved privately in `comparison-before-ui-library-alignment`. Fresh build comparison is in progress. Older binding/module proofs apply to the earlier reference build until regenerated; they are not full-app equivalence certificates.
- Read-only browser check still shows Revenue Cycle Management at the existing Dashboard URL. No Phase5 production deployment, source promotion, QA provisioning, role creation or production write occurred.

## Preserved starting state

- Local Phase4 closure:70fe45250c8ef672b9bbce1ce4861278b876fc4a; repair source/tests7f1e7529797e32d1c92525ddde0154b99eb3367e.
- Fetched origin/main:e4a2e0944f74514f6ea98e5ea32eb140333b964f, unchanged.
- New local annotated tag:backup/nudental-dashboard-before-phase5-20260913.
- New worktree branch:reconcile/nudental-dashboard-production-20260913.
- Existing Phase4 branches/tags/recovery releases preserved.
- Current production deployment4f583195-5bef-4c51-9e45-de3cc73819d1, entry index-0230990f6d6c.js, SHA256 0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8.
- Current server source/configuration snapshot:/home/openclaw/.cache/nudashboard-phase5-20260913/baseline-70fe452;62 files copied privately, no business databases. Original release graphs remain in their previous private recovery location.

## Findings established so far

1. GitHub root is a different application/dependency generation: React19/Vite8; recovered/current Rocket source uses React18/Vite5. Root main must not be published over production.
2. Cloudflare Pages nudashboard is direct-upload, with no source integration, build command or environment build-variable definitions. Its main label identifies the deployment environment; it does not prove GitHub main supplied the code.
3. The recovered frontend's gitignore excludes package-lock.json. A522-package lockfile exists in the local Rocket build workspace and must be preserved for reproducibility.
4. Current local Rocket and audited recovered trees match all643 compared source/public/schema files after line-ending normalization.
5. Local build runtime:Node24.19.0; existing server runtime:Node22.22.1/npm10.9.4/Python3.12.3. Installed frontend versions:Vite5.0.0, React/ReactDOM18.3.1, plugin-react4.3.4, esbuild0.19.12, Supabase JS2.116.0, Recharts2.15.4, component-tagger1.0.16.
6. Current production has no source maps. Its21,740,870-byte entry contains206,367 generated data-component properties occupying approximately12,683,582 source bytes. Recovered source has no such attributes; its current full-build entry is8,844,049 bytes. This is a substantial generated difference, not semantic-equivalence proof.
7. Initial structural triage after omitting editor metadata and normalizing local bindings:12,946 production top-level items versus13,040 recovered;224 production/312 recovered items have no structural counterpart. External-binding identity remains to be verified; initial matching counts are not proof of equivalence.
8. Backend source is52 top-level Python files in the existing ascend_api workspace, with main.py resolving to the verified candidate. Both API services8001/8002 and the existing tunnel remain active. No production changes in Phase5.

Next: pin the observed lock/runtime inputs, generate private source maps for comparison, classify remaining code differences, and verify dependency bindings and every retained repair. QA and Expense work have not started yet.

## Reference-build investigation

The old lockfile is stale as well as untracked: it names react_template and27 direct dependencies, while the recovered source declares37. Merely committing that old lockfile would not reproduce the Phase4 build workspace. Nine direct installed versions also differ from a fresh install of the repaired lock, so dependency matching remains part of reconciliation.

The deployed Supabase client contains version2.110.2; the Phase4 local build installed2.116.0. A separate reference workspace now uses2.110.2 and a freshly completed lockfile. The existing production Supabase URL/anonymous client build key were recovered privately from the exact verified entry and supplied only to that static reference build. No source key value was printed, no application was executed, and no database request was made by that build. This reference workspace is NOT QA and must never be served or deployed as QA.

Private mapped builds PASS: initial source map build41.70s; corrected reference build44.82s. The latter entry is8,830,270 bytes. Source maps and production build inputs stay outside the repository and must not be published.

Initial comparison after metadata/local-name/shorthand normalization:148 production and183 recovered items still unmatched. Matching further ordinary code compression reduces this to100/135. These are triage counts, not a complete semantic-equivalence certificate: external dependency bindings, moved effects and remaining differences still require review. For example, AuditTrailManagement retains the same filter-reset effect in both builds but places it on different sides of derived filter calculations; it was not removed from production.

No Phase5 production deployment, GitHub main update, QA provisioning, role creation, write testing or accounting-data change has occurred. Continue source reconciliation first.

## Current verified checkpoint

- The saved Rocket lockfile was also inspected in the current Code view: it still identifies `react_template`; it is not a reliable current runtime dependency inventory. Rocket Download Code has not produced a download event or new ZIP in this session. Source remains accessible in its editor.
- Reconciliation now retains a complete reference lockfile and pins Supabase JS2.110.2, matching the deployed client version. Other dependency differences remain under review; this lock is a candidate, not a certificate of complete production parity.
- A checksum-verified local copy of official Node22.22.1/npm10.9.4 matches the existing server runtime. The corrected static reference build passes in41.81s; all10 JavaScript/CSS output assets are byte-identical to the Node24.19.0 reference build. Canonical `.node-version` now names22.22.1. No server runtime changed.
- Actual binding-graph triage checks retained AST plus ordered global references rather than replacing dependencies indiscriminately. It stabilizes after11 rounds:12,528 production units have counterparts;418 remain unmatched directly or through differing dependencies. Unknown global-binding owners:0. Dynamic modules and omitted editor metadata still need their separate checks. No whole-app equivalence claim is made.
- Payroll Audit source omitted the one-day Ascend offset that production performs inside its service. The reconciliation caller now uses the existing calendar helper once. Four synthetic boundary tests failed before the correction; five checks pass afterward, including the exact SHA-verified production service date prelude. Gusto period dates and business data remain unchanged.
- All837 retained frontend regression tests PASS with the reconciliation source and reference dependency parser. New Phase5 payroll parity checks5/5 PASS; no skips in the run using the preserved production artifact.
- Read-only production health verification PASS: frontend/API200, all three existing services active, backend148 source hashes unchanged, production entry SHA still0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8.
- The remaining payroll custom-range behavior difference is explicitly unresolved in `source-difference-register.md`. Continue actual source-difference review before promotion, broad deployment, or QA provisioning.

### Completed build inputs and runtime checks

The Expense service also requires `VITE_ASCEND_API_KEY`. The first reference build omitted it, so its Expense header was empty while the verified production header had a value. The existing value was recovered from the exact artifact into the private reference environment, without execution of the app or a financial request. The reference now includes all three observed build-input names; no values enter this repository.

With that input and the Payroll Audit source correction, the Node22.22.1 reference production build passes in43.30s. Entry size8,829,095bytes. Updated raw triage:143 production units/169 recovered units unmatched, with9,637 unique structural matches. Older graph/minification reports predate this last reference build and must be regenerated before relying on their mappings. All graph comparisons remain diagnostic; global initialization/mutation ordering and dynamic module identity require their own checks.

Node22.22.1 rerun:842/842 tests PASS,0 failed,0 skipped (837 retained +5 Phase5),35.16s. Source reconciliation is still in progress; main and production remain unchanged.
