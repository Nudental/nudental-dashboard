# Group E — insurance and service goals

DEPLOYED and verified 2026-09-18T04:51:02.334433+00:00. Fresh row guard preserved 5,072 rows; all 13 active production actors matched the fresh candidate inside the apply transaction. The native checks and representative UI passed. Backup `production-e-20260918T045042Z`. The figures below describe the earlier preflight. Adapted from 019, 020, 041 and 042. Restricts reads by active account, existing insurance page permissions and office/parent scope. Completed insurance form contents remain locked while the existing delivery/tracking field allowlist remains usable. Goal values are never changed.

Verification: 50 insurance-access, 37 completed-form, 20 office-goal and 23 service-goal retained checks; 10 hosted QA checks; native production repeated migration and exact rollback PASS. Fingerprints covered 5,049 rows and remained unchanged. Five policies, one function and one trigger are affected; table/function ownership and grants remain intact.

Fresh backup, sequential production application, live workflow verification and post-apply fingerprints remain required. The preflight simulated prior groups inside a rollback-only transaction. No insurance submission, patient contact or goal edit was performed.
