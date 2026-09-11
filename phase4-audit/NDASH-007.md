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

Planned verification: preserve full source privately; validate existing services do not auto-reload; apply candidate atomically, test the existing candidate service first, then restart the established production service. Require public unauthenticated 401 and existing authorized client 200; retain rollback on failed health checks.
