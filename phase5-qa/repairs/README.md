# Undeployed QA-only repair candidates

Run these only after the isolated Dashboard QA schema has been verified.
They require `nudashboard.environment=qa` and the `dashboard_qa` schema.
They are not part of any production deployment workflow.

| Candidate | Reproduced defect | Original offline result | Candidate result | Hosted QA |
| --- | --- | --- | --- | --- |
|001-profile-access-boundary.sql|Self-service privilege fields and untrusted signup role metadata|7 security expectations failed|14 checks pass, including persistence and audit readback|Pending|
|002-office-workflow-boundary.sql|Overlapping permissive Huddle rules bypass office/active-user restrictions; related task/checklist writes escape scope|11 of17 expectations failed|17 of17 pass|Pending|

The second candidate adds restrictive policies on Huddles, action items and
checklist items. This preserves the original role/assignee policies while adding
an active-profile and office-scope requirement to reads and both old/new write
values. Existing regional-manager all-office access remains supported through
the application's existing user_can_access_office function.

The original schema snapshot remains unchanged. Offline checks use
PostgreSQL18.3/PGlite with synthetic identities and a minimal auth schema;
Supabase Auth, PostgREST, live UI permissions and complete write workflows must
still be verified in the actual isolated Supabase environment.

Run `node test-office-workflows.cjs` from the parent directory to reproduce the
negative control, and add `--repair` to test the second candidate. All query
probes roll back; their containing in-memory database is closed afterward.
