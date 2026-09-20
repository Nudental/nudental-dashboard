# HR collection and monthly-tier repair

Status: **release candidate verified; production activation and live verification pending**. This is an estimated-compensation reporting repair, not wage approval or a financial-record correction.

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

## Verification before activation

- 1,742 frontend tests pass; production build passes using unchanged production configuration.
- 90 focused Python contract/source/runtime/report tests and 13 materializer tests pass.
- 334 native backend/permission tests pass behind the retained guard, with no blocked network or production-write attempts.
- Final staged source has independent daily/monthly parity; HTML/CSV/prepared payload agree; both real report-period PDFs render successfully in private server evidence.
- No raw HR/source financial evidence or credentials are committed. Production configuration stays on its existing server; only credential-free code patches and synthetic tests are transferred. No QA configuration is promoted.

Production activation still requires the fresh source/process/config/asset rollback checkpoint and startup-flag verification, then bounded Dashboard API/frontend publication and real signed-in browser verification. No Collaboration restart, financial/cache mutation, provider sync, payroll submission, or compensation email is part of this release.
