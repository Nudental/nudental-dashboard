# Huddle/EOD read authorization

Candidate verified; deployment is pending the bounded release receipt.

Six read route declarations require the current active/approved human identity,
the existing page grant and the office selector actually consumed by the route.
Treatment-plan completion also serves the existing KPI and Reports consumers.
Explicitly disabled role grants override the existing relevant fallback grants.
Read-only job credentials do not authorize these routes; the EOD sync action is
outside this batch and remains under separate caller review.

The exact existing contact-history handler reproduced a cross-office response
against synthetic intercepted storage. The repair checks the stored queue office
before fetching contacts. Assignee lookup now requires active, approved accounts
with Active status. Existing response calculations and all other route bodies
are unchanged. No new execution capability or business record is introduced.

Verification: 164 native tests and 17 retained backend suites PASS, with the
network/business-data guard active and no blocked attempts. All 21 unrelated
materialized files are unchanged. Tests cover actual contact-history/assignee
handlers, explicit denials, office aliases/conflicts/duplicates, all-office
scope, role fallback overrides, malformed records and existing report consumers.

Production validation uses missing/invalid/job denial probes and read-only UI.
No Huddle initialization, sync, clinical write or workflow submission is allowed.
Preserve the pre-existing incidental September 18 unsubmitted Huddle draft.
