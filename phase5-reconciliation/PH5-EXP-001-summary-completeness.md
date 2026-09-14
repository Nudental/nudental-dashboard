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
The full retained suite and release/live verification still need to run for
this change. It is committed on the QA branch only and is not deployed.

Separate unresolved issues: payroll facts versus processed payroll-run
funding, current-enrollment benefit estimates, office allocation, and shared
summary metadata across overlapping requests. These are not silently resolved
by the AmEx completeness repair.
