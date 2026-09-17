# API identity rollout — in progress

Dr. G approved existing signed-in user checks plus separate restricted identities for approved background jobs. No API authentication changes have been deployed yet.

The confirmed defect is that a payroll read accepted the shared application key with no user session or an invalid session. The application key identifies the client application; it must not establish the person's identity.

## First bounded candidate

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
- Candidate source materialization PASS (19 files); 13 materializer tests PASS. All 58 native Python/FastAPI cases PASS with network/business-data guard active, no blocked attempts. All 17 retained backend suites PASS after adapting five isolated test harnesses to the new Request/identity context; all prior assertions retained, originals untouched. Private job provisioning, production rollout and live payroll verification remain separate release gates.
- This is not a claim that every Dashboard API route has complete role/office authorization. Remaining route groups still need their own caller and scope review. Source inspection found shared-key routes and additional handler patterns; counts of shared-key declarations alone do not prove the status of every route.
- Report export makes internal API calls. A later general identity rollout must forward the initiating user's verified identity and preserve office scope. Current payroll batch does not change report-export routes or provider callbacks.
- Existing read-only cache warming targets RCM endpoints; it is unaffected by this bounded payroll batch. No startup sync, migrations, provider execution or financial source mutation is authorized by this release.
