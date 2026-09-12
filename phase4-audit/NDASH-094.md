# NDASH-094 — Insurance search punctuation breaks the request query

Section: Insurance Request Queue. Severity: Medium. Status: source fixed, verification in progress.

Reproduced twice, including after093direct-route repair: __NU_QA__,test causes the visible PostgREST logic-tree parser error and zero results. Plain unmatched marker returns the normal empty state; Clear restores the two existing completed requests.

Root cause: insuranceVerifyService.fetchVerificationRequests directly interpolates the search term into five unquoted ilike expressions. Commas and other reserved characters are interpreted as filter syntax. PostgREST requires quoted reserved values and escaped quotes/backslashes (https://docs.postgrest.org/en/v13/references/api/url_grammar.html).

Two-line targeted repair: escape backslashes and double quotes in the trimmed term, then quote each complete wildcard pattern in the existing OR template. Preserve wildcard matching, all five searchable fields, office/status/assignment/date constraints, ordering, data and error behavior. No business records, credentials, security policies or worker code changed.

Nine focused cases cover words, comma, parentheses, quotes, backslash, apostrophe, whitespace, retained filters and propagated errors; five failed before. All413 tests pass after; build26.30s PASS. Rocket/actualcompiled/deployment/live verification pending. Next frontend baseline is092;093 was an independent worker repair and remains active.

Rocketconfirmedexactescapingandfivequotedpatterns. Actualcompiledpunctuation/quotes/backslash/whitespace/scope/order/empty/error/full092reversal/priorrepairs/7dependencyrelinksPASS. Candidateindex-7b8ed1f1f119.js. No payroll code or093worker changes.
