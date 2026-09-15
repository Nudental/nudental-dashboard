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
|008-task-page-permission.sql|Disabled task-page permission still allows direct API reads|QA staff UI denied but API returned assigned task|11 of 11 pass|Applied; 8 live role/read/write checks pass; temporary QA staff permission restored to disabled|
|009-task-field-permission.sql|Assigned staff can edit manager-only priority through the API|Live priority edit bypass reproduced and restored|14 of 14 pass|Applied; 9 live permission checks and ordinary staff UI completion/readback pass|
|010-notification-audit-coverage.sql|Notification read changes persist without audit history|Repeated UI read changes had zero audit entries|7 of 7 pass|Applied; live read/archive, owner scope and temporary creation/deletion history pass|
|011-huddle-review-permission.sql|Office managers/staff can bypass reviewer roles through Huddle API writes|4 of 8 live expectations fail; all temporary fixtures cleaned|32 of 32 pass, 13 original bypasses reproduced|Applied; 8 of 8 live cases pass and manager history page loads; fixtures cleaned|
|012-implant-office-boundary.sql|Other-office/inactive reads and linked stock deduction bypass office access|9 of 11 live expectations fail; all temporary fixtures cleaned|21 of 21 pass, 13 original failures reproduced|Applied; 14 of 14 live cases pass, including valid stock use and repeat prevention; fixtures cleaned|
|013-task-identity-boundary.sql|Creator and lifecycle metadata can be forged through task API writes|7 of 12 live expectations fail; fixtures cleaned and permission restored|26 of 26 pass, 12 negative-control bypasses|Applied; 12 of 12 live cases pass, manager task page/counters load; fixtures cleaned and permission restored|
|014-task-row-audit.sql|Direct task writes omit database audit records|Ten successful disposable QA mutations had zero matching row audits|9 of 9 pass, including create/lifecycle/cleanup history|Applied; 14 of 14 live checks pass; temporary task removed, five audit records retained, permission restored|

See [September 14 hosted validation](../hosted-validation-20260914.md) for 001/002
and [September 15 EOD audit validation](../eod-audit-validation-20260915.md) for 003.
The [EOD insertion validation](../eod-insert-validation-20260915.md) covers 004.
The [EOD workflow validation](../eod-workflow-integrity-validation-20260915.md) covers 005.
The [EOD history authorization validation](../eod-history-access-validation-20260915.md) covers 006.
The [Huddle child audit validation](../huddle-child-audit-validation-20260915.md) covers 007.
The [task page permission validation](../task-page-permission-validation-20260915.md) covers 008.
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
