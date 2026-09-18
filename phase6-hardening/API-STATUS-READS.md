# Legacy status reader boundary

Status: DEPLOYED AND VERIFIED.

The actual `/v2/sync/status`, `/v2/supabase/status` and `/v2/gusto/status` handlers expose internal sync state, database table counts and import-log details. Inspection found no current frontend or scheduled consumer of these paths; references in the server inventory are their own route declarations. The public `/health` and static not-configured Compliance responses remain unchanged.

Three entries are added to the already deployed administrative policy. Sync status requires the existing all-office Sync-page authority; Supabase and Gusto status require the existing all-office Data Health authority. Admin/Super Admin retain their existing reader override. An office query cannot authorize a global response. Jobs receive no new access. No route body, provider integration, configuration or business data changes.

Verification: 271 guarded native tests PASS, including actual status handlers with fake storage before and after the boundary; no guard attempts. Thirteen materializer tests PASS. The 17 retained backend suites from the immediately preceding Expense candidate all passed, and their main/service inputs are byte-identical. All 30 other materialized files are unchanged. Frontend remains the previously verified 1,660-test release.

Production activation and live checks PASS. Private recovery files will stay on the existing server; no credential backup is transferred locally.

## Legacy status readers — deployed

Source `0b108413241076358123eb0e4e1e87197c132ffb` applied at 2026-09-18T12:30:15.853167+00:00. Three entries in the existing administrative policy now protect Sync status, Supabase table status and Gusto import status. There is no current frontend/scheduled consumer requiring anonymous access. All-office Admin/Super Admin or the exact existing Sync/Data Health page grant is required. Public health and static Compliance responses remain unchanged. Main source SHA256 remains `681aa6a12f0b9b7fbef6e914d47b82bf441dbbfa0a3fd7f4e48af1923a9b3cce`; no handler or calculation changed.

271 guarded native tests and 13 materializer tests PASS. All 17 retained backend suites from the immediately preceding Expense candidate passed; their main/service inputs are byte-identical. All 30 other materialized files are unchanged. Live missing/invalid identities return 401, job access to these routes returns 403, and existing Summary/Payroll reads remain 200 with unchanged Summary data. All 78,473 original guarded Supabase rows and 83,962 SQLite rows are preserved. Current credentials, job scopes, configuration, frontend and provider connections are unchanged. Production/QA/API health PASS. Signed-in Expense reloads without alerts, warnings or captured browser errors. Positive status-handler tests were synthetic because no active UI uses these legacy paths.

Recovery: `backup/api-before-phase6-status-reads-20260918`, `api-status-read-backup-20260918T122943Z`. Private recovery files remain server-side. Do not restore the revoked reconciliation credential. RCM/financial/provider route review, final regression and canonical-main integration remain pending; Phase 6 is not complete.
