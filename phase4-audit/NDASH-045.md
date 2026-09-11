# NDASH-045 — Transaction Audit truncates entries and available years

Section: Transaction Audit / Daily Entries Sync Audit. Severity: High. Status: live reproduced; exact source-count discrepancy confirmed; repair not yet implemented.

Live2026AllOffices:AllEntries1000, Showing1–50of1000, only2026available in yearselector. ExactHEAD sourcecounts for the same4visibleofficeIDs:2026=1932,2025=2405,2024=2495. Thus932current-year rows are omitted and at least2years with data cannot be selected.

Root:transaction-audit/index.jsx fetchEntries does one unpaginated Supabase select, then calculates filters/totals/export from that capped response. Available-years query also retrieves only the default1000latest entry dates. Date sorting lacks a stable secondaryIDkey. Errors are logged and old/emptydata retained. No server limit setting should be changed globally.

Reproduced again immediately before editing:live1–50of1000andonly2026yearchoice. Source fixprepared intransaction-audit/index.jsx pluspureauditReadService.js. Readcompleteexact-countpages orderedentry_datedesc/idascending; rejectfailed/incomplete/duplicate/changing-countresults and>50000rows,witherror/retryinstead of partialfinancialtotals. Keepoffice/year/statusscope andofficialDentrixNetProductionqueryunchanged. Metadatausesonlyearliest/latestscopeddate(two limit1queries) toofferallcalendar yearswithinthehistoryrange. Ignorelateyearmetadataandentryresponses; guardempty/loading/errorCSV. No businessdatawrites.

Tests:13focusedpaging/year/scope/race/errorcasesPASS;174retainedfrontendtestsPASS. ActualcallbacktestedwithsyntheticSupabasebuilder and1932syntheticrows. Buildpendingatthischeckpoint. Rocketsamescope submittedinexplicitlyapprovedworkspace. Actualproductionartifactpreparation/deployment/liveverificationpending;042uploadapprovalstillopen. Do notclaimcurrent1932UIverificationuntilreleased. Source-onlycandidatecancontinueindependently withoutuploadingtheblocked042payload.
