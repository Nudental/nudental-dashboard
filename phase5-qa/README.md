# Isolated Dashboard QA preparation

Canonical main/reconciliation:909edf99ec2454801a5add8f63b23440ce5f6f44.
Application source baseline:5f052fd47d68d581090163cc888c9614d82d2090.
This worktree is feature/nudental-dashboard-qa-phase5. It is not deployed.

## Pending resource approval

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
