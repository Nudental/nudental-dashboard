# NDASH-034 — Attendance reads stop at1000 rows

Section: Payroll / Gusto / Time & Attendance. Severity: High (incomplete displayed time totals). Status: tested candidate; release pending.

Live reproduction: Time Entries shows1000 entries,1000 table rows and7839.5 summary hours. Source HEAD-only count confirms1353 time entries. No employee records retrieved by the source audit. UI dates span Jul3,2026–Dec18,2025 in the truncated selection. Existing summary falsely calls the unfiltered span Current Pay Period; that is a separate follow-up.

Root cause: useGustoTimeEntries issues one unbounded SELECT; Supabase caps it at1000. Table, employee subtotals and the summary consume that incomplete array without detecting truncation.

Fix is limited to the hook: read matching pages of1000 until the exact count is reached; order by clockin_time and unique id; preserve filters. Reject missing/changing counts, duplicate IDs or incomplete page results. Publish rows only after completeness verification. A request sequence rejects stale responses and unmounted updates. Failure clears stale rows and exposes an error. No business-data, permission, provider, import or configuration changes.

Verification:117 frontend regression tests PASS; production build31.11s. Six focused cases cover1353 rows, stable filtered paging, second-page failure, empty data, truncated response and stale-response rejection; five fail against the original hook. The same six cases PASS against the extracted actual patched production hook. Full module syntax PASS. All tests use synthetic QA rows and make no business requests.

Prior code graph retained; only the attendance hook changes inside the target module. Fresh dependent filenames avoid stale cache; other module bodies remain unchanged. Remaining filter-name/ID mismatch, reset behavior, summary scope and stale API-access banner require separate live reproduction/repair.
