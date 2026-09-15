# PH5-USERS-003 — Removed office remains accessible

The disposable QA staff account was assigned only Office B through Users → Assign Office → Apply. Refresh showed only Office B. Its legacy `user_profiles.office_id` still pointed to Office A, however, so `user_can_access_office` returned true for both offices and the account could read one existing synthetic Office A Huddle. Only QA record IDs/counts were inspected.

Root cause: `setUserOfficeAssignments` replaced assignment rows without synchronizing the primary office. Existing authorization deliberately recognizes both sources. Updating them in separate requests also permits partial failures.

The QA candidate uses one `SECURITY INVOKER` RPC with an active administrator check and the existing row policies. It locks the target profile, preserves the primary office only if still selected, otherwise selects the first assigned office or clears it, and replaces assignment rows in the same transaction. Invalid references roll back both changes. Duplicate office IDs are normalized. The existing assignment audit remains.

The frontend uses this RPC **only in QA**. Production keeps its existing path; releasing the production repair later requires a separate coordinated schema/frontend review. No production policy, data, credentials, or configuration changed.

- Offline database checks: 16 PASS (original leak, removed access, primary synchronization, multiple/empty/all-office assignments, duplicate/repeat requests, rollback, ordinary/inactive/anonymous denial, audit, invoker permissions).
- Focused frontend tests: 4 PASS, including no partial-write fallback on rejection and unchanged production path.
- All 18 migrations reject non-QA installation and coexist: 38 PASS.
- Retained frontend suite: 1,330 PASS, zero skips. QA build and isolation checks PASS.
- Hosted migration and frontend release: PENDING. Supabase dashboard management operations failed during its announced September 15, 21:15–21:45 UTC maintenance window. No migration SQL was executed. Retry after maintenance; the running QA app is still on `a6a5caf` / `40e053e8-4275-4bc7-942f-27607c42d03a`.
- Disposable account `220c88a0-547c-4d18-812d-b28f628980b7` remains for original-test repetition and cleanup. It is active Staff, primary Office A, explicit assignment Office B. Sanitized evidence: `qa-users-ui-20260915.json` outside source control.
