# NDASH-085 — Ingestion status discards valid paginated responses

Section: RCM / eAssist Reports / Ingestion Status. Status: repaired, deployed, live verification PASS.

Reproduced on frontend084/backend083, including settled refresh: no Latest Run or latest-office table. API metadata confirms0latestRuns/0latestOffices while August report rows are present. Read-only HEAD checks of the exact existing backend queries return206: recent report total306/limit100, ingest run total272/limit5. No report or log bodies requested in these source checks. Last-business-day missing query returns200/total0; existing staged1/conflict1 remain untouched.

Root cause: eassist_ingest_status accepts only status200 for latest runs, missing rows and recent reports, replacing successful206 responses with empty lists. Smallest fix: change those three success predicates to status in(200,206), consistent with the existing daily-report endpoint. Queries, filters, response envelope, ingestion behavior, staging, configuration and records unchanged.

Six actual-route tests use synthetic HTTP/config fixtures: three failures before; six pass after. Thirteen retained backend suites pass, including083summary/080age/076office. Syntax and exact entire-source reversal pass. CandidateSHA7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5; full083snapshot retained privately. No full backend source, credentials or raw log content committed.

Read-only preflight PASS: source083/frontend084/service043 unchanged; missing/latest absence reproduced; staged1/conflict1/missing0 retained; report summary63missing and age/office aggregate controls pass. Existing startup writes disabled, read-only cache warm-up preserved, missing-key401. Candidate8002 must restore5latest runs/3offices before live8001 release, with all other aggregate controls unchanged. Frontend084 remains unchanged.

Read-only date check during investigation: exactReportDateAug31 clears both range inputs and shows3reports/Total3. Date controls and remaining validation/ingestion-field rendering still require audit after this repair.

Deployment/live PASS: candidate8002 then live8001 restore5latestRuns and3latestOffice entries with dates available; staging1/conflict1/missing0/source metadata and all report-summary/age/office aggregates unchanged. Missing-key401 retained. Live Refresh restores Latest Run section/statuscompleted and three office cards dated09/10; exactAug31 report count3 stays unchanged. Alerts/errors0, frontend/API200, three services active, frontend084 unchanged. BackendSHA7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5; full083rollback retained. No ingestion, review, approval or record changes.

Separate confirmed UI contract issue NDASH086 pending: Latest Run date displays— because run_started_at is not read. All three latest office cards are green, although APIparser_status=missing andparser_confidence=0 for all three; legacyconfidence/missing fields are absent. Metadata-only contract check retained; no raw run logs or report bodies exposed. This is a separate rendering repair after the response-restoration fix.
