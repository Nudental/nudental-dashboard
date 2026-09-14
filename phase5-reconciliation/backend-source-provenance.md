# Backend and route-worker source provenance

Read-only Phase5 inventory; no backend module was imported or started locally.

## Deployed middleware

- Python runtime:3.12.3. Exact dependency inventory:86 lines, preserved privately from the existing virtual environment.
- Deployed entry:`main.py` resolves to `main_candidate.py` in `/home/openclaw/.openclaw/workspace/ascend_api/middleware`.
- `main_candidate.py` SHA256:`a3961f234a8895617052de9cce99306cb6380f48c2d650f4395ab2c160bf0336`.
- `ascend_service.py` SHA256:`85b660c8bd0e5da672636915aa3942ec3f0cc97870839de15acd681f1ec74664`.
- Static source inventory:52 top-level Python modules; deployed entry declares149 routes. This is a route inventory, not a permission-test result.
- Static local import closure: `main_candidate`, `amazon_service`, `ar_service`, `ar_snapshot`, `ascend_service`, `otp_auth`, `payroll_report`, `report_export`, `report_pdf`, `streaming_consumer`, `supabase_service`, `sync`, `sync_logger`.
- Additional required source outside the middleware directory:`ascend_client.py` in its parent. Preserved separately after discovering the explicit parent-directory import. SHA256:`b93f5acd37b4e0168b71b8e3d9f4207f7e9acf5e3eb6902deb0456e35a6c47e2`.
- The source-only middleware archive contains54 files, SHA256:`ae7ae5944d46eaa63a0982a5e7aeed31c747aad5f150db16dc9f6e417b7aa6f1`.
- Client-source supplement archive SHA256:`33d4f574ad7f0ac0eeb538cf05a17780a253fed923a62269cdb67d79f5d1887c`.
- Both archives and extracted source remain in private working/recovery folders outside this repository. They exclude environment files and business databases. Existing source includes inline configuration requiring a separate review before any new publication.
- Main environment-input names observed: `CACHE_TTL`, `JWT_SECRET`, `LOG_LEVEL`, `MCP_SERVER_PORT`, `NUDASHBOARD_API_KEY`, `NUDASHBOARD_SUPER_ADMIN_KEY`, `OTP_EMAIL_DRY_RUN`, `PORT`, `PREWARM_TARGET_PORT`. This is not an exhaustive inventory of values read through every imported module or configuration file.

## Dashboard Insurance route worker

- Worker:`nudental-manual`. Relevant route:`nudashboard.com/insurance-verify*`.
- Current deployment:`b1ccd2d4-e459-4e3b-bd43-fd756b8a9bbb`; current immutable version26:`6e4c7721-7c59-4935-8ec8-e19296c198cc`,100% traffic, created2026-09-12T18:49:32.39108Z.
- Previous version:`22f696b1-3eeb-48d3-89b5-879bc0438e53`, retained in deployment history.
- Current script ETag:`4d998c12fff5e211e05844d144cc93368fab10f7394f64fb9ebf25f013302e7e`; fetch handler, last deployed through the existing quick editor.
- Compatibility date:`2024-01-01`; no compatibility flags.
- Secret binding names only:`INSURANCE_FORM_TOKEN`, `RESEND_API_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_URL`. No secret values read or returned.
- The connected Cloudflare read API succeeds for current source/version/settings; the earlier Pages-token403 is not a blocker to read-only worker verification through this connector.
- Current source check: exactly one `url.pathname === "/insurance-verify"` condition, followed by `return fetch(request);`; no302 redirect in that branch. NDASH-093 remains present.
- Full worker source is468,221 characters and includes unrelated legacy/manual HTML. It was checked within the connector without returning full source or HTML into the task. Cloudflare's retained immutable version and script ETag identify it; full source is not copied into this repository.

Outstanding: complete environment/default/file-input inventory, confirm runtime file dependencies, sanitize only configuration representation for canonical source as needed, rerun retained backend suites, and retain the current production execution behavior. No services, bindings, routing, credentials, or source financial records changed.
