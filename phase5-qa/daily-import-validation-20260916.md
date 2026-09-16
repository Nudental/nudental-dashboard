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
frontend tests pass, zero skipped. QA build, deployment and live verification are
pending. No production deployment is authorized by this repair record.

Temporary workflow: QA / Office A, existing QA / Provider A, February 10, 2027,
notes `QA TEMP PH5-DAILY-IMPORT-20260916`. Values are synthetic. The exact scope was
empty before starting; optional categories were blank to avoid catalog creation.
Receipt outside Git: `qa-daily-import-20260916.json`.
