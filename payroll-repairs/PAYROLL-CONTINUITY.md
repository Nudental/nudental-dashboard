# Ongoing payroll calculation

The ordinary path is Payroll → Provider Compensation. Its existing imported-Gusto selector, pagination and once-only calendar shift are retained. Gusto supplies identity/date/status metadata only. Ascend signed Ledger Collection history supplies the amounts. The unchanged legacy Dentrix overview and hygienist policies are not the canonical doctor compensation calculation.

## Configuration

The existing protected server administration mechanism manages `~/.config/nudashboard/payroll-policy`. `compensation_policy.py inspect` shows the active version; `approve --document <private approved JSON> --expected-version <current hash>` adds a version with administrator identity, time, approval provenance and effective dates. Runtime requests cannot write this configuration. File/directory ownership and private modes, document integrity and compare-and-swap updates are enforced. Office rules do not grant login permissions.

Initial approval preserves August 1–September 30 assignments and extends those same nine doctors' approved offices from October 1 indefinitely. Actual changes require a reviewed prospective effective date. Earlier versions and historical assignments are preserved. New or changed source identities require verified identity evidence, never fuzzy name matching.

## Calculation and exceptions

The protected report path reads every bounded source page, exact historical charge links/categories, signed offsets and cancellation chains through the captured source cutoff. It validates dates, complete coverage, identities, duplicate groups, per-day office assignments, monthly/office sums, exact cent thresholds, rounding and calculation hashes. No fixed HR file or approved-payday list unlocks future calculations.

Separate calendar months stay separate; a completed month must have ended before both payday and the New York source-read day. Otherwise the basis remains provisional through the selected period cutoff. September 18 retains September 12 permanently. Doctor tiers remain flat 32/33/34/35%, with no changes to paid payroll or hygienists.

Unknown doctors and policy gaps name the person/source and required review. Other independent results may be shown only as an incomplete subtotal. Incomplete retrieval/category/revision evidence withholds the calculation, never substitutes a stale result or fabricated zero. Automated checks are explicitly not a new independent HR reconciliation.

Derived results are immutable, actor-bound entries in private `~/.local/share/nudashboard/compensation-snapshots/calculations.sqlite3`, with integrity hashes and update/delete rejection. Refresh creates another result. Saved calculations remain available after process restart; history shows the newest 20 and preserves older snapshots. Manual percentage selection reprices a copy, with actor/override provenance and a distinct calculation hash; it does not overwrite the saved automatic result. Month-end adjustments still need a verified paid baseline and separate HR approval.

## Acceptance evidence

Retained frontend: 1,742; backend/permissions: 334 retained + 3 new = 337; focused Python: 90 retained + 22 new = 112; materializer: 13. Historical replay retains all 275 independent daily controls, 18 monthly bases and 27 monthly tier/calculation comparisons without changing expected amounts.

Isolated browser QA runs the actual ProviderCompensationNew selector, actual DoctorLedgerCompensation, dashboardFetch/service and source adapter, protected backend route/boundaries, reports and private snapshot store. Only trusted QA identity, imported-run fixtures, Ascend transport and the unchanged legacy hygienist companion response are synthetic. External connections and all application writes are blocked. No production QA fixtures or credentials are used.

One build and policy pass October 2 (20,000 collections; 70,000 monthly; 34%; 6,800 estimate), October 16 (September 10,000 at 34%=3,400; October 29,000 at 32%=9,280), and October 30 (25,000; 54,000; 33%; 8,250). Signed offset, incomplete source, unknown provider, late revision and immutable readback are checked through the real browser. Year/leap boundaries, effective-date changes, exact cents and conflicting policies are separately covered by synthetic regressions.

Native synthetic October 30 CSV and PDF files arrived in Downloads. Their actual content matches the table/report calculation ID, policy version, cutoff, monthly basis and estimate; the PDF was visually checked. These are synthetic-only test files.

Production activation and final live evidence are recorded in `PAYROLL-CONTINUITY-RELEASE.md`. No payroll submission, emails, provider sync, financial edits, permission changes, scheduler changes or Collaboration restart are part of this work.
