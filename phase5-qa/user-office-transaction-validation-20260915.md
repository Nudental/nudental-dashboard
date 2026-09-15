# PH5-USERS-003 — Removed office remains accessible

The disposable QA staff account was assigned only Office B through Users → Assign Office → Apply. Refresh showed only Office B. Its legacy `user_profiles.office_id` still pointed to Office A, however, so `user_can_access_office` returned true for both offices and the account could read one existing synthetic Office A Huddle. Only QA record IDs/counts were inspected.

Root cause: `setUserOfficeAssignments` replaced assignment rows without synchronizing the primary office. Existing authorization deliberately recognizes both sources. Updating them in separate requests also permits partial failures.

The QA candidate uses one `SECURITY INVOKER` RPC with an active administrator check and the existing row policies. It locks the target profile, preserves the primary office only if still selected, otherwise selects the first assigned office or clears it, and replaces assignment rows in the same transaction. Invalid references roll back both changes. Duplicate office IDs are normalized. The existing assignment audit remains.

The frontend uses this RPC **only in QA**. Production keeps its existing path; releasing the production repair later requires a separate coordinated schema/frontend review. No production policy, data, credentials, or configuration changed.

- Offline database checks: 16 PASS (original leak, removed access, primary synchronization, multiple/empty/all-office assignments, duplicate/repeat requests, rollback, ordinary/inactive/anonymous denial, audit, invoker permissions).
- Focused frontend tests: 4 PASS, including no partial-write fallback on rejection and unchanged production path.
- All 18 migrations reject non-QA installation and coexist: 38 PASS.
- Retained frontend suite: 1,330 PASS, zero skips. QA build and isolation checks PASS.
- Migration 018 applied only to QA after management access recovered. SQL receipt: `5e346d03-fef4-4cb5-a935-07e0230fe142`. Function remains SECURITY INVOKER; anonymous execution false, authenticated execution true.
- QA deployment: `2ef0da74-4760-4f2b-b73d-670908e19d8b`, source `b6501e0a601466d7595031cd2b012a1ce03a7768`, entry `assets/index-BKgU6kuZ.js`, SHA256 `f889bd28c3e6c9ccf38024328b54b040917e6faa3cb43ffc9ff73ad15f5bbe91`. Previous QA release remains recoverable. Production release `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601` unchanged.
- 17 hosted frontend/API isolation checks PASS.
- Original UI action repeated: select only disposable account, Assign Office, select only QA / Office B, Apply. Full refresh shows active Staff with only Office B.
- 15 hosted transaction checks PASS: Office A access false and Huddle read empty; B access true; eight unauthorized actor attempts rejected; invalid office rolls back both records; duplicate/repeat requests preserve one assignment; empty and explicit all-office assignments behave correctly. Account restored to only B.
- Disposable account `220c88a0-547c-4d18-812d-b28f628980b7` has been removed after a 168-reference preflight. Its assignment, Auth account, profile, and private temporary credential file are cleaned; all 12 original QA identities remain. Audit history retained. Sanitized evidence: `qa-user-office-transaction-live-20260915.json` and `qa-admin-cleanup-20260915.json` outside source control. The hosted test is a one-time fixture validation and must not be blindly rerun after cleanup. No production business records accessed or changed.
