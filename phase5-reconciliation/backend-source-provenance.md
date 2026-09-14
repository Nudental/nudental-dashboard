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

## Retained verification checkpoint

- All17 retained backend suites PASS against the SHA-verified middleware snapshot using the existing Python3.12.3 virtual environment. The summary-function extracts used by one suite were first compared against the actual deployed source AST.
- Test processes used synthetic SQLite fixtures or mocked readers/ASGI handlers. A test-only startup wrapper blocked external connections, child processes, non-fixture SQLite paths, and production data/configuration files. Final run:0 blocked attempts,17/17 PASS. The production application was never imported or started by this runner.
- Initial wrapper run:16/17 PASS. Its Python function wrapper acquired method-binding behavior when a retained test saved `sqlite3.connect` as a class attribute. Corrected the wrapper to a callable object, preserving the original builtin calling behavior, and admitted read-only file URIs only inside the synthetic fixture directory. The complete second run passed. This was a test-harness correction, not an application defect or financial-data change.
- Evidence remains at `/home/openclaw/.cache/nudashboard-phase5-20260913/retained-backend-checks-v2`; the first-run evidence is preserved separately.
- The86 observed Python package pins are retained in `backend-requirements.observed.txt`. Every line was validated as a package/version pin with no private URL or filesystem path; file SHA256:`aae380d20af7af8f8e182eb7b5dfc93ee92b8a4503058deec8c8db89fc7985ec`.
- Static closure now accounts for14 source modules, including the parent Ascend client. Three dynamic imports in the entry refer only to standard-library `pathlib`/`datetime`.
- The client default points at `sandbox.json`, whose environment selector is `sandbox`. Live `ascend_service` and `sync` explicitly override it with `production.json`, whose selector is `production`. Only those selector fields were returned; no credentials were exposed and neither provider environment was contacted. The existing sandbox file is not yet evidence of dedicated synthetic QA data or authorization for positive provider operations.
- The static scan records47 file/path literals for continued runtime-input review. A source filename or an environment label alone does not establish QA isolation.

Remaining backend work: canonical configuration representation, complete file-input requirements, and future QA-only execution guards. Production behavior/configuration remains unchanged.
