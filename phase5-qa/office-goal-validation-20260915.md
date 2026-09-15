# Monthly goals and PH5-AUTH-012 office read restriction

Only QA Office A and unused July/August 2027 were tested. Preflight confirmed no existing goals; Office B was unchanged. No production, payroll, payment, or provider action occurred.

## Live write checks

- July production goal 1,000 persisted as both supported production fields; collection goal null because June had none. UI Saved and audit CREATE confirmed.
- August production goal 2,000 persisted with collection goal 950 (95% of July). Explicit success message, refresh readback, and audit CREATE confirmed.
- Negative input rejected, persisted values and audit count unchanged.
- Intentional August zero persisted while collection goal remained 950; audit UPDATE confirmed. Repeating the unchanged zero save left the same two rows and three audit events.
- Nine live API permission cases PASS: existing super-admin/admin/own-office manager no-op updates allowed; Office B manager, staff A/B, marketing, inactive and unapproved accounts denied. Exact data unchanged by probes.
- Both temporary goals removed after dependency checks. Three audit entries retained; originally empty goal table restored. Refresh shows both offices Not set.

## Confirmed and repaired boundary defect

Before editing, two live role-matrix runs showed Office B staff and manager could read both temporary Office A goals. The recovered permissive `office_goals_select` policy allowed every active account, overriding narrower office policies because PostgreSQL combines permissive policies with OR.

QA migration `019-office-goal-read-boundary.sql` adds one RESTRICTIVE SELECT policy requiring the existing active-profile and `user_can_access_office` checks. Existing permissive roles/write rules and goal values are preserved. Regional/admin access, own-office access, and explicit extra assignments remain supported. No production policies changed.

- Offline PostgreSQL: 20 PASS, including original leak, supported regional roles, own/cross-office reads, inactive/unapproved/anonymous denial, explicit assignment/revocation, own-office/admin writes, and unchanged data.
- All 19 QA migrations: 40 installation/coexistence/non-QA rejection checks PASS.
- Source `13a42a021b1b95ffd102aa778d53bd10be3fb099`; applied QA query `7d1f6508-da9f-46b6-a2b3-157df7e931a4` reports the expected RESTRICTIVE SELECT policy.
- Repeated live matrix: Office B manager/staff now see zero Office A rows; active authorized Office A and regional/admin accounts retain both; inactive/unapproved remain zero. Goal values and administrator UI unchanged.
- Database-only repair: no frontend or production deployment needed. QA frontend remains `0dbd298d-1cf5-446c-b843-e43156643dd6`.

Sanitized evidence remains outside source control: `qa-goals-ui-20260915.json`, `qa-goal-scope-original-20260915.json`, `qa-goal-scope-reproduced-20260915.json`, `qa-goal-scope-repaired-20260915.json`, and `qa-goal-writes-cleanup-20260915.json`. Their one-time helpers must not be rerun against removed fixtures.
