# Group C — implant and bone/tissue inventory

DEPLOYED and verified 2026-09-18T04:37:44.758416+00:00. Fresh row guard preserved 4,428 rows; all 13 active production actors matched the fresh candidate inside the apply transaction. The native checks and representative UI passed. Backup `production-c-20260918T043735Z`. The figures below describe the earlier preflight. Adapted from 012, 015, 017 and 021–023. Preserves the already-live stock transaction repair. Adds office/parent/active-account boundaries and missing audit events without modifying clinical records or stock.

Verification: retained implant/bone access, active-role, lookup, stock and deletion suites passed; 10 hosted QA contracts passed; native production repeated migration and exact rollback passed with 4,405 rows unchanged. Existing function/table ownership and grants are preserved.

The historical audit foreign key prevents a valid delete audit after its parent is removed. The migration removes only that incompatible constraint. The actual deletion actor comes from the authenticated session. Historical audit visibility follows the saved office and existing module roles.

Rollback must preserve post-release deletion history. `catalog.cjs` supports `preserveHistoricalAudit: true` and uses `rollback/C-restore-audit-fk.sql`: restore the original FK as NOT VALID if deleted-parent history exists; validate it only when every reference exists. Five additional local checks prove historical audits survive this rollback and repeated execution. Never delete audits to make the old FK validate. Exact schema restoration remains available before any post-release deletion occurs. Restoring the old writer also restores its original delete limitation.

The specialized audit schema records actor ID/name, office in row snapshots, action, before/after and timestamp. It does not have an immutable actor-role field; role lookup against today's profile is not proof of the historical role. Existing architecture is retained; no duplicate audit system or history backfill is introduced.
