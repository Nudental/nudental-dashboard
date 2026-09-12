# NDASH-086 — Ingestion metadata shows blank run date and false-green reports

Section: RCM / eAssist Reports / Ingestion Status. Status: repaired, deployed, live verification PASS.

Reproduced after085 restored valid responses and again after settled Refresh: Latest Run shows—completed, and all three latest office cards are green. Metadata-only API check confirms nonemptyrun_started_at but no run_at/runAt; all three latest office records have parser_status=missing and parser_confidence=0 but no legacymissing/confidence fields. No raw run log or report content was emitted.

Root cause: IngestStatusPanel reads only legacy rendering fields. Smallest fix, two expressions in EAssistReportsTab.jsx: append run_started_at to the existing date fallback; classify an office as missing when parser_status is missing or the legacy/canonical confidence fallback equals0, preserving existing absent-info/missing-flag behavior and legacy confidence precedence. No other field, callback, API, report classification, ingestion or business record changed.

Tests: seven source-expression behavior cases, three failures before; all362 frontend tests PASS after. Production build30.73s PASS; Rocket811 completed exact expressions. Actual compiled predicates/date reproduce false-green/blank before and pass canonical/legacy cases after. Entire entry reverses to084, all prior repairs and seven dependency relinks PASS. Backend085 unchanged;084 rollback graph retained. Positive healthy reports are covered synthetically; the three current live latest reports are genuinely missing.

Release/live PASS: deploymentc0942201-867b-4cf6-bc47-d4cbfa2c1d8d; index-9b01e156690e.js; SHA9b01e156690e66124fba70ef7c9a33369ffc518f9657f8cd32b5841d64006377. After reload and again after Refresh, LatestRun date09/11/2026/statuscompleted; all three office cards show Missing—report not received/parsed with amber styling, none green. Report total/missing63/latest08/31/50rows unchanged. Staten recovery and report drawer X still pass. Alerts/errors0, frontend/API200, three services active, backend085 unchanged;084 rollback retained. No business records, ingestion, staging, configuration or privileges changed.
