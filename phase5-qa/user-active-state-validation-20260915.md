# PH5-USERS-002 — Activate switch leaves the account deactivated

On the deployed QA Users page, the disposable account was deactivated with the normal Deactivate action. Clicking its Activate switch then set `is_active=true`, but left `status=Deactivated` and `is_approved=false`. Refresh showed a Deactivated badge beside an enabled switch. The existing account gate still rejects the account because all three fields must agree.

Root cause: `usersService.toggleActive` wrote only `is_active`. Its dedicated approval and deactivation methods already update all three fields. The targeted correction gives the toggle the same field values in one update, retaining its audit action and the existing administrator permission enforcement. No database policy, authentication architecture, or production deployment changed.

- Focused regression: original 1 PASS / 3 FAIL; repaired 4 PASS. Covers activation, deactivation, an inconsistent legacy state, and permission rejection.
- Full suite, QA release, live retest, and cleanup: pending.
- Temporary account `220c88a0-547c-4d18-812d-b28f628980b7`; sanitized stages in `qa-users-ui-20260915.json` outside the repository. Production has no test accounts or changes.
