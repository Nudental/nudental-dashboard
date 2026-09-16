# Isolated Dashboard QA

Current status, September 16, supersedes historical preparation notes below.
The existing $10/month NU-Dashboard-Staging-QA Supabase project
`hvtxjfayenqnwtaisoaw` is live; no additional project or subscription is needed.

The [QA frontend](https://nudashboard-qa.pages.dev) and
[QA API](https://nudashboard-qa-api.nuholdingllc.com/health) are isolated from
production and Collaboration Platform. Twelve synthetic identities cover all
eight actual roles plus account/office variants. Three API routes are positively
reviewed (office read, EOD read, synthetic Patient Flow export); other operational
routes remain closed. Closed-route denials are not positive workflow coverage.

QA schema repairs 001–031 and 033 are applied; 032 and 034 are pending approval. Latest QA frontend release
`46e07c2d-fc18-4e17-8847-3c3cfec21a65` uses source
`601c70a830bfe61e9b4260062bc6a8fc94d0e6fb`. All 1,452 retained frontend tests
pass, zero skipped; 17 hosted deployment/isolation checks pass. No production
publication performed. Canonical main remains `61c224b1bf9ec53d91ab69a8eb00e563204bf76d`.

Recent live checks/repairs: [office assignment](user-office-transaction-validation-20260915.md),
[office administration](office-ui-validation-20260915.md),
[providers](provider-ui-validation-20260915.md),
[cost drivers](cost-driver-toggle-validation-20260915.md), and
[service/vendor categories](service-category-toggle-validation-20260915.md), and
[monthly goals and goal office access](office-goal-validation-20260915.md), and
[single responsive page mount](single-layout-validation-20260915.md), and
[insurance appointment validation](insurance-request-time-validation-20260915.md),
[insurance API scope](insurance-access-validation-20260915.md), and
[private verification PDFs](insurance-pdf-storage-validation-20260915.md), and
[stale Huddle review actions](huddle-review-state-validation-20260915.md).
Temporary records from completed administration, goals and implant/import checks
and the insurance request/draft/PDF are cleaned; audit evidence retained. Original
Huddle/EOD/task fixtures are also cleaned after their retained checks. Evidence and
general audit rows remain; old fixture-dependent helpers need fresh fixtures before reuse.

Phase 5 is incomplete. Continue service-goal generation, remaining safe write/role
checks, operational mock integration, bounded performance investigation, final
production read-only regression, and cleanup. The previously presented Expense
accounting-owner decision remains pending; other work continues independently.
Browser and server access currently work. Camera access was not granted and is
not needed; use manual inventory entry.

Bone/Tissue [manual camera-free entry](bone-manual-entry-validation-20260915.md),
[optional-field saves](bone-optional-fields-validation-20260915.md), and
[active-account/audit scope](bone-access-validation-20260915.md) are repaired and
verified live in QA. Calendar-date formatting, single stock deduction, active
stock-role checks and audit-preserving deletion are also live verified. The
temporary Bone/Tissue inventory and stock records are cleaned; seven audit
events are retained. Attachments/imports and other inventory modules remain.
The [supply office selectors](supply-qa-offices-validation-20260915.md) now use
the two synthetic offices in QA; production options are unchanged.
Custom supply draft create/edit now accepts empty optional catalog selections;
one synthetic draft/item remains for the ongoing permissions/workflow checks.
The QA-only [transactional draft save](supply-draft-transaction-validation-20260915.md)
now preserves atomicity and audit history; unchanged saves produce no duplicates.
Production's existing save path has not been changed to depend on this QA RPC.
Clinical submission is live verified with durable simulated email/SMS intents;
no provider is contacted. Review/fulfillment and Front Desk ordinary-role UI
coverage remain in progress, with one labeled Office A request retained.
The [manual fulfillment optional-field save](supply-fulfillment-optional-validation-20260915.md)
is live verified after refresh. Its [access boundary](supply-fulfillment-access-validation-20260915.md)
now passes the live role/read/write checks. Its [transactional audit history](supply-fulfillment-audit-validation-20260915.md)
also passes live lifecycle/scope checks; both temporary fulfillment records are
cleaned, with four audit events retained.
The manual fulfillment [default date](supply-fulfillment-date-validation-20260915.md)
now follows the user's local calendar day, verified live in the evening.
The [Received By selector](supply-fulfillment-recipient-validation-20260915.md)
also saves a real user ID and passes live persistence/audit checks. Its temporary
fixture is cleaned, preserving two more audit events.
The [standalone manual receipt](supply-receipt-persistence-validation-20260915.md)
now persists its count/date/actor/status instead of reporting success after a
failed write. Its completed synthetic fixture is cleaned with three audit events
retained. Linked stock, multi-item and offline receipt paths remain unverified.
The [Front Desk synthetic office enum](front-desk-offices-validation-20260916.md)
now accepts the two QA office names; 23 focused database and 64 installation
checks pass. The ordinary Office Manager request submission and catalog
lifecycle are in progress. Two labeled supply requests and one catalog item
remain for these checks; cleanup is still owed.
The [Current Inventory office columns](front-desk-current-offices-validation-20260916.md)
now display QA quantities correctly after refresh. Browser CSV file-save remains
unverified. [Office Manager submission](front-desk-submission-validation-20260916.md)
passes persistence, audit, scope and simulated notification checks; its review
business rule needs clarification. Tested migration 032 remains unapplied while
explicit approval for the catalog access restriction is pending.
The [catalog audit trigger](front-desk-catalog-audit-validation-20260916.md)
passes live create/edit/replay/delete checks. Its separate temporary fixture is
cleaned and three audit events are retained; the five-unit access-test fixture
remains (now six units). All 68 candidate installation checks pass; this does not mean pending
migration 032 has been applied.
The [catalog summary counters](front-desk-summary-validation-20260916.md) now
refresh after saves while preserving the open category. Live quantity/create
and full-refresh checks pass. The extra creation-counter fixture is cleaned,
preserving two audit events. Production is unchanged.
The [optional catalog date](front-desk-optional-date-validation-20260916.md)
now allows a note edit with Last Supplied blank. Live save/audit/retry/refresh
checks pass. The retained six-unit fixture now has six real update audits; its
earlier unaudited creation is not retroactively fabricated.
## Historical preparation record

The following notes preserve conditions at initial preparation, not current
provisioning or billing requirements.

Canonical main:61c224b1bf9ec53d91ab69a8eb00e563204bf76d.
Original reconciliation:909edf99ec2454801a5add8f63b23440ce5f6f44.
Application source baseline:5f052fd47d68d581090163cc888c9614d82d2090.
This worktree is feature/nudental-dashboard-qa-phase5. It is not deployed.

## Initial resource approval request — resolved September 14

QA-DB-001: The NU Dental Supabase organization has only the production Dashboard
project and the Collaboration QA project. Neither may be reused for Dashboard
QA. The prepared new project is NU-Dashboard-Staging-QA, Micro, additional
$10/month confirmed on the creation form. Approval was requested; no project
has been created. No stored database password was reused or printed.

## Available preparation

- Planned frontend:nudashboard-qa.pages.dev. Both Pages inventory pages checked;
  no existing project with that name. No hosting resource created yet.
- Planned API:nudashboard-qa-api.nuholdingllc.com. Existing organization zone
  verified; no DNS record currently uses this name. No routing changed.
- Existing server has approximately4.8GiB available RAM and11.59GiB free disk;
  no Docker/Podman is installed. Existing services/ports remain unchanged.
- Twenty-five API literals in21 source files now use the environment-selected
  API origin. Supabase initialization validates the same environment first.
  Other provider/Rocket connections must still be mocked or disabled before
  live QA. The QA-only banner and restrictive response headers are wired in.
- Source migrations declare6 roles, but read-only PostgreSQL catalog queries
  confirm8 live roles:super_admin, admin, regional_manager,
  regional_clinical_manager, office_manager, staff, insurance_verifier and
  marketing. Do not invent provider/read-only roles. Test restricted permission
  combinations under the roles the application actually supports.
- The live public schema has219 tables,13 views/materialized views,
  112 functions/procedures and382 policies. Only catalog metadata was read;
  no business table rows were selected. The catalog export is now preserved
  privately:232 relations,4083 columns,718 constraints,831 indexes,112 functions,
  54 triggers,382 policies,13 views,40 enums and7 sequences. A supplement captures
  sequence ownership, schema/default grants,18 view dependencies and the auth
  user-creation trigger. No domain/range types or partitioned tables were found.
  Schema materialization and database validation remain pending. Two notification
  functions invoke outbound HTTP and require QA-only mock replacements.
- There are109 migration files;70 contain data writes. Do not run the migration
  history against QA. Capture structure only, inspect functions/triggers for
  external effects, then create explicitly synthetic fixtures.

Next: obtain the isolated project after approval; extract schema only; wire
frontend environment validation and QA API routing; deny production connection
origins; materialize a separate backend with synthetic configuration, restricted
filesystem/egress and mocked operational adapters; then test supported roles.

The27 environment/header tests pass. The first routing regression run had30
failures because5 retained isolated service harnesses did not supply the new
API-origin dependency. Their assertions were preserved; those34 affected tests
now pass using the actual production default from environmentPolicy.js.
The complete current suite passes1031/1031 with no skips, including the retained
production-artifact comparisons. The root test runner now defaults to the current
frontend parser installation, avoiding an undocumented older workspace path.

The first synthetic QA compile exposed10 hardcoded production API-key literals
in9 files plus a stale comment. They now use the existing environment input,
with no credential rotation or provider change. Eight focused configuration
tests pass. The second QA compile passes, and its entry contains neither of the
actual production client credentials checked privately. Entry SHA256:
d5075f9d544c38de910b87231291e281022834c135adccf03d296f7e5ea64487.
Both compile artifacts remain private and were never served or deployed.

The QA compile check uses synthetic placeholder configuration, marked
DO-NOT-DEPLOY. It is not a live database or live isolation/permission proof.
No business data has been copied and no QA action has been connected to an
operational provider. This worktree's node_modules is a development-only
junction to the clean reference dependency installation; never install through
that junction. Fresh checkouts use the documented setup command normally.

## Subsequent preparation and bounded production repair

The AmEx completeness repair PH5-EXP-001 is now deployed and live-verified.
Main was advanced normally after preservation of
backup/main-before-phase5-expense-repair-20260914. QA has merged that main;
only its release documentation needed an add/add merge resolution. The verified
release documentation was retained. This did not deploy the QA configuration.

The structure materializer build_schema.py is preparatory and never connects to
a database. Its candidate passes PostgreSQL17 grammar and catalog-count checks:
219 application tables,81 application functions,31 extension-owned functions
provided by pg_trgm,40 enums,7 sequences,382 policies and55 triggers including
the auth user trigger. The existing disabled EOD trigger remains disabled.
Only the two outbound notification bodies become QA execution-intent records.
No cron jobs, vault values, identities, sequence current values or business
records are copied. New-database execution and grant/default comparison remain
pending; offline syntax is not evidence of successful live schema cloning.

Role configuration was read separately without user profiles or business rows:
138 settings per role. Eight enum roles are supported; seven additional dormant
permission-role names are not valid application identities and will not be
created. Source-derived expected navigation and existing permission rules are
recorded privately. No QA identities exist yet. UI/API enforcement remains
unverified until the isolated runtime is available. user_profiles has no
provider-identity fields, so a separate provider role must not be invented.
