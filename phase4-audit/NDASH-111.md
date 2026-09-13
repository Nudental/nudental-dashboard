# NDASH-111 — Import Audit producer/reader status mismatch

Section: Import Audit / summary consumers. Severity: Medium. Reproduced twice on110: All has300records,265rawsuccess/35rawpartial. Selecting Success returns No audit entries found. Existing middleware writes success/partial/failed/nodata; Rocket writers use Success/Partial Success/Failed/No Data Returned. Reader exact equality and summary classification recognize only the latter. Stored rows remain unchanged.

Fix only src/services/dentrixIngestionService.js: canonical aliases on read-side status filter, normalize reader output and the summary's two input arrays. Preserve unknown statuses, fields, other filters/date windows/limits/calculations, and all writers. Seven synthetic cases5failbefore;all504regressionsPASS. Build/Rocket/compiled/deployment/livepending.

Other separate observations: Set Goals collection-heading vs production-input mismatch remains unassigned; its prior potential111 label is superseded by this confirmed functional repair. Audit Trail2261exactrecords vs200UIcap confirmed. Sync API200/empty arrays queries missing public.sync_log (PGRST205); alternate current source investigation pending. No source records/log content retrieved for those checks. Initial count probe's incorrect browser UA caused Supabase401; corrected to normal server request, existing credential unchanged. No production writes.
BuildPASS33.08s/Rocket837PASS. Actualcompiled oldstatusmismatch reproduced;aliases/summary/unknownstatus/otherfilters/queryfailurePASS. Exactfullreverse110andallpriorrepairs/sevenrelinksPASS. Candidateindex-33e4560dcc9c.js. Deployment/livepending. Subsequentread-onlysourceinspectionfound sync_logger.py writes sync_job_runs (potentialcurrent Sync source; investigate after111).

Source6766757. Deploymentbe589a57-0551-42c4-bb51-1351cebf63a3 success;entryindex-33e4560dcc9c.js SHA33e4560dcc9c230bf50da20c704e3149a298e3b6136acedd45837482e90353e0. FreshAll300canonical265Success35PartialSuccess;Successfilter300allSuccess,PartialSuccessfilter300allPartialSuccess;unmatchedsearch0/Clearrestoresoriginal300;RefreshAuditLogsame;newbrowsererrors0. System110/healthchecksongoing. These are existing300-row querywindows, not claims of complete historicalcoverage.

## Closure — PASS
All live filter/search/refresh checks pass. System110 remains3Unavailable/no deliveryrates/recentEvents;all6Systemheadings/loading0/newerrors0. Root/ImportAudit/System/Reports/API200,3servicesactive,backend085unchanged.110recoverypreserved. No business/configuration changes or imports executed.
