# HR collection and monthly-tier repair

Status: **DEPLOYED AND LIVE-VERIFIED — PASS**. This is an estimated-compensation reporting repair, not wage approval or a financial-record correction.

## Independent evidence

The encrypted HR Ledger CSV contains 275 daily provider/location/Applied Date controls. It matches all 180 rows of the two supplied HR PDFs and all 32 subtotals. Read-only report inspection confirms the source modification date matches Applied Date for every one of the 275 groups. The original saved report was restored without saving changes.

The candidate reconstructs signed Collection events from complete source pages, exact charge/procedure references, Collection category membership, inactive originals/revisions, and exact cancellation predecessors. It preserves multiple allocation fragments. Retrieval uses lastModified through the evidence time, including later revisions; it does not confuse retrieval freshness with Applied Date or filter solely on transaction date. Out-of-window records are discarded, apart from exact linked predecessors. The source cache and importers are unchanged.

An actual fresh API read through the candidate reader matches **275/275 independent daily controls with zero differences and no extra nonzero groups**. A separate comparison of the final candidate calculation against independent HR aggregates passes **18 unique doctor/month collection bases and 27 payroll/month collection, tier and compensation checks**. No HR financial totals are application constants or public test fixtures.

## One calculation

The existing protected compensation GET gains a Ledger snapshot mode. The same immutable result supplies the doctor table, monthly rows, summary, detail, CSV, HTML/PDF and future report payload preparation. Existing verified human identity, payroll grant, allowlist and all-office scope remain required. Polling is bound to the verified actor and snapshot. Rate overrides are explicit and retain the automatic monthly tier alongside the override; they do not mutate an earlier result.

The dynamic imported-Gusto selector and calendar-date helper remain unchanged. Gusto supplies only run identity, labels, payday and regular/processed status. The backend verifies the already shifted query and never shifts it again. Refresh clears old views; stale or partial responses cannot become a zero estimate or overwrite a newer selection.

The owner-confirmed August–September office rules use exact provider IDs. Both owner source identities combine once. Separate unapproved source identities remain visible. Office filtering retains each doctor's complete qualifying multi-office basis. Out-of-office period and monthly entries remain visible exceptions, not financial corrections. Periods outside confirmed office-policy coverage remain selectable with an explicit unavailable condition rather than retrospective assumptions.

September18 keeps August1–31 final and September1–12 provisional. Monthly cents, thresholds, rates and estimates stay separate, with half-away-from-zero rounding per month before summation. Genuine zero differs from missing. Negative estimates require HR review. Month-end adjustment remains pending a verified same-earning-month paid baseline and separate HR approval; no deduction, payment or prior-payroll mutation occurs.

Hygienist policies stay on their existing path. Old doctor report paths cannot silently recompute incompatible payment-only reports. Legacy bulk doctor delivery is withheld before any message; canonical payload preparation is available, but no send was performed or tested. Current report snapshots are process-local; expiry/restart requires explicit refresh, not silent recalculation under an old identity. Downloaded reports retain their calculation and source snapshot IDs.

## Verification

- 1,742 frontend tests pass; production build passes using unchanged production configuration.
- 90 focused Python contract/source/runtime/report tests and 13 materializer tests pass.
- 334 native backend/permission tests pass behind the retained guard, with no blocked network or production-write attempts.
- Final staged source has independent daily/monthly parity; HTML/CSV/prepared payload agree; both real report-period PDFs render successfully in private server evidence.
- No raw HR/source financial evidence or credentials are committed. Production configuration stays on its existing server; only credential-free code patches and synthetic tests are transferred. No QA configuration is promoted.

## Production release and signed-in verification

Application source `c3da4b53d6b50a191ca04a162915f91ba5ab6c00` is deployed as Pages `bc7aa5ae-99a5-439a-a726-aefa3f9fdb50`. Entry `assets/index-DNiUA6wL.js`, SHA256 `289f2437cf62f9ce6595fff62d1ede6319acae7368d521253b82cc7fed5fdca4`, 8,849,238 bytes. Previous Pages `5dcca0c6-69b7-4125-833d-16cb02be19c1` remains recoverable.

Both existing Dashboard API services run the seven verified source files. The initial parity check triggered safe rollback because the existing main.py symlink was not accounted for; the narrow known-alias check was corrected, a fresh backup was taken, and reactivation passed. No database, service configuration, scheduler or credential changes occurred. Missing/invalid identity returned 401 on both services; the real signed-in human browser successfully loaded the new reports. Collaboration was not restarted.

Live September4: all nine monthly rows match independent collection/tier/estimate controls; 95 reconstructed provider/office/Applied Date detail rows match the independently reconciled source. Live September18: all eighteen monthly rows and 64 daily detail rows pass. The source reconstruction separately matched the entire 275-control HR evidence, including zero groups. Gusto and once-shifted Ascend labels agree. Barnegat filtering preserves combined qualifying tiers. Historical selection survives refresh. Switching to September18 while September4 refresh is running yields only the newer period's correct rows. Tab reentry produces the same result. Browser errors were absent.

Detailed HTML agrees with the independently checked table. CSV/PDF buttons complete without application error; private CSV/HTML/payload/PDF content checks pass. Native file-save delivery was not confirmed by the embedded browser, so it is not claimed as verified. No temporary report file was observed by the encryption watcher.

Production, candidate, QA frontend/API and Collaboration health checks pass. Production financial-source row fingerprints and schema are unchanged. QA deployment/configuration and Collaboration PID remain unchanged. Confirmed office-policy evidence remains limited to August–September2026; other earning months need effective office evidence rather than guessed historical mappings. Full uncached history reads take roughly two minutes; loading is explicit and stale results are never substituted.

Rollback source/config/process/schema/asset backup: `/home/openclaw/.cache/nudashboard-payroll-collections-20260920/release-backup-20260920T113356Z`. Pushed tags `backup/main-before-hr-collection-20260920T112735Z` and `backup/production-before-hr-collection-20260920T112735Z` preserve prior main and production. The focused branch is retained. Canonical main is advanced normally to the verified application plus this documentation; no force push.

No financial/cache mutation, provider sync, payroll submission, compensation email, paid-payroll recalculation or accounting correction was performed. Month-end adjustment awaits the verified paid baseline and separate HR approval.
