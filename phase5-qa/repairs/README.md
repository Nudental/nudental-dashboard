# QA-only database repairs

Run these only after the isolated Dashboard QA schema has been verified.
They require `nudashboard.environment=qa` and the `dashboard_qa` schema.
They are not part of any production deployment workflow.

| Candidate | Reproduced defect | Original offline result | Candidate result | Hosted QA |
| --- | --- | --- | --- | --- |
|001-profile-access-boundary.sql|Self-service privilege fields and untrusted signup role metadata|7 security expectations failed|14 checks pass, including persistence and audit readback|Applied; database and Auth/PostgREST checks pass; broader UI coverage pending|
|002-office-workflow-boundary.sql|Overlapping permissive Huddle rules bypass office/active-user restrictions; related task/checklist writes escape scope|11 of17 expectations failed|17 of17 pass|Applied; 17 database probes pass; broader UI/API coverage pending|
|003-eod-audit-coverage.sql|EOD submissions and edits omit the existing row audit|Missing INSERT audit reproduced|6 checks pass|Applied; browser submission and 7 live checks pass; temporary fixture cleaned|
|004-eod-insert-boundary.sql|Permissive insert rule bypasses active profile, submitter and office checks|4 of 7 permission expectations failed|7 of 7 pass|Applied; identical 7 live probes and 7 browser/audit regression checks pass; temporary fixtures cleaned|
|005-eod-workflow-integrity.sql|Ordinary users can change approval state/metadata, edit approved rows and retarget office scope|10 local failures; 8 live bypass cases|27 of 27 pass|Applied; 14 live checks and 7 browser/audit regression checks pass; temporary fixtures cleaned|
|006-eod-history-identity.sql|Ordinary/cross-office history writes and forged reviewer identity fields|7 hosted bypasses plus one inconsistent inactive-profile offline case|24 of 24 write/read checks pass|Applied; 13 Auth/PostgREST writes, 7 visibility checks and both approval UI paths pass; temporary fixtures cleaned|
|007-huddle-child-audit-coverage.sql|Provider/checklist edits persist without audit history|Both table gaps reproduced live and offline|10 of 10 pass|Applied; 11 live UI/Auth/PostgREST/audit/cleanup checks pass; extra fixtures cleaned|

See [September 14 hosted validation](../hosted-validation-20260914.md) for 001/002
and [September 15 EOD audit validation](../eod-audit-validation-20260915.md) for 003.
The [EOD insertion validation](../eod-insert-validation-20260915.md) covers 004.
The [EOD workflow validation](../eod-workflow-integrity-validation-20260915.md) covers 005.
The [EOD history authorization validation](../eod-history-access-validation-20260915.md) covers 006.
The [Huddle child audit validation](../huddle-child-audit-validation-20260915.md) covers 007.
These deployments affect only the isolated Dashboard QA project.

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
