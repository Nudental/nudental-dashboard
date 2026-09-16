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
regressions: four failed before; numeric/zero control already passed. Post-fix
full suite, QA deployment and live verification pending.
