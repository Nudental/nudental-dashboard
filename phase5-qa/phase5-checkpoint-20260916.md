# Phase 5 checkpoint — September 16, 2026

This is the current status, superseding historical preparation notes. Phase 5
is not declared fully complete. The remaining accounting evidence is external;
the supported safe QA workflows have been exercised and cleaned. No Phase 6 or
Collaboration Platform work was started.

| Requested item | Verified status |
| --- | --- |
| Reconciled repository | `Nudental/nudental-dashboard` |
| Previous main | `e4a2e0944f74514f6ea98e5ea32eb140333b964f` |
| New canonical main | `61c224b1bf9ec53d91ab69a8eb00e563204bf76d`; normal fast-forward history, no force push |
| QA development branch | `feature/nudental-dashboard-qa-phase5`; latest deployed source `be846c8dfbd6020be0d7b212df5e5e77b0078105` |
| Production source reproducible | **PARTIAL for exact historical bytes; PASS for the documented deterministic source build and reviewed semantic reconciliation.** See [source closure](../phase5-reconciliation/source-closure.md). |
| Remaining source differences | Historical Rocket editor metadata (about 12.68 MB), minifier bindings/chunk names and module factoring are documented. These are not unexplained nondeterminism. Production's 21.74 MB historical artifact has not been replaced by the smaller full source build. |
| QA URL | https://nudashboard-qa.pages.dev — release `7e91a103-ef44-4f3a-a667-447e112e6997` |
| QA API | https://nudashboard-qa-api.nuholdingllc.com — isolated release `585313aa7a2c2f5ee8e4aeeabe0767f6a7a7d76f0a6ddcc2daf6302d6f06d012` |
| QA database/isolation | Existing approved $10/month project `hvtxjfayenqnwtaisoaw`; structure-only copy of 219 public tables, synthetic fixtures, dedicated API identity/runtime. No production business-data copy, vault/provider credentials, cron or network extension execution. |
| QA roles | 12 identities: staff, admin, super admin, office manager, regional manager, regional clinical manager, insurance verifier, marketing; office B and inactive/unapproved variants. Providers are synthetic entities, not an invented login role. |
| Permission testing | **PASS for the tested matrix; PARTIAL for the entire recovered API.** Public schema repairs 001–042, owner/account/office/page boundaries and private storage checks pass. Closed operational routes are denial evidence, not successful workflow coverage. |
| Safe write workflows | **PASS for the documented synthetic UI/API cases below; PARTIAL for unsupported/external operations.** This is not a claim that every production integration is enabled in QA. |
| Payments/claims/payroll sandbox | Ten execution-intent simulation types, 128 live lifecycle checks and 20 retained audit events. No payment posting, claims acceptance, payroll calculation or external delivery was performed. Full product UI integration with those adapters remains outside the verified coverage. |
| Expense accounting authority | Owner selected reconciled Wells Fargo/AmEx statements plus processed Gusto records. Enrollment estimates are not evidence of paid benefits. |
| Expense discrepancy | Authority is resolved; matching actual reconciled statements, archived AmEx entries, transfers and benefit payments remains blocked on their location/evidence. Private aggregate reconciliation is retained outside Git. No financial transactions or classifications changed. |
| Performance | [Bounded baseline](../phase5-reconciliation/performance-baseline.md): production entry 21,742,079 bytes; current QA entry 8,835,511 bytes. Eager imports and historical editor metadata dominate startup code. Native first paint, request waterfall and memory are not observable with the available browser controls. Tool-inclusive navigation time is not a native load-time measurement. |
| Performance repair | [Single responsive page mount](single-layout-validation-20260915.md) live-verified on QA desktop/mobile; eliminates duplicate route rendering. No production performance release or percentage speedup claim. |
| Tests | 1,630 frontend tests, zero skipped; 49 retained QA database suites; latest retained QA backend run 142 tests; source reconciliation retained 17 backend suites and 13 materializer checks. QA build and 511-file source parity pass. Latest hosted checks 20/20; runtime/identity/isolation checks 15/15; photo policy 54/54 live and 33/33 local. Six Expense overlap cases also pass against the exact served QA artifact. |
| Production deployment | Earlier in Phase 5, only the bounded [AmEx completeness repair](../phase5-reconciliation/PH5-EXP-001-summary-completeness.md) was released on September 14. No subsequent QA repair or full reconciled build has been deployed to production. |
| Production regression | **PASS:** existing deployment `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`, existing entry `index-a6a4e36b8660.js`; read-only Executive Overview refresh loads normally with no alerts. |
| Cleanup | No receipt has an outstanding cleanup-required flag. Completed disposable records, storage probes, profile photo and local upload/download files are removed; original profile and preferences restored. Reusable synthetic fixtures and audit history are preserved. |
| Remaining blocker | Locate the reconciled Wells Fargo/AmEx statements/report for January 1–September 14, 2026, including the evidence needed to match benefits and transfers. The authority choice itself does not need to be repeated. |
| Recommended next step | Resolve that evidence gap and review the QA changes and residual coverage before any production promotion. Do not infer release approval or begin another phase. |

## Safe workflow coverage

Each linked record distinguishes actual UI/API evidence, offline coverage,
earlier failed harness attempts, cleanup and limitations.

- Task creation/edit/status and scoped notifications: task-manager and
  notification validation records; original disposable fixtures cleaned.
- Huddle drafts, children, submission and approve/reject/retry races: retained
  Huddle validations and database tests; notification delivery simulated in QA.
- EOD drafts, attestation, submission, approval/rejection, review/reversal,
  history, office access and retries: retained EOD validations; history retained.
- User/office/provider administration, office assignment, categories, cost
  drivers and monthly goals: administration validations, scoped role checks and
  audit-preserving cleanup.
- Implant, bone/tissue and clinical stock: create/edit/receive/consume, date
  readback, quantities, imports, attachment/PDF rendering, export and scope checks.
  Camera was never granted or used. Native browser Save As is not claimed.
- Front Desk/Amazon/monthly supplies, receipts, fulfillment CSV and urgent
  requests: persistence, counters, duplicate/replay, audit and scoped access.
  Front Desk approval is Regional Manager/Admin only with no self-approval,
  matching the owner's decision. No actual orders or external notifications.
- Insurance request/draft/completion/cancellation and private verification PDFs:
  terminal-edit lock, prior-status audit and role/office checks; no real submission.
- Service goals: fixed synthetic baseline preview, 11-row generation, duplicate
  skipping, zero/missing distinctions, edits, office boundary and cleanup.
- [Daily import](daily-import-validation-20260916.md): preview/cancel, insert,
  upsert/repeat/readback, date and reconciliation fixes, five retained audits.
  This legacy import does not override official Dentrix totals. Unimplemented YTD
  totals are explicitly unavailable.
- [Account/profile](account-settings-validation-20260916.md) and
  [photos](profile-photo-validation-20260916.md): save/readback/theme/date fixes,
  attachment integrity, cancel/remove, 12-identity permissions and exact restore.
- [Local thresholds](local-threshold-validation-20260916.md): create/edit/toggle/
  cancel/delete/refresh; browser-local prototype only, no server audit or delivery.
- Reports/downloads and imported-entity review: safe synthetic outputs and
  permissions; one completed review metadata record intentionally retained.
- [Expense request isolation](../phase5-reconciliation/PH5-EXP-002-request-isolation.md):
  independently reproduced and repaired metadata sharing with six deterministic
  overlapping request cases. Live artifact replay passes; interactive production
  race timing and a certified accounting total are not claimed.

## Boundaries and recovery

`product_api_ready` remains false intentionally. Reviewed QA routes cover scoped
offices, EOD reads, synthetic Patient Flow export, two fixed service-goal baseline
queries and the separate execution-intent lifecycle. Existing invalid/unreviewed
route probes remain denied. Real provider sync, financial postings, payroll,
outreach, password/SMS delivery and operational integrations remain disabled.

QA setup is not a production security-policy release. The 42 public-schema
repairs and dedicated storage policies require deliberate production review;
none was applied to the production database. The approved profile-photo policy
preserves the source's active authenticated reads, owner writes and Super Admin
management in the synthetic QA project only.

All prior branches, annotated backup tags and deployment recovery points remain.
The earlier main is recoverable at
`backup/main-before-phase5-reconciliation-20260914`. The immediate prior QA
release is `3f7a8c68-5505-4101-8f88-130fa0bdd2d2`. The prior production release
`4f583195-5bef-4c51-9e45-de3cc73819d1` and its preserved artifact remain available.

Reusable clinical stock scenarios remain at 6/5/2 units with 14 history events;
see `reusable-clinical-fixtures-20260916.json`. The reviewed entity metadata and
cancelled simulated execution intents retain their audit lineage. These are
intentional QA fixtures/history, not abandoned cleanup.

## Expense evidence blocker

Read-only source checks found processed Gusto runs matching the stored payroll
aggregates, but no imported reconciled statement batch for the requested period.
Bank feed review flags do not prove statement reconciliation. Bounded local
Downloads/Documents filename checks and Google Drive metadata searches did not
locate the 2026 Wells Fargo/AmEx statements. No unrelated document was opened.

The single owner action needed is the existing folder, report or system location
of those reconciled records. Private aggregate evidence and the unresolved
reimbursement/benefit/archive reconciliation are preserved in
`Expense-source-reconciliation-20260914.md` outside Git. No total has been chosen
merely to match the UI, and no production financial record was modified.
