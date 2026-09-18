# API identity rollout — in progress

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
