# NDASH-058 — Late claim responses overwrite the active filters

Section: RCM / Claim Submissions. Severity: High. Status: candidate tested; deployment/live checks pending.

Reproduced on 057: after rapid date-basis/office/status changes, visible August / Barnegat / Service Date / Unsent / empty Payor controls showed the all-office 1,011-claim total. Explicit Apply with identical controls restored383, with every visible row Barnegat/Unsent. Earlier payor clearing left5 claims until the next read. Independent API/source evidence confirms Barnegat total444 and Unsent383. This is a response-order problem, not a financial data correction.

Root cause: every overlapping load callback updates rows, summary, pagination, freshness, error and loading; filter/unmount cleanup does not invalidate requests. Targeted fix in ClaimSubmissionsTab.jsx: per-request generation reference, reject stale success/error/finally updates, invalidate on cleanup, clear obsolete data at load start, and always replace the current summary including empty results. Endpoint parameters, status/date/office semantics, calculations and current-page search/sort/export behavior stay unchanged.

Tests: 270 source tests PASS; production build PASS (30.65 seconds). Deferred-request tests cover reversed success order, obsolete errors, loading while a newer request remains pending, current failure, cleanup, and empty summary. Actual compiled component Swt passes the same behavior checks. Full reversal to057, preserved prior repairs and seven dependency relinks PASS. Rocket789complete.

Candidate asset index-86af3cdb8684.js. Exact prior-deployment guard 5a830349-02a8-4c78-9ffe-96aeb31f07ef; retain prior057 graph. No patient, financial or claim writes, exports, sync or configuration changes.
