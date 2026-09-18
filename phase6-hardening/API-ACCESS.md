# API identity rollout — in progress

## Independent Phase 6 release closure

All independent Dashboard work is deployed and verified. Groups A-E, frontend dependencies, dated Payroll Comparison and all route reviews are dispositioned. Six final production pages pass read-only UI checks: Executive Overview, Financial Analytics, Reports, Inventory, Huddle History and Insurance; prior RCM/Expense/dated Payroll checks remain preserved. API/production/QA health, source parity, artifact hashes and original-row guards PASS. Additional scheduled-script inspection found no unadapted literal provider consumer in the inspected script/calendar directories. No real provider call or scheduled job was executed for validation.

Canonical integration uses a normal fast-forward from `820970ede7727830d95d8d03d518d02119da1acd` to the Phase 6 closure commit containing this report. Application source is `78cc78da4affc54f4308a4731551a46f30854e17`; subsequent changes in this closure are documentation only. Recovery tag: `backup/main-before-phase6-independent-closure-20260918`. The exact resulting main SHA is recorded in the saved release pointer and final Git verification receipt after push. Preserve the Phase 6 branch and all prior tags; no force push.

**Phase 6 is NOT complete.** Only two already-reviewed human gates await the pending Collaboration activation decision: `/v2/rcm/ar-aging-official` and `/v2/rcm/ar-location-health`. Its cached report helper needs a process restart; startup immediately ticks the scheduler and may dispatch due work. No answer authorizing that side effect is recorded. Choose a planned restart/deferment or explicitly allow restart and normal scheduled work. Dashboard releases and source closure do not authorize that action. All other currently available independent work is complete. Accounting residuals remain separate and frozen.

## Provider access and OAuth callbacks - deployed

Source `78cc78da4affc54f4308a4731551a46f30854e17` applied at 2026-09-18T14:36:16.903788+00:00; API main SHA256 `7b85a17d6a9bac738bb4239b83326199c99957b499d14335e7d6934a95607917`. All 22 previously remaining provider declarations are reviewed: 20 existing control/read declarations require current human identity, and two public redirect callbacks require a valid short-lived, one-use administrator-created intent. A minimal authenticated Gusto authorization-URL route provides the missing intent initiation, making 21 control/read declarations. Catalog/status use the existing Front Desk grant; global provider controls require the active approved Super Admin. Existing request/review permissions remain unchanged.

Gusto no longer exchanges a missing-state callback or overwrites its token file after a failed exchange. Amazon no longer accepts callback state when no intent was saved. Intent hashes are held separately from provider credentials and process locking prevents replay. Existing credentials, scopes, redirect destinations and refresh logic are preserved. Positive provider tests used synthetic transports only; no real authorization, sync, delivery or purchase was executed.

Separate `plaid-sync`, `morning-brief` and `payroll-balance-watch` identities retain only their existing exact GETs. Fixed loopback origins and redirect rejection prevent credential forwarding. Their schedule and business-processing AST remain unchanged. Four prior identities and their credentials/expiry are preserved. All seven identities retain the existing December 16 renewal deadline; never restore the revoked reconciliation-validator token.

**Verification:** 324 guarded native tests, 17 retained backend suites, 13 materializer tests and two exact external-caller checks PASS. Live missing/invalid identity checks return 401; unrelated jobs and writes return 403; both callbacks reject missing intent before a provider call. Same-period Summary/RCM results remain unchanged. All 79,171 guarded original Supabase rows and 83,991 original SQLite rows are preserved. Schemas, provider configuration, scheduled jobs and financial source records are unchanged.

Final read-only parity at 2026-09-18T14:52:28.766982+00:00: all 36 materialized files and both external caller adapters match. Production/QA/API HTTP health PASS; QA retains `product_api_ready=false`. Frontend artifacts remain production `index-DRITFcr0.js` (8,835,047 bytes) and QA `index-BXvFvJGj.js` (8,833,878 bytes). No new speedup claim is made.

Recovery: `backup/api-before-phase6-provider-reads-20260918`, `api-provider-read-backup-20260918T143542Z`. Full source/config/caller recovery copies stay private on the server. Existing frontend rollback deployments and all earlier tags remain.

**Remaining:** Two report-dependent human gates await the Collaboration restart/scheduler decision. Independent regression and source closure are complete; Phase 6 remains incomplete pending that activation decision. No Collaboration source, credential, process or scheduler was changed. Accounting follow-up remains frozen.

Dr. G approved existing signed-in user checks plus separate restricted identities for approved background jobs. The first bounded eight-route payroll release deployed on 2026-09-17 at 22:55 UTC from source `30521585ecb3f7e5f1d3651a817e0acc68000a3f`. Server verification passed; live browser verification is tracked separately in CHECKPOINT.md.

The confirmed defect is that a payroll read accepted the shared application key with no user session or an invalid session. The application key identifies the client application; it must not establish the person's identity.

## Administrative API boundary — deployed

Source `cf9cff66d030b7c14943f60d10f51e895a9cc650` applied at 2026-09-18T07:26:41.952563+00:00; main SHA256 `8b057829ac239c2d4aa4b9815b6823ea114fb90a3885829c669235728655e8ef`. Ten diagnostic/maintenance routes now require verified human identity, existing role/page permission and all-office scope. Jobs are denied. Existing route bodies are unchanged. 136 native tests, 17 retained backend suites and 13 materializer checks PASS. Candidate and production denial probes PASS; the existing payroll validator remains 200.

Fresh guards preserved all 20,868 original rows; provider configuration, job credentials, schedules, service settings and frontend artifact are unchanged. Live Sync Dashboard renders API Proxy Online and 29 job entries, with no captured console errors. No sync, recomputation, seed or other maintenance action was triggered. Production and QA HTTP/API health PASS. Recovery: `backup/api-before-phase6-admin-20260918`, `api-admin-backup-20260918T072624Z`. The full private backup is preserved locally and on the existing server.

These row counts are per-deployment snapshots. Intervening records existed before this release; no cause is attributed and accounting follow-up remains frozen.

## RCM contact-record identity and office boundary — deployed

Source `209d518538390c1384e2c9505993be80d38f3bc1` applied at 2026-09-18T07:43:24.066901+00:00; main SHA256 `734a190e8f5558fe103e25186e9f960da33c77c7713e6034ae3a14440c709372`. Four manual-contact routes now verify the current account, Statements permission and actual office scope. Created actor/name and office name cannot be forged. Updates bind to the existing record's checked office; request filters are encoded. Nullable legacy office records remain editable only by all-office users. No delivery functionality changed.

149 native tests and 17 retained suites PASS; isolated QA Super Admin/Office Manager/Regional Manager identity resolution and invalid-session checks PASS. Inactive/unapproved QA sessions were expired, so live negatives were not rerun; native negatives remain covered. All 20,870 fresh guarded original rows and configuration/jobs are preserved; the production contact-attempt table remained empty. Candidate and production missing/invalid 401 and job 403 probes PASS, existing payroll validator 200. Live Patient AR Follow-Up rendered 30 rows with no contact-summary warning/error. Positive creates/edits used synthetic native storage only; zero real contact records or provider actions were performed. Production/QA health PASS.

Recovery: `backup/api-before-phase6-contacts-20260918`, `api-contact-backup-20260918T074308Z`. Private backups are preserved locally and on the server. Final main integration remains pending the remaining route review and regression.

## Huddle/EOD read and record-office boundary — deployed

Source `1456c8684f955bb359b21a4d9b56e33b6611a858` applied at 2026-09-18T08:08:51.798392+00:00; main SHA256 `242ced3002edd136a68548e5448454fb53d6586bd2f364e4ffe6821a4380cb11`. Six read route declarations now verify current identity, existing page permissions and the actual office selector. Completion preserves existing KPI/Reports consumers. Contact history checks the stored queue office before fetching contacts; assignees require active, approved accounts. Explicit false role permissions override relevant existing fallback grants. No execution or sync capability was added.

164 native tests and 17 retained backend suites PASS under network/business-data guards; 21 unrelated materialized files and all unrelated route bodies are unchanged. Candidate/live missing or invalid identities return 401 and read-only jobs return 403. The existing payroll validator remains 200. All 78,146 fresh guarded original rows are preserved, including 6,476 treatment queue and 50,798 procedure rows. Source/config/job/frontend checks and production/QA health PASS. Signed-in production KPIs, including Treatment Acceptance Rate, render with no captured errors. No Huddle initialization, real submission, workflow execution, provider action or accounting correction was performed.

Recovery: `backup/api-before-phase6-workflow-20260918`, `api-workflow-backup-20260918T080821Z`. Private rollback evidence exists locally and on the server. Remaining route review and final main integration are pending.

## Legacy Amazon request identity/office boundary — deployed

Source `34e9f2f008dad5bccdd2ed0c75ff8f3ee8c16c59` applied at 2026-09-18T08:27:00.919486+00:00; main SHA256 `00c18f7187717386f51c1d11af0d9dbd54047e82d202f6ebd505a2e7d5a83457`. Five request/history route declarations now verify current human identity and existing request/page/review grants. Creation binds actor and canonical office. Review requires Regional Manager/Admin/Super Admin, pending state, the stored office and no self-review. Conditional updates guard concurrent office/requester/state changes. Read filters are encoded. Existing schema fields replace the previously nonexistent reviewer columns; rejection attribution is in the existing service journal, not a newly claimed database/UI audit trail.

177 native tests and 17 retained backend suites PASS under network/business-data guards; 23 unrelated materialized files and all unrelated route bodies are unchanged. Candidate/live missing or invalid identities return 401; read-only job credentials return 403. The existing payroll validator remains 200. All 78,277 fresh guarded original rows are preserved, including zero legacy order requests and 129 order-history records. RLS on the request table remains enabled with no ordinary policies. No schema/policy, provider/config/job/frontend change was needed. Production/QA health PASS. The signed-in Front Desk Amazon Order History view displays 129 records with no captured errors; its existing Supabase client is unchanged.

No real order, request, approval, rejection, cart, purchase, provider authorization or sync was executed. Cart/purchase/sync/OAuth APIs remain separate pending groups. Recovery: `backup/api-before-phase6-orders-20260918`, `api-order-backup-20260918T082630Z`. The private backup is preserved locally and on the server. Phase 6 and main integration remain in progress.

## Directory, patient and appointment read boundary — deployed

Source `c255989905a562e295ce0ed7fc64963716dc323c` applied at 2026-09-18T08:52:18.592198+00:00; main SHA256 `2f95be52354db8cdb47a960fbecce8ef3dce0d1742232738f4cf7bf19dfaa72b`. Eight route declarations now verify current human identity and their existing page/admin grants. Reference directories remain available to active approved signed-in pickers. Aggregate reads enforce actual office selectors, including supported CSV selections, and respect explicit disabled permissions. Raw patient/appointment lists and unscoped provider schedules require existing all-office administrative read authority.

The patient-service fallback reproduced returning a foreign-office synthetic record. The targeted repair filters mapped records before response limiting/cache; the SQLite path and unrelated service/route bodies remain unchanged. Existing bounded provider fetch limits are not increased. No real provider call was used in reproduction or tests.

194 native tests and 17 retained suites PASS with zero network/business-data guard attempts. The actual call-site inventory confirms none of the eight routes has an existing unattended caller; no job scope changed. Candidate/live missing or invalid identity requests return 401, read-only job credentials return 403, and the existing payroll validator remains 200. All 78,279 guarded business/audit rows and 83,957 original SQLite clinical/reference rows are preserved. No schema, configuration, job, provider-connection or frontend change. Production/QA health PASS.

The signed-in production KPI page renders its patient, appointment and treatment summary labels with no captured errors or alerts. This is read-only UI verification; no patient detail, workflow, provider sync or financial write was executed. Recovery: `backup/api-before-phase6-clinical-reads-20260918`, `api-clinical-read-backup-20260918T085142Z`; private backup preserved locally and on the server. Phase 6 and main integration remain in progress.

## Legacy goal and EOD maintenance boundary — deployed

Source `288fdf7dc9feff34685ee169acef872ca5e1d7d5` applied at 2026-09-18T09:12:02.345983+00:00; main SHA256 `c3e8cce7e212b3d56e043e98cab682745ed402346f646074edb467286d90b333`. POST legacy goals now requires current active approved Super Admin/all-office authority, matching Management. Backend-only EOD queue sync requires Super Admin or Admin with the existing Sync grant and all-office authority. Ordinary EOD viewers and read-only job identities cannot execute either operation. Existing goal GET, ordinary EOD reads and every route body remain unchanged.

207 native API tests, 17 retained backend suites and 13 materializer tests PASS. The first local materializer attempt could not access its private temporary folders under the sandbox; the same tests passed with the required local access. The native suites recorded zero blocked network/business-data attempts. All 25 unrelated materialized files are unchanged. Candidate/live missing/invalid requests return 401 and existing read-only job identities return 403. Payroll validator remains 200. No real goal write or queue synchronization was executed; production mutation probes used only denied identities, an empty goal body and dry_run=true.

All 78,445 guarded original business/audit rows, including 36 legacy goals and 128 office goals, and all 83,957 original SQLite clinical/reference rows are preserved. No schema, provider/config/job/frontend change. Production/QA health PASS. The signed-in Sync Dashboard renders 29 jobs with no captured errors/alerts; no job was triggered. Recovery: `backup/api-before-phase6-maintenance-20260918`, `api-maintenance-backup-20260918T091128Z`. Private rollback copy preserved locally and remotely. Phase 6 and main integration remain in progress.

## Legacy status readers — deployed

Source `0b108413241076358123eb0e4e1e87197c132ffb` applied at 2026-09-18T12:30:15.853167+00:00. Three entries in the existing administrative policy now protect Sync status, Supabase table status and Gusto import status. There is no current frontend/scheduled consumer requiring anonymous access. All-office Admin/Super Admin or the exact existing Sync/Data Health page grant is required. Public health and static Compliance responses remain unchanged. Main source SHA256 remains `681aa6a12f0b9b7fbef6e914d47b82bf441dbbfa0a3fd7f4e48af1923a9b3cce`; no handler or calculation changed.

271 guarded native tests and 13 materializer tests PASS. All 17 retained backend suites from the immediately preceding Expense candidate passed; their main/service inputs are byte-identical. All 30 other materialized files are unchanged. Live missing/invalid identities return 401, job access to these routes returns 403, and existing Summary/Payroll reads remain 200 with unchanged Summary data. All 78,473 original guarded Supabase rows and 83,962 SQLite rows are preserved. Current credentials, job scopes, configuration, frontend and provider connections are unchanged. Production/QA/API health PASS. Signed-in Expense reloads without alerts, warnings or captured browser errors. Positive status-handler tests were synthetic because no active UI uses these legacy paths.

Recovery: `backup/api-before-phase6-status-reads-20260918`, `api-status-read-backup-20260918T122943Z`. Private recovery files remain server-side. Do not restore the revoked reconciliation credential. RCM/financial/provider route review, final regression and canonical-main integration remain pending; Phase 6 is not complete.

## Expense read boundary and query encoding — deployed

Source `d5c6da689852e41eaa3087d42ef274a7e654bdda` applied at 2026-09-18T12:16:35.660036+00:00; main SHA256 `681aa6a12f0b9b7fbef6e914d47b82bf441dbbfa0a3fd7f4e48af1923a9b3cce`. Seven existing Expense GET routes require a current approved human, all-office authority and their parent/child page grants. All-office authority is required because existing Summary/Payroll/Filters/Wells responses contain global components or metadata; no report filter is misrepresented as isolation. Current Regional Manager Overview dependencies remain available. Calculations, classifications, posted/archive rules and records are unchanged.

A synthetic actual-handler test reproduced malformed-date fragments removing a later office selector and an ampersand splitting a department value. Sixty interpolated filter values in five handlers now use literal URL encoding. Canonical AST preservation verified that only encoding and access-boundary plumbing changed. No malformed request was sent to production.

267 guarded native tests, 17 retained backend suites and 13 materializer tests PASS. The existing reconciliation-validator gained only its already-used `GET /v2/expenses/summary` route, retaining its current credential and expiry. Its dispatcher compatibility and unchanged response passed before the human gate activated. Other job identities/helpers remain unchanged. All seven missing identities return 401; off-scope reads and job writes return 403; permitted Summary and Payroll reads remain 200. The same-period Summary result is unchanged. All 78,471 guarded original Supabase rows and 83,961 SQLite rows are preserved. Production, QA and QA API health PASS. Frontend/provider configuration and the frozen accounting register remain unchanged.

Live signed-in Expense (This Year / All Offices) reloads without alerts, permission/load warnings or captured console errors. Filters and Overview render. Live positives used Super Admin; restricted/other roles were tested synthetically. No provider, export, financial, clinical or approval action occurred.

Recovery: `backup/api-before-phase6-expense-reads-20260918`, `api-expense-read-backup-20260918T121559Z`. Private backup files stay on the server. Restore only the freshly captured current job configuration; never reinstate the previously revoked credential. Remaining API review, final regression and canonical-main integration are still open.

## Metric and legacy helper read boundary — deployed

Source `749d8ee3900c25169f7c59e467f764665c91329b` applied at 2026-09-18T11:37:25.643504+00:00; main SHA256 `bbfa92220cdc8ca29592393b69ea84dffa1943ea39a1eaf9bc6b60b9f6c789a0`. Eight remaining metric/helper reads now require current human identity and their existing page/office authority. KPI hygiene and the provider alias retain actual scoped readers; Finance filter options validate the numeric multi-location parameter the handler consumes. Provider-email access follows existing compensation authority. Raw legacy diagnostics without a current frontend/job caller require the existing all-office administrative reader. Startup's stream reference is echo-only. No new background-job scope was granted.

253 guarded native tests, 17 retained backend suites and 13 materializer tests PASS. The original shared-key-only bypass was reproduced in three actual handlers using synthetic data. All route bodies and 27 unrelated materialized files are unchanged. Candidate/live missing identities return 401 on all eight routes; unattended job reads are denied 403. Existing scoped summary/payroll reads remain 200, summary content is unchanged and job writes remain 403. All 78,465 guarded original business/audit rows and 83,957 SQLite rows are preserved. Provider/configuration/job/frontend checks and production/QA HTTP/API health PASS.

Live signed-in KPI Main and Specialty views and Financial Analytics render without unavailable/permission warnings, alerts or captured console errors. Live positive checks used the existing Super Admin session. Raw legacy reads and provider-email lookup were not exercised against real records; their positive/negative cases passed natively. No provider sync, export, email, purchase, approval, clinical write or financial correction was executed.

Recovery: `backup/api-before-phase6-metric-reads-20260918`, `api-metric-read-backup-20260918T113657Z`. Private source/configuration recovery files remain on the server. Do not restore the revoked reconciliation-validator credential from an older backup. Remaining financial/RCM/provider route review, final regression and normal main integration are still pending.

## Core aggregate read identity and office boundary — deployed

Source `14933358e819deb11559daa1703f23aa7a0ea427` applied at 2026-09-18T11:03:00.050385+00:00; main SHA256 `23f8ec28eb5e2c63dadea80cf34bf97a7f32c2d4c8ee8bf1b800675073aa3eb4`. Sixteen aggregate GET routes now require current human identity, actual page grants and the office selector used by the handler. Global-only handlers require all-office authority; unknown/conflicting selectors fail closed. Existing exact GET-only job identities and expiry remain unchanged. Goal writes retain their separate maintenance policy. No calculation body, schema, business rule or provider connection changed.

237 guarded native tests, 17 retained backend suites and materializer verification PASS. All route bodies and 26 unrelated materialized files are unchanged. Candidate and public production missing-identity checks return 401 on all 16 reads; invalid identity returns 401, approved scoped validator summary and payroll reads return 200, and job writes return 403. The saved summary result is unchanged. All 78,455 guarded original business/audit rows and 83,957 original SQLite rows are preserved; current configuration, credentials, jobs and frontend remain unchanged. Production and QA HTTP/API health PASS.

Signed-in production Expense (including Last Month / Eatontown and five unchanged displayed ratios), KPIs, Executive Overview, Financial Reports and RCM pass read-only UI checks with no captured console errors or alerts. RCM source status shows September 18 and an available payment breakdown. Live human checks used the existing Super Admin session; other role/office positives and negatives used synthetic native identities. No real report export, workflow action, provider sync, email or financial correction was executed.

Recovery: `backup/api-before-phase6-core-reads-20260918`, `api-core-read-backup-20260918T110234Z`. Private source/configuration recovery files remain server-side; never reinstate the revoked reconciliation-validator credential. Automatic approval review initially rejected activation for unclear scope; the same action was approved after the exact existing user authorization and test evidence were supplied. No extra user approval or workaround was used. Remaining route review, final regression and normal main integration remain pending.

## Existing validator read compatibility — deployed

Source `471290102ae1c28bcd08170529cbc97adcfdbb10` applied at 2026-09-18T10:13:00.519802+00:00. The existing dashboard and reconciliation validators now have only their reviewed additional GET routes; the existing data validator has its own separate exact read-only identity. Schedules, provider configuration, calculation logic and human access are unchanged. All application route bodies and 27 unrelated materialized files match the preceding release.

220 native identity/framework/helper tests and 13 materializer checks PASS. The 17 retained business suites are reused from the identical maintenance implementation, not claimed as rerun. Three live validator reads return 200 with unchanged responses; off-scope reads and writes return 403. No full job, provider action, financial write or schema change was executed. All 78,449 guarded original rows and 83,957 SQLite rows are preserved. Production/QA health PASS; current frontend remains `08f84700-056f-4af4-8f13-526a66ad8187`.

A release-script variable collision exposed the existing reconciliation-validator credential in tool output. It was replaced privately; the prior token now returns 401, the replacement read returns 200 and off-scope/write attempts return 403. Its routes and December 16 expiry are unchanged. Other job credentials are unchanged. Receipt handling was repaired and private original evidence preserved. Never reinstate the exposed credential when restoring an earlier configuration snapshot.

Recovery: `backup/api-before-phase6-core-jobs-20260918`, `api-core-jobs-backup-20260918T100733Z`, plus the equivalent-rotation record `core-job-equivalent-rotation-20260918T101520Z`. Source and private configuration backups remain on the server. Only the sanitized receipt is copied locally; automatic approval review rejected local transfer of credential-bearing recovery files. The human core-read gate is the next separate candidate; Phase 6 and main integration remain in progress.

## Applied signed provider-webhook boundary

Plaid callbacks now require a valid provider signature, age/body check and existing item before dispatch. Source `bad155018f53baaf129f0f8681481bea62b6b634` is deployed, 124 native tests and 17 retained suites PASS; connection files and all fresh guarded rows are preserved. Live probes trigger no provider activity. See [webhook evidence](API-PLAID-WEBHOOK.md). Other callback and read/office/job reviews remain open.

## Applied OTP administrative restriction

OTP administrative helpers now require the current active/approved account as well as its existing role. One-file source `78cdc3c1994ac27dd3ac177abf1fd434984a8f06` is live, 99 native tests PASS, and all guarded device/settings/audit rows are unchanged. See [OTP evidence](API-OTP-ADMIN.md).

## Applied provider-compensation follow-on

The three compensation routes now bind access to the verified account and existing grants/email allowlist. Source `a0454b2e243cce5be407bf8e900df1e066ffb61c` is live; 88 native tests, 17 retained suites and live denial/health checks PASS. See [compensation evidence](API-COMPENSATION.md). MCP mounted transport is already protected by its existing downstream dedicated-token verifier (local 401/proxy 403 without a valid token); no Collaboration Platform change. Remaining API review continues.

## Applied report-export follow-on

The verified report-export identity repair is now live from `fa1730c752c4f26956c4d79b21e025e035a69f55`. 75 native tests and 17 retained suites PASS; body identity is ignored, verified attribution is used, jobs are denied, internal reads forward the human identity, and original business/audit rows are unchanged. See [report-export evidence](API-REPORT-EXPORT.md). Remaining route review is still open.

## First bounded candidate (preserved payroll release record)

Eight existing GET endpoints under `/v2/payroll/`: runs, contractors, employees, expense-facts, comparison, mappings, crosswalk and summary. Their existing calculation, filtering and data-reader functions remain unchanged. The existing shared application-key check remains, with an additional authoritative identity/permission check.

Human identity is verified through the configured Supabase Auth service, followed by the current active/approved profile, real role enum, role permission rows and office assignments. Super Admin retains its existing override. Other users require the existing relevant page/tab permission. These payroll result sets contain information across offices; an office query parameter is not accepted as proof that an endpoint actually filters its results. The candidate requires existing all-office scope for these reads. No currently enabled production role loses legitimate payroll access under the captured matrix.

The contractor overview grant applies only to its existing summary-only response. Parent payroll page access alone does not grant every child dataset.

Two existing validator helpers need credentials when these endpoints are enforced:

| Existing job | Reviewed read routes | Scope |
| --- | --- | --- |
| `validate_dashboard.py` | payroll/runs, payroll/employees, payroll/crosswalk | Current all-office validation |
| `validate_reconciliation.py` | payroll/runs | Current all-office validation |

Each job gets a different high-entropy token. The server keeps only token hashes and exact GET routes, office scope, enablement and expiry. The existing validator keeps its own credential in a private file. Neither credential enters the frontend, Git, logs or chat. A job token is denied on unrelated paths, including older routes, and cannot be used for provider execution or writes. Validator redirects are rejected so the credential cannot follow a redirect to another destination.

No scheduled validator has been executed for this work. The unchanged shared application key, provider credentials and normal schedules are preserved.

## Verification and limits

- 52 local identity, permission, job-scope, integrated dependency and redirect checks PASS.
- Live isolated QA identity resolution PASS for existing synthetic Super Admin, Office Manager and Regional Manager; invalid session rejected. No business endpoint calls or fixture changes. Inactive/unapproved live sessions were expired, so those live negative cases were not repeated; local identity and retained native SQL negative coverage remain explicit.
- Candidate source materialization PASS (19 files); 13 materializer tests PASS. All 58 native Python/FastAPI cases PASS with network/business-data guard active, no blocked attempts. All 17 retained backend suites PASS after adapting five isolated test harnesses to the new Request/identity context; all prior assertions retained, originals untouched.
- Both existing API services passed the deployed checks: missing application key, absent user session and invalid session return 401; each separate validator identity receives only its approved empty-result read; out-of-scope reads are denied. No write requests or scheduled jobs were executed. The existing runtime environment file, provider configuration and frontend asset remain unchanged.
- Validator credentials expire on 2026-12-16 at 22:55 UTC. Renew the two private credentials through the same reviewed scope before that date; do not remove expiration or broaden route grants. The hash registry and credential files remain private and outside Git. Backup tag `backup/api-before-phase6-payroll-20260917` and private source/config backup `api-payroll-backup-20260917T225503Z` preserve the prior state.
- This is not a claim that every Dashboard API route has complete role/office authorization. Remaining route groups still need their own caller and scope review. Source inspection found shared-key routes and additional handler patterns; counts of shared-key declarations alone do not prove the status of every route.
- Report export makes internal API calls. A later general identity rollout must forward the initiating user's verified identity and preserve office scope. The subsequent report-export batch implements this transport; provider callbacks remain under review.
- Existing read-only cache warming targets RCM endpoints; it is unaffected by this bounded payroll batch. No startup sync, migrations, provider execution or financial source mutation is authorized by this release.

## RCM snapshot and eAssist read boundary — deployed

API source `91cb7ab8b9c45c359d1fdc6513480007f1c72278` applied at 2026-09-18T13:31:39.774530+00:00; main SHA256 `21b7b3b958394af37d14b127f22ba36161a95d3a19930ed1c04d8cf68fb0d188`. Six GET routes require current human RCM/administrative authority and actual office scope. Office-scoped legacy snapshots no longer disclose company totals or reconciliation metadata; all-office calculations and values are preserved. eAssist literal query encoding prevents date fragments dropping later scope filters. Scoped status queries read only the requested office and skip global logs/staging counts. No job grant, credential, schedule, provider configuration, schema or financial source change.

283 guarded native tests, all 17 retained suites and 13 materializer tests PASS. The old pagination harness's six unchanged tests passed with the new synthetic request/query context; the original failure remains preserved. Other route bodies and 29 materialized files are unchanged. Live missing/invalid identities return 401, unrelated jobs return 403, existing Summary/Payroll reads remain 200 and the saved Summary is unchanged.

All 79,171 original guarded Supabase rows and 83,970 SQLite rows are preserved. Production/QA/API health PASS. Signed-in Super Admin eAssist / Brick renders without visible access failures, alerts or captured console errors. Other role/office positives and negatives, and legacy snapshot positive behavior, were tested with synthetic native handlers. The bounded journal query contained no matching access entry; no transport-log claim is made. No business/provider action was executed.

Recovery: `backup/api-before-phase6-rcm-snapshots-20260918`, `api-rcm-snapshot-backup-20260918T133108Z`. Private backups stay server-side; never restore the revoked reconciliation credential. Remaining RCM/financial/provider route review, final regression and canonical-main integration remain pending. Phase 6 is NOT complete.

## Independent financial and RCM read boundary — deployed

Source `ab7d6a1fa1f9be5ba1e62ec20b944be84cc12d85` applied at 2026-09-18T14:09:31.452282+00:00; API main SHA256 `cc058c5e9b4dc86d3fb0cb0ad3f3d887f58c3a57eac908550c372f4f53da8eb5`. Twenty-three GET readers require current human identity, their existing page grants and the actual office selector. Unknown/conflicting/ignored selectors fail closed. Existing RCM Dashboard, Operations A/R/Payors and Executive Overview dependencies are preserved. Legacy extra field keys cannot elevate a non-Super-Admin or a job. REST literal encoding preserves Marketing/outreach scope; office-scoped statements withhold the company-wide total. Financial calculation ASTs, source records and posted/archive rules are unchanged.

304 guarded native tests, 17 retained backend suites and 13 materializer tests PASS. A local rerun initially hit Windows sandbox temporary-directory permissions; the unchanged suite passed with normal filesystem access. Retained v1/v2 main and service bytes are identical. Other main functions and 28 materialized files are unchanged.

Existing three validator credentials and expiries are preserved; only their already-used exact financial GET scopes were added. A separate cache-prewarmer identity is bound to its two existing loopback reads. Real credential validation passed with synthetic downstream handlers; no complete job was run. Missing/invalid identities return 401, off-scope jobs and writes return 403. Live same-period Summary and RCM Dashboard responses are unchanged; Payroll compatibility remains 200.

All 79,171 guarded original Supabase rows and 83,983 original SQLite rows are preserved. Production/QA/API HTTP health PASS. Live signed-in RCM Dashboard / Brick / Last Month renders all six major panels with no alert, access failure, loading state or captured console error. Restricted/other-role positives and negatives were verified synthetically. Frontend deployments, provider configuration, financial records, schemas and schedules are unchanged.

**Pending integration decision:** `/v2/rcm/ar-aging-official` and `/v2/rcm/ar-location-health` human gates remain inactive because the existing Collaboration API caches its daily-report helper and restarting it immediately ticks its scheduler. Dr. G has been asked whether to defer those two gates to a planned restart or allow restart and normal scheduled work. No Collaboration source, credential, process or scheduler was changed. The proposed source adapter is prepared only.

Recovery: `backup/api-before-phase6-financial-reads-20260918`, `api-financial-read-backup-20260918T140856Z`. Private backups stay server-side; preserve current credential generation and never restore the revoked reconciliation token. The provider declarations are now dispositioned by the later provider release; the two report-dependent gates remain pending. Phase 6 is NOT complete; accounting follow-up remains frozen.
