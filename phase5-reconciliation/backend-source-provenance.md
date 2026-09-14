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

**Runtime correction from the running processes:** both service command lines start `/home/openclaw/.openclaw/workspace/ascend_api/middleware/.venv/bin/python3.14` and its Uvicorn entry, running Python3.14.6. The3.12.3 reference below described the earlier/default interpreter and is not the live runtime. The actual environment has86 distributions, with identical package/version pairs to `backend-requirements.observed.txt`; its sorted runtime export has SHA256`51a33bdff277b0b243bb65a967483dfe146c6878339b8e784c2a4f88c2d98e08` (ordering/case presentation differs from the retained file, pins do not).

Fresh guarded tests through the actual `.venv/bin/python3.14` pass17/17,0 blocked attempts, under private evidence `retained-backend-checks-python314-venv`. A preceding diagnostic run incorrectly invoked the resolved base interpreter outside its virtual environment;15 suites passed and2 lacked FastAPI. That separate evidence is preserved. No installed package or service was changed to make tests pass.

Running executable metadata: cloudflared2026.9.1 at `/home/openclaw/.local/bin/cloudflared` (SHA256`03f1f25d1cc93b9ad6c60569d44060bc4f17ed97075760ed8cfca4b12dcd68cc`), gog0.11.0 and WeasyPrint68.1. The `nudashboard-api` tunnel is healthy, configuration version7. Relevant routes: authentication under `api.nudashboard.com/v2/auth/*` uses8002; other Dashboard API and `plan.nudashboard.com` use8001. Unrelated routes were not changed. Only configuration names, paths and hashes were retained; credential values were not returned or published.

- All17 retained backend suites PASS against the SHA-verified middleware snapshot using the existing Python3.12.3 virtual environment. The summary-function extracts used by one suite were first compared against the actual deployed source AST.
- Test processes used synthetic SQLite fixtures or mocked readers/ASGI handlers. A test-only startup wrapper blocked external connections, child processes, non-fixture SQLite paths, and production data/configuration files. Final run:0 blocked attempts,17/17 PASS. The production application was never imported or started by this runner.
- Initial wrapper run:16/17 PASS. Its Python function wrapper acquired method-binding behavior when a retained test saved `sqlite3.connect` as a class attribute. Corrected the wrapper to a callable object, preserving the original builtin calling behavior, and admitted read-only file URIs only inside the synthetic fixture directory. The complete second run passed. This was a test-harness correction, not an application defect or financial-data change.
- Evidence remains at `/home/openclaw/.cache/nudashboard-phase5-20260913/retained-backend-checks-v2`; the first-run evidence is preserved separately.
- The86 observed Python package pins are retained in `backend-requirements.observed.txt`. Every line was validated as a package/version pin with no private URL or filesystem path; file SHA256:`aae380d20af7af8f8e182eb7b5dfc93ee92b8a4503058deec8c8db89fc7985ec`.
- Static closure now accounts for14 source modules, including the parent Ascend client. Three dynamic imports in the entry refer only to standard-library `pathlib`/`datetime`.
- The client default points at `sandbox.json`, whose environment selector is `sandbox`. Live `ascend_service` and `sync` explicitly override it with `production.json`, whose selector is `production`. Only those selector fields were returned; no credentials were exposed and neither provider environment was contacted. The existing sandbox file is not yet evidence of dedicated synthetic QA data or authorization for positive provider operations.
- The static scan records47 file/path literals for continued runtime-input review. A source filename or an environment label alone does not establish QA isolation.

Remaining backend work: canonical configuration representation, complete file-input requirements, and future QA-only execution guards. Production behavior/configuration remains unchanged.

## Exact source reconstruction and publication boundary

`recovered-backend/` now preserves fifteen Python source templates and the referenced `ar_aging_migration.sql` schema source. A fresh read-only server check confirms all15 Python modules still match the preserved snapshots. The schema source is3338bytes, SHA256`bda610354c12bfb5bd3e1878ac28044f4e7ea24758b296a24fb8eebb5b604608`; it contains structure/index/policy definitions, not business rows. No SQL was executed and no policy changed.

The source closure includes `plaid_sync.py`: the main module starts it as a subprocess, so static imports alone missed it. Runtime inspection also identifies `gog gmail send` paths in bank-sync alerts, OTP delivery and payroll report delivery, plus WeasyPrint report execution. Future QA guards must cover these paths as well as HTTP adapters. None was invoked by the investigation.

Source reconstruction uses71 typed private configuration slots. These exclude embedded credentials, repeated credential examples, fixed email identities, provider/bank/office mappings, and historical financial reference totals from the public source tree. The original literal text remains in private recovery inputs outside Git. Supplying those inputs reproduces all16 source files byte for byte; application modules are never imported, SQL is never executed, and the output is never served or deployed. This preserves the existing production behavior without changing its authentication/configuration architecture.

Privacy verification finds0 occurrences of the6 distinct known embedded credential values and0 email addresses in the templates. Business mappings/reference containers were separately identified and moved to private slots; synthetic QA replacements are required. The raw source archives and private materialized comparison copy are not part of this repository.

The materializer passes13 synthetic tests covering exact output, missing/extra slots, literal/code rejection, slot-type enforcement, email-text validation, reviewed template hashes, path traversal, production-hash mismatch, no overwrites and validation before writing. An early test exposed that address text can parse as Python's matrix operator if substituted into the wrong expression context; explicit reviewed slot kinds and literal types now reject that mismatch. No application or production defect is claimed from this harness finding.

This is a reconstruction baseline, not a QA runtime. The existing schema's policies are preserved as source, not accepted as proof of role isolation. No private values, production data stores, rendered source, environment files or live-provider credentials were copied into the repository. Main and all deployed services remain unchanged.
