# NDASH-083 — eAssist summary cards change with pagination

Section: RCM / eAssist Reports. Status: candidate verified; release pending.

Reproduced on frontend082/backend080: August63 reports, all marked missing. Page1/50 shows Missing50 and Latest08/31; finalpage2/13 shows Missing13 and Latest08/07 while TotalReports remains63. Change page size10 yields Missing10 and Latest08/26 on settledpage2/7, again with Total63. Report rows are placeholders; no emails or business data changed.

Root cause: eassist_daily_reports returns only summary.returned/total. Existing frontend fallbacks calculate status counts, latest date and average confidence from the loaded page. Fix only that route: project parser_status/parser_confidence/report_date across the identical existing filter scope in bounded500-row reads and accumulate the summary fields the frontend already accepts. No email content, identities or financial fields in the added query. Preserve report-page data, pagination, filters, credentials, ingestion, configuration and metadata. Ignore nonnumeric/nonfinite confidence values; include valid zero. A failed summary query returns502 instead of misleading partial statistics.

Seven actual-route tests use synthetic HTTP/config fixtures. Six failures before; seven pass after, including >500-row summary paging, existing filters, average confidence, date stability and error handling. Twelve retained backend suites also pass, including080age and076office. Syntax and entire-source reversal PASS. CandidateSHA1a5d9e0cfc27650a36e585e92962696e412af5e0b612258fe40d52190793108c; full080snapshot retained privately. No full backend source or secrets committed.

Read-only preflight PASS: current backend080/frontend082/service043 unchanged; All63missing, Brick21, Success0; API summary fields absent as diagnosed. Age0All207/age30Staten12 and single-office daily repair retained. Existing write-on-start flags disabled, cache warm-up read-only, missing-key401. Release requires candidate8002 then live8001 comparisons; frontend082 stays unchanged.

Additional observation, not yet repaired: changing from page2/50 to page size10 settled onpage2 despite the frontend page-reset effect. Possible overlapping-request race in loadReports; reproduce again after083 is closed before editing.
