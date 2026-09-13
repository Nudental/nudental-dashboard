# NDASH-123 — Front Desk history displays the preceding month

Severity: Medium. Status: CLOSED — deployed and live-verified PASS.

Live Front Desk Request History on release 122 displayed May 2026 for four item rows and June 2026 for one. Re-entering the view reproduced the same labels. A read-only source query selecting request_month only confirmed two June batches and one July batch. The five history rows represent items from three batches; that count difference is expected.

Root cause: FrontDeskRequestHistory.jsx fmtMonth parses YYYY-MM-01 as UTC midnight and then renders in local time. Negative UTC offsets move the date into the preceding month.

Smallest fix: parse the normalized month at local midnight by appending -01T00:00:00. The same formatter supplies the table and CSV month label. Queries, filters, timestamps, quantities, permissions, and stored records remain unchanged.

Validation pending: six focused calendar tests, all retained frontend tests, production build, actual deployed formatter tests, full reverse comparison with release 122, scoped deployment and live verification. No business-data writes or real CSV export are needed.

Predeployment verification PASS: six focused tests (three fail before repair), all558 retained frontend tests, production build29.98s, Rocket849. Actual release122 formatter reproduces May/June for stored June/July; candidate formatter passes four time zones, January/year boundary, month-only and empty values. Complete reversal reproduces release122 byte-for-byte; seven dependent modules only relink the new entry. Candidate index-6391e67eca11.js. Deployment and live checks pending.

Release: source c61b046; deployment5bcbe4b5-3633-4cb1-83ad-742d48259b0d, entry index-6391e67eca11.js SHA6391e67eca113f309a4ed2bc50d20a0c410dce58d80fca2286e07bc24d012cc9. Prior122 release retained for recovery. Live after fresh reload: June4/July1; Rejected1 displays July; Brick4 correctly scoped; unmatched search explicit empty; clearing and re-entry restores all5 with correct months. New browser errors0. Frontend/API200 and all3 services active; backend113 hash unchanged. No business-data changes or test-record cleanup required.
