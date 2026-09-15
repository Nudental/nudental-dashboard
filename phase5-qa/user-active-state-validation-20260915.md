# PH5-USERS-002 — Activate switch leaves the account deactivated

On the deployed QA Users page, the disposable account was deactivated with the normal Deactivate action. Clicking its Activate switch then set `is_active=true`, but left `status=Deactivated` and `is_approved=false`. Refresh showed a Deactivated badge beside an enabled switch. The existing account gate still rejects the account because all three fields must agree.

Root cause: `usersService.toggleActive` wrote only `is_active`. Its dedicated approval and deactivation methods already update all three fields. The targeted correction gives the toggle the same field values in one update, retaining its audit action and the existing administrator permission enforcement. No database policy, authentication architecture, or production deployment changed.

- Focused regression: original 1 PASS / 3 FAIL; repaired 4 PASS. Covers activation, deactivation, an inconsistent legacy state, and permission rejection.
- Full retained suite: 1,326 PASS, zero skips. Build, 510 source-file comparisons, and QA environment guards PASS.
- Source `a6a5caf220d5a0e28e64bc78ca5db494a801c262`, pushed. QA deployment `40e053e8-4275-4bc7-942f-27607c42d03a`; previous `fb79b6a3-f333-4c52-a08a-af2cae689f52` retained.
- Entry `index-BXV27Bxo.js`, 8,828,282 bytes, SHA-256 `6c5cf53ca11b9edff178a2c9953c17b086dae4cbbea33c43a88c637720332e4b`.
- 17 hosted checks PASS; production unchanged.
- Repaired UI Deactivate and Activate each reported success. Database readback respectively confirmed `Deactivated/false/false` and `Active/true/true`. Refresh showed the matching badge and switch; counts returned to 13 total / 11 active / 2 not activated / 0 deactivated. One account and one assignment remained; actor-attributed audits recorded both writes. Live PASS.
- The disposable account is retained temporarily for the next office-assignment check; final cleanup remains required.
- Temporary account `220c88a0-547c-4d18-812d-b28f628980b7`; sanitized stages in `qa-users-ui-20260915.json` outside the repository. Production has no test accounts or changes.
