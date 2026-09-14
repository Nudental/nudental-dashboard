# PH5-EXP-001 — AmEx summary fallback truncates and drops credits

Reproduced read-only on nudashboard.com, 2026-09-14, This Year / All Offices.
The displayed net matched the positive-only sum of the first1000 rows exactly.
The source contains1579 matching posted rows. Complete API and SQL source net
totals agree, including credits. Detailed aggregate evidence remains private;
no transaction records or employee details were exported.

Root cause: fetchExpenseSummary requested range0–9999 without checking the
server's returned count/cap, then discarded all nonpositive amounts. Its
discrepancy guard preferred that incomplete gross amount over the API net.

Small fix: select id+amount with exact count, order by id, use the retained
complete expense reader, and include credits in the net sum. Date, office,
posted-state and source predicates are unchanged. No financial rows, source
classifications, payroll model or accounting authority were changed.

Seven synthetic tests:5 fail before,7/7 pass after. Cases cover server caps,
credits, empty periods, later-page errors, API failure and retained filters.
The production-only branch passes1003/1003 retained/source tests with no skips;
the QA branch passes1038/1038. The production source build passes in36.48s.
The same seven tests pass against the actual compiled release function.

Released through the existing server-to-Pages process on2026-09-14:
deployment1f1f91bc-5dbd-4500-8bfd-d4e2039ba601,
entry index-a6a4e36b8660.js,
SHA256 a6a4e36b8660486de43e961184fc3c8c85cda00bc927d6de41bfd511dd245eb2.
This is a bounded artifact change, not a full-source redeployment. Only the
summary function changes; its existing complete-reader helper is embedded
locally with identical source/behavior. Full reversal reproduces the previous
entry exactly. All960 prior asset files remain unchanged and recoverable.
Previous deployment4f583195-5bef-4c51-9e45-de3cc73819d1 and server directory
ndash066-v2-dist remain the immediate rollback.

Live This Year / All Offices: AmEx net now matches the complete posted source
and the charges/credits calculation. Refresh preserves all headline readbacks.
All five charts remain present, other source headline amounts are unchanged,
and no browser error is reported. Frontend/API HTTP200, all three services
active, and15/15 preserved backend files unchanged. No business records were
modified. This repair does not certify the remaining composite expense total.

Separate unresolved issues: payroll facts versus processed payroll-run
funding, current-enrollment benefit estimates, office allocation, and shared
summary metadata across overlapping requests. These are not silently resolved
by the AmEx completeness repair.
