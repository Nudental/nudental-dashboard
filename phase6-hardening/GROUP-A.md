# Group A candidate verification

Candidate: `migrations/A-tasks-notifications-profiles.sql`.

- Local production-role fixture: **41/41 PASS**. Includes signup metadata escalation, own profile edits, all eight role/task visibility combinations, cross-office denial, immutable task authorship/lifecycle, active account, notification owner, transactional assignment and failed-assignment preservation.
- Hosted isolated QA native PostgreSQL: **12/12 PASS** with production permission configuration and synthetic actors. All DDL, temporary configuration and fixtures rolled back. No production records copied.
- Native production preflight: **PASS**, repeated application and exact catalog rollback. Seven functions, two restrictive policies, five triggers. Existing table/function owners and grants preserved. All **4,425 affected-table rows** preserved.
- Existing audit writer extended through its existing `change_summary` column to capture actor role/office and record office. No historical backfill or second audit logger.
- No frontend, backend runtime, role-grant or business-data change is included in this SQL group. Enabling the transactional office-assignment client is a separate, tested frontend release after the function is live.

Production apply is pending the exact-group approval required by automatic review. Rollback is already saved privately on the server as `rollback-group-a.sql`; catalog and row digests are in `before-group-a.private.json`. The current frontend deployment remains the recovery point `277f68be-3819-410c-8ca6-6aa5ffa2a95e`.

The recovered backend manifest appears modified under the checkout's LF filter, but its exact file bytes and parsed content match HEAD. It is not part of this change and must not be staged as an unrelated normalization.
