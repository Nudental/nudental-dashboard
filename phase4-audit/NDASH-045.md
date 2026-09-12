# NDASH-045 — Transaction Audit truncates entries and available years

Section: Transaction Audit / Daily Entries Sync Audit. Severity: High. Status: repaired, deployed, live verification PASS.

Live2026AllOffices:AllEntries1000, Showing1–50of1000, only2026available in yearselector. ExactHEAD sourcecounts for the same4visibleofficeIDs:2026=1932,2025=2405,2024=2495. Thus932current-year rows are omitted and at least2years with data cannot be selected.

Root:transaction-audit/index.jsx fetchEntries does one unpaginated Supabase select, then calculates filters/totals/export from that capped response. Available-years query also retrieves only the default1000latest entry dates. Date sorting lacks a stable secondaryIDkey. Errors are logged and old/emptydata retained. No server limit setting should be changed globally.

Reproduced again immediately before editing:live1–50of1000andonly2026yearchoice. Source fixprepared intransaction-audit/index.jsx pluspureauditReadService.js. Readcompleteexact-countpages orderedentry_datedesc/idascending; rejectfailed/incomplete/duplicate/changing-countresults and>50000rows,witherror/retryinstead of partialfinancialtotals. Keepoffice/year/statusscope andofficialDentrixNetProductionqueryunchanged. Metadatausesonlyearliest/latestscopeddate(two limit1queries) toofferallcalendar yearswithinthehistoryrange. Ignorelateyearmetadataandentryresponses; guardempty/loading/errorCSV. No businessdatawrites.

Tests: 13 focused paging/year/scope/race/error cases PASS; 174 retained frontend tests PASS. The actual callback was tested with a synthetic Supabase builder and 1,932 synthetic rows. Source production build PASS (36.78 seconds). Rocket version 776 completed in the explicitly approved workspace. Actual production artifact preparation, deployment, and live verification remain pending; the separate NDASH-042 upload approval is still open. The production UI has not yet been verified to show 1,932 rows.


Deployment closure: released independently on top of NDASH-044, preserving all previous repairs and excluding blocked NDASH-042. Deployment a2b03274-f0ec-471c-8d79-05b8e3c05044; asset /assets/index-ec1fbb5f96f6.js; SHA ec1fbb5f96f6321dbd347d41c9936d17f65545863294524272929df7e64ee92f. Previous ndash044-dist remains recoverable. The earlier pending statements above are superseded by this closure.

Actual compiled component tests PASS: 1,932 synthetic rows, office/year/status restrictions, stable ordering, rejected incomplete/duplicate/failed results, stale responses, two scoped year bounds, loading/error totals, CSV guards, unchanged Dentrix effect, full reversal to 044, and seven dependency relinks. Latest retained source suite 221 PASS and production build PASS (39.35s); no source code changed during artifact preparation.

Live PASS: 2026=1,932, 2025=2,405, 2024=2,495, all matching independent exact source counts. Year choices now 2026 through 2021. Page 2 shows 51-100 of 2,495 with 50 rows. Barnegat2026=706 and its Draft status=0, both independently verified by HEAD count only. Unmatched search produces zero rows and disables Export CSV. Reset and refresh return 1,932 and default filters; no alerts or browser errors. No exports, entry detail opens, or business-data writes. Ordinary-role live testing remains unavailable; existing authorization scope was retained and tested synthetically.
