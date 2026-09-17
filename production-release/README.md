# Dashboard production promotion — 2026-09-17

Production-only application promotion from the verified Phase 5 source. Original main is `61c224b1bf9ec53d91ab69a8eb00e563204bf76d`; verified QA source remains `2859ae6416e59918af4487e781e343f790ab770a`.

## Application scope

79 reviewed frontend paths cover single responsive page mounting, request/session isolation, pagination and data completeness, report/navigation rendering, profile readback, safe invitation sessions, documents/photos, Huddle/EOD/tasks, inventory forms, insurance requests, service goals and import validation. Production PH5-EXP-001 remains intact. Environment policy selects production endpoints and credentials; QA execution branches remain inactive.

No recovered backend template changed. No QA API/runtime, database credentials, actor bootstrap, synthetic records, fixtures, provider restrictions, Pages configuration, or QA storage configuration is deployed. Test-only fixture files are not web assets. Financial source transactions, metadata/classification proposals, archives, totals and accounting residual registers are outside this release.

## Bounded schema changes

1. `001-implant-stock-transaction.sql`: existing one-unit stock trigger now rejects insufficient stock atomically and marks exhausted stock used. Existing owner/ACL and rows preserved; prior function definition backed up on the deployment server.
2. `002-receipt-columns.sql`: add nullable quantity/time fields required by the existing receipt handler. Historical completed receipts retain unknown/null values; only future inserts receive defaults. Original fields and all 480 historical rows preserved. Idempotent. A frontend rollback retains additive columns to avoid erasing future receipt data.

Both migrations were independently exercised offline, including idempotence, failure rollback and original-field preservation, and applied with original-row fingerprint comparisons inside each transaction.

## Deliberately deferred migrations

QA repairs 001–015, 017, 019–022, 025, 028, 032, 034, 035, 039 and 042 change access/audit boundaries. They remain separately tracked pending a production role/office access matrix and dependency review; existing production policies are preserved. This release does not claim those QA permission findings are repaired in production.

018 (office assignment), 026 (draft transaction), and 037 (receipt transaction) have QA-gated RPC callers and remain inactive in production; enabling them requires a separate transaction/permission deployment. Production callers retain the existing path. 023 removes a historical audit foreign key and requires a retention/rollback decision before promotion.

024 and 031 enforce synthetic office lists; 027 and 038 contain QA execution simulation. Excluded. 029, 033, 036, 040 and 041 depend on the QA audit namespace and require a deliberate production adaptation; excluded from this migration batch. The QA Front Desk no-self-approval change is not represented as a production permission change.

QA storage policy work is not applied: production storage policies and photo permissions remain unchanged. Existing production-safe UI/storage error handling is included.

## Verification and rollback

Core: 1,074 frontend tests, six compiled isolation checks, production build, 17 backend suites, 13 materializer tests. Full application candidate: 1,630 frontend tests with zero failures/skips; production build. Database: 49 retained offline suites plus 14 production adaptation checks. Actual financial/clinical production writes are intentionally not used for regression.

Before core deployment, 44,868 original rows across 13 tables were fingerprinted along with backend source and schema/policies. Core live check: unchanged display metrics and original row hashes, one Executive Overview mount (previously two), no console errors, Reports navigation PASS, production/API/QA HTTP 200.

Recovery tags: `backup/main-before-production-update-20260917` and `backup/production-before-operations-20260917`. Server release evidence is under `/home/openclaw/.cache/nudashboard-production-release-20260917`; it contains manifests, private backups, transaction receipts and publishing/rollback scripts. Secrets and business row contents are not committed.

Final deployment/live results are recorded in the release closure document after verification. Main must advance only after live regression passes.
