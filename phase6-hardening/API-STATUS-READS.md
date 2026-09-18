# Legacy status reader boundary

Status: candidate, not activated.

The actual `/v2/sync/status`, `/v2/supabase/status` and `/v2/gusto/status` handlers expose internal sync state, database table counts and import-log details. Inspection found no current frontend or scheduled consumer of these paths; references in the server inventory are their own route declarations. The public `/health` and static not-configured Compliance responses remain unchanged.

Three entries are added to the already deployed administrative policy. Sync status requires the existing all-office Sync-page authority; Supabase and Gusto status require the existing all-office Data Health authority. Admin/Super Admin retain their existing reader override. An office query cannot authorize a global response. Jobs receive no new access. No route body, provider integration, configuration or business data changes.

Verification: 271 guarded native tests PASS, including actual status handlers with fake storage before and after the boundary; no guard attempts. Thirteen materializer tests PASS. The 17 retained backend suites from the immediately preceding Expense candidate all passed, and their main/service inputs are byte-identical. All 30 other materialized files are unchanged. Frontend remains the previously verified 1,660-test release.

Production activation and live checks are pending. Private recovery files will stay on the existing server; no credential backup is transferred locally.
