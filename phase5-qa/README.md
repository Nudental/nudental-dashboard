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
- Source has21 files referring to the production API, plus other production
  provider/Rocket links. They must be configured/blocked before any QA runtime
  or frontend starts. The new environment policy is not wired into the app yet.
- Source migrations declare6 roles:super_admin, admin, regional_manager,
  regional_clinical_manager, office_manager, staff. Live enum/schema validation
  remains necessary. Do not invent provider/read-only roles.
- There are109 migration files;70 contain data writes. Do not run the migration
  history against QA. Capture structure only, inspect functions/triggers for
  external effects, then create explicitly synthetic fixtures.

Next: obtain the isolated project after approval; extract schema only; wire
frontend environment validation and QA API routing; deny production connection
origins; materialize a separate backend with synthetic configuration, restricted
filesystem/egress and mocked operational adapters; then test supported roles.

The environment policy tests are preparatory unit checks, not live isolation
or permission proof. No business data has been copied and no QA action has
been connected to an operational provider.
