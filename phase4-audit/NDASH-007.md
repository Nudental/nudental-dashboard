# NDASH-007 — Expense endpoints omit the existing API access guard

Severity: Critical. Read-only requests without credentials returned HTTP 200 on /v2/expenses/filters, summary, lines, breakdown, amex, payroll and wf. The neighboring production summary correctly returned 401. Summary financial fields were confirmed; no business rows were printed or changed. Summary reproduction was repeated before preparing the repair.

Root cause: seven GET route decorators in middleware/main_candidate.py omit the established Depends(verify_api_key) binding. Existing Dashboard summary and AmEx clients already send X-API-Key through _middlewareHeaders.

Fix: add that existing dependency to those seven decorators. No credential, authentication architecture, business handler, database, infrastructure, or deployment configuration changes. This restores the existing shared API-key boundary; it does not add per-user authorization or solve broader limitations of a browser-distributed shared key.

Baseline source SHA256: ce0c216e3d5637f31fd5125da0626c81c35bc677f11060562bc8d4f0dbf432a1.
Candidate source SHA256: b396101c4527e168ba1f4c42739d5119fcb6962d3620e49203586a56c7a48afd.
Private candidate and recovery source: /home/openclaw/.cache/nudashboard-audit-20260910/ndash007-backend/.
The accompanying patch contains only the route changes; full backend source contains private runtime defaults and is not published here.

Tests: actual decorators and actual verify_api_key function run in a separate FastAPI test application with synthetic handlers and a synthetic key. No production application import, startup hook, business handler or database access occurs. Baseline fails all seven authorization cases; candidate passes all 21 missing/wrong/valid-key assertions.

Deployment safety: active Dashboard cloudflared connections prove port 8001 is the current origin. main.py resolves to main_candidate.py for both existing services. Active origin startup has migrations, background sync, streaming and prewarm disabled. Candidate port 8002 has only read-only cache prewarm enabled; migrations/sync/streaming disabled. Existing startup schema initialization is unchanged. No deployment performed at this commit.

Deployment: PASS. Applied only the seven route dependencies atomically, restarted the existing candidate service first, passed 21 status assertions, then restarted the established production service and passed the same 21 public assertions. Both services and the existing tunnel remain active. Recovery source remains preserved. Configuration and business data were unchanged.

Live verification: PASS. Public expense summary without a key returns 401, public API and frontend health return 200. The signed-in Expense Report loads its totals and charts with no browser errors. Frontend asset remains index-6d3e6bafcf0c.js, unchanged by this backend repair. Default Python user-agent requests encounter the pre-existing edge 403; matching the established browser user-agent confirms application health and the 401 guard.
