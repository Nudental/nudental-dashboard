# Isolated Dashboard QA

Current status: [Phase 5 checkpoint — September 16](phase5-checkpoint-20260916.md).
That report supersedes the historical preparation notes below.

- The existing approved $10/month QA project is `hvtxjfayenqnwtaisoaw`.
- [QA frontend](https://nudashboard-qa.pages.dev): release
  `7e91a103-ef44-4f3a-a667-447e112e6997`, deployed source
  `be846c8dfbd6020be0d7b212df5e5e77b0078105`.
- [QA API](https://nudashboard-qa-api.nuholdingllc.com/health): isolated release
  `585313aa7a2c2f5ee8e4aeeabe0767f6a7a7d76f0a6ddcc2daf6302d6f06d012`.
- 12 synthetic identities, eight actual roles, two offices and two providers;
  public schema repairs 001–042 and the dedicated storage policies are applied.
- 1,630 frontend tests, 49 QA database suites and the latest retained 142 QA
  backend tests pass. Build/511-file parity, 20 hosted checks, 15 runtime checks,
  54 live photo checks and six served-artifact Expense overlap checks pass.
- The supported safe workflows are tested and cleaned. Reusable fixtures and
  audit history remain. The operational API remains deliberately incomplete:
  denied routes and execution-intent simulations are not real provider coverage.
- Canonical main remains `61c224b1bf9ec53d91ab69a8eb00e563204bf76d`.
  Production remains at `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`, read-only healthy.
- Phase 5 is not declared fully complete: Expense authority is resolved to
  reconciled bank/card statements plus processed Gusto, but statement matching
  and actual-benefit evidence await the location of the reconciled records.
- No further phase, Collaboration Platform work, production database changes,
  real provider execution or camera access is authorized by this checkpoint.

## Historical progress notes

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
business rule is now confirmed and live verified: Regional Manager/Admin review only,
no self-approval. Both Front Desk review fixtures are cleaned with seven audit entries retained.
Migration 032 is applied and its live scope checks pass.
The [catalog audit trigger](front-desk-catalog-audit-validation-20260916.md)
passes live create/edit/replay/delete checks. Its separate temporary fixture is
cleaned and three audit events are retained. The original six-unit access fixture is
also cleaned after migration 032 verification, preserving seven audit events.
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
