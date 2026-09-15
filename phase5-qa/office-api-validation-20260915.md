# Scoped QA office catalogue — September 15, 2026

Only the isolated Dashboard QA API was deployed. Production services, source,
credentials and routing were unchanged. The API continues to report not ready
for the complete application because the remaining routes are still under review.

Before release, the real office-manager request to `GET /v2/offices` returned 403.
The reviewed integration enables that exact GET for verified active users and
limits its result to their existing office assignments. Global-office roles keep
their existing scope. Other methods and unreviewed routes remain denied.

The original handler, API-key dependency and office mapping/cache code are called
unchanged. Two synthetic location records are inserted into the isolated SQLite
cache only when missing. Unexpected location IDs cause startup failure; existing
QA rows are not overwritten. The response wrapper validates IDs/counts/duplicates
and filters after the shared cache, so one user's cached result cannot expose a
different office. It never calls a real provider or reads production records.

Candidate source archive: `d0c509936ff3915f80e34e66695834a88c10589a77f2e6d3329bcb2a29a3e355`.
QA release: `8f86280efb3f08521ebaefba04a8a2f4412f08880b533365a0c2d8186dc4898b`.
Previous release `2153f5020d75ccfd06daf66fffb943bc4170ab1a4ce3fe880786c0dbfc2f39b5`
remains available. The existing restricted publisher activated the candidate and
confirmed health. The 26 pinned dependencies and process/network sandbox remain.

Verification:

- 20 focused local checks passed, including actual recovered office mapping.
- 92 backend checks passed with the actual pinned Linux dependencies, no skips.
  A preliminary Windows run lacked FastAPI/Linux support; it is not counted.
- 23 live office-list checks passed: all synthetic roles, exact office sets and
  counters, aliases, duplicate/blank/unknown selectors, missing API key and user,
  denied writes, inactive/unapproved users and retained unreviewed-route denial.
- 22 public EOD checks and 15 public isolation/identity checks passed unchanged
  in purpose. The unreviewed-route probe now targets the still-closed providers
  endpoint because offices is explicitly reviewed and enabled.

Concurrent harness logins briefly triggered HTTP 429. The completed office run
was performed afterward with private short-lived QA session reuse. No provider
rate settings, account configuration or credentials were changed.

Browser follow-up found a separate source defect: the EOD parent passes
`propOfficeId`/`propDate` while its child tabs accept
`selectedOfficeId`/`selectedDate`. The screen still shows Unknown Office until
that frontend contract is repaired. This integration is not reported as fixing
that separate UI defect. No frontend was redeployed in this step.
