# NDASH-029 — Late run responses and retained pages could contradict filters

- Section: Payroll / Imported from Gusto / Payroll Runs. Severity: High.
- Reproduced after028: rapid All/Processed/Reversed transitions can show20 rows while Reversed is selected; the settled API and one transition at a time correctly yield0. Six isolated tests also reproduce retained rows on loading/error, superseded results/errors, unmount delivery and stale year totals.
- Root cause: callbacks apply all responses without a generation check, retain previous data on request/error, and year-summary effects lack cleanup guards. Type/status/run-by changes retain pagination. The year-wide summary lacks a scope label and the empty state falsely claims no imports.
- Fix: clear prior rows/count during loads; apply only current-generation result/error/loading updates; invalidate on cleanup. Clear year summary while loading and ignore canceled effects. Reset the page for list-filter changes, label summary “Period totals (all runs),” and describe filtered empty results accurately. Two existing files, unchanged request parameters/calculations.
- Tests: baseline1/7 PASS, fixed89 retained frontend tests PASS; production source build PASS27.68s. Actual deployed hooks/callbacks8 scenarios PASS, syntax and byte-exact reversal PASS. No data/authentication/configuration changes.
- Candidate index-dad89b1e90b5.js, SHA256dad89b1e90b5d7708849fef30b3a49e8e42e04c408ec23bf5c6c3c5325721f20; prior027 retained. Deployment/live verification pending.
