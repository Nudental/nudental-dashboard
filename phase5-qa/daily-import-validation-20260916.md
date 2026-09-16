# PH5-IMPORT-003 — blank legacy import dates

The same one-row synthetic CSV produced a blank Date cell and blank date-span
pill twice, despite the selected context being February 10, 2027. Preview and
Cancel left zero persisted entries. The root cause was the exported
`formatDateDisplay` placeholder returning null in `dailyEntryBulkImportService.js`.

The targeted repair formats an ISO calendar date as MM/DD/YYYY without timezone
conversion, preserves already readable date text, and gives missing values a
visible fallback. It changes no parser, stored date, calculations, permissions,
official Dentrix totals, or provider configuration.

Five executed-source regressions failed before and pass after; all 1,603 retained
frontend tests pass, zero skipped. QA build and 511-file source parity pass.
Deployment `5fde5564-e787-4fb2-95af-5fca22a214b8`, source
`11782418d6baad7d6e74d5ebea6243b3c59926c7`, passed all 17 hosted checks. Original
live test repeated after reload: preview and imported-date result show 02/10/2027.
Production remains deployment `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601` unchanged.

Temporary workflow: QA / Office A, existing QA / Provider A, February 10, 2027,
notes `QA TEMP PH5-DAILY-IMPORT-20260916`. Values are synthetic. The exact scope was
empty before starting; optional categories were blank to avoid catalog creation.
Receipt outside Git: `qa-daily-import-20260916.json`.

First import: UI success, one pending-review entry, one actor-attributed audit;
reconciliation production +123.45, collection +100. Identical-file retry:
one same entry, a second update audit, no numeric increase. This is intentional
upsert behavior, not a claim that retries produce no update audit.

## PH5-IMPORT-004 — unavailable year-to-date totals shown as zero

Both first and repeated import results displayed YTD production/collection $0.00
and a rate containing only `%`. `fetchYTDTotals` is an unimplemented placeholder
returning null. The results panel passed its absent values to a zero-default
currency formatter and claimed all dashboards were refreshed despite the
explicit legacy-only data contract.

Smallest fix: render an unavailable message for a missing YTD payload and label
the panel as legacy totals, explicitly preserving official Dentrix totals. The
existing supported numeric/zero rendering remains unchanged. No new accounting
calculation, aggregation, source data, or API capability is introduced. Five JSX
regressions: four failed before; numeric/zero control already passed. All 1,608
retained frontend tests and the QA build/511-source parity pass. QA deployment
`62ce1227-8e60-4889-b78f-b19ce2a25f44`, source
`b831b438d0a8d8fad886f6cfffa30ee22e862077`, passed 17 hosted checks. Live after
reload and repeat import: unavailable YTD message visible, no bare percent, and
official totals unchanged caption visible. The same entry remains with unchanged
amounts and three audit events. All 12 role reads preserve its intended review
scope; Office B, inactive and unapproved identities see zero. Production unchanged.

## PH5-IMPORT-005 — successful upserts falsely flagged as mismatches

Two identical-file retries left one entry with unchanged totals, yet the office
view flagged an expected one-row increase and the date view flagged production.
The root cause was counting updated rows as inserted rows and comparing the
production difference to the entire CSV value rather than its change from the
existing row. The import itself persisted correctly.

Targeted fix: expected row growth counts inserts only. The existing read-only
snapshot additionally retains production by the same office/date/provider key
used for upsert. Date reconciliation subtracts that prior amount, using the
final value for repeated CSV identities. Independent duplicate-CSV warnings are
preserved. No write contract or financial source changed.

Eight focused regressions cover unchanged/edited/mixed upserts, other providers,
same provider names in separate offices, final duplicate-row values, incorrect
saved amounts and snapshot identity. Six failed before; all eight pass after.
Full regression/build, QA publication and live verification pending.
