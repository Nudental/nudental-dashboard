# PH5-IMPLANT-004 — Used This Month counts inventory status

After a manual usage persisted, inventory stock correctly fell from seven to six,
but Used This Month showed zero, including after refresh. One authorized usage
record dated September 15 exists. `fetchInventorySummary()` instead incremented
this value for inventory rows whose status was `used`, with no month filtering.

The correction counts used usage records by procedure date, from the start of the
current calendar month up to the next month's start. It uses the current actor's
existing Supabase session and row policies. An exact HEAD count avoids fetching
patient details or truncating the total to one page. Query errors propagate
instead of being represented as a valid zero. Other stock summaries are unchanged.

Eight actual-service cases reproduce seven original failures and now pass,
covering partially used stock, old inventory status, month/year boundaries,
returned entries, exact counts over 1,000 records, minimal payload, and denied
queries. All 1,289 retained frontend tests pass with zero skips. Build/source
parity (510 files) and QA environment/credential checks pass.

Live read-only API scope checks pass for existing QA accounts: staff in Office A
count 1; Office B manager counts 0; admin counts 1. Only counts are downloaded,
with no patient body and no data writes. Evidence:
`qa-implant-monthly-count-20260915.json`.

Candidate entry `index-DdaVZR0l.js`, 8,828,707 bytes, SHA256
`5ef9f16afd9dc21ce3f314aaf89b59ea241c56b887524400f2d604d860b1398f`.
Live frontend repeat pending; production remains unchanged.

Live frontend verification PASS on63ad5b56-6aeb-4b95-b287-2b0cff365465,
source34d9711d27d65701816583d87db81eb2a3b6c467. The refreshed dashboard shows
Total In Stock6 and Used This Month1; the single usage row still displays
Sep15,2026. Independent readback confirms one usage, one usage audit, and stock6.
All17hosted checks pass. PreviousQA349013df and production1f1f91bc are preserved.
No further write was needed for the verification. Existing test-fixture cleanup
is still tracked with the remaining inventory workflow tests.
