# Group A candidate verification

Candidate: `migrations/A-tasks-notifications-profiles.sql`.

- Local production-role fixture: **41/41 PASS**. Includes signup metadata escalation, own profile edits, all eight role/task visibility combinations, cross-office denial, immutable task authorship/lifecycle, active account, notification owner, transactional assignment and failed-assignment preservation.
- Hosted isolated QA native PostgreSQL: **12/12 PASS** with production permission configuration and synthetic actors. All DDL, temporary configuration and fixtures rolled back. No production records copied.
- Native production preflight: **PASS**, repeated application and exact catalog rollback. Seven functions, two restrictive policies, five triggers. Existing table/function owners and grants preserved. All **4,425 affected-table rows** preserved.
- Existing audit writer extended through its existing `change_summary` column to capture actor role/office and record office. No historical backfill or second audit logger.
- No frontend, backend runtime, role-grant or business-data change is included in this SQL group. Enabling the transactional office-assignment client is a separate, tested frontend release after the function is live.

Production applied after Dr. G's explicit approval on 2026-09-17 at 21:51 UTC. All 4,425 affected rows have unchanged fingerprints; existing owners/grants are preserved. The post-apply probe of all 13 active actors matches the reviewed Tasks/Notifications visibility. Live Tasks and Profile screens pass; production and QA frontend/API health checks pass. Fresh exact rollback, catalogs and row digests are preserved in `production-a-20260917T215054Z` both locally and on the existing server. The frontend remains `277f68be-3819-410c-8ca6-6aa5ffa2a95e`.

No business records were created or edited during production verification. Write/bypass/audit behavior was exercised in the isolated QA transaction suite; production checks cover deployed definitions, permissions, unchanged data and read-only UI behavior.
