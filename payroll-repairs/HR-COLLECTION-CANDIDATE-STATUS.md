# HR Collection / monthly-tier correction — candidate only

Historical preparation checkpoint, superseded by [HR-COLLECTION-RELEASE.md](HR-COLLECTION-RELEASE.md). Retained to preserve earlier findings; use the release record for current status.

This work is **not deployed, not collection-parity certified, and not wage approval**. Main and production retain the verified dynamic Gusto-period release. The previous release's UI/API consistency check does not establish parity with the later supplied independent HR evidence.

## Unblocked implementation

`collection_contract.py` is a pure candidate server calculation/result contract. It has no database, network, import/sync, deployment or payroll-write side effects. It requires verified signed Applied Date allocation events, exact source identity crosswalks, evidenced Collection category membership, explicit practice-policy dates, complete authorized office scope, and independent daily/monthly controls. Current transaction-date allocation rows cannot be passed as verified Applied Date history.

The contract nets signed events before reversing the ledger sign into an earned-collection presentation. It de-duplicates stable application IDs, retains inactive identities and zero-net groups, keeps out-of-office entries as exceptions, and refuses unknown category/date semantics. Opposite daily errors cannot net into a passing total. Monthly tiers are flat percentages with preserved exact cent boundaries; valid zero is distinct from missing. Cross-month periods use separate monthly bases/rates, rounded to cents per month then summed. A complete closed month requires its full calendar boundary; an open month requires an explicit approved cutoff reference. A manual override remains distinct from the automatic tier and requires the existing authorization context.

One versioned result supplies table/detail/CSV/HTML presentation rows. Missing or unmatched independent evidence withholds estimates in every candidate output. Later results receive new calculation IDs without mutating earlier snapshots. Month-end proposals subtract only verified, same-provider/same-earning-month paid amounts, remain separate from repriced period estimates, and require HR approval. No already-paid baseline is invented and no negative adjustment is applied automatically.

**50 synthetic candidate tests PASS.** The **51 retained dynamic-period/source-completeness tests PASS**, rerun after the cutoff update. The candidate is not yet connected to the production table, detailed report, PDF, or API route; those integrations must use the same result only after the source adapter is validated. No full-release suite/build or live repair verification is claimed for this candidate.

The September 20 owner decision now fixes the September 18 run's August basis to August 1–31 and September provisional basis to September 1–12. Approved scopes are supplied separately from independent evidence; a report refresh cannot advance the cutoff. Candidate table/detail/CSV/HTML rows disclose “Provisional through September 12, 2026.” Report generation, report data-as-of, and included Applied Dates remain separate. A new approved month-end scope generates a separate calculation identity and cannot mutate the original result. Policy-excluded office exception amounts also require authorization for that office before any result is returned.

## Evidence gate before production integration

Private HR PDFs were preserved outside Git and extracted at provider/location/Applied Date grain. Row sums were checked against every provider subtotal and grand total. Doctor-only evidence is kept separate from hygienist policy. The PDFs expose period controls, not complete calendar-month controls or verified paid compensation.

The current source inspection establishes three distinct defects/risks:

1. The generic provider-performance collection query filters negative current payment allocations and uses parent transaction date. This is not sufficient to reproduce HR's signed Collection measure, positive offsets, refunds or application/revision history.
2. The existing monthly performance query can span calendar months; the independent report uses a separate payment-only calculation. A shared validated result is required across surfaces.
3. The shared frontend helper falls back from genuine zero monthly collections to period collections. The candidate contract removes that ambiguity, but it is intentionally not substituted into the existing production views before source validation.

Read-only inspection of the existing organization ledger metadata succeeded. Collection includes designated payment, refund and offset/write-off categories; other adjustments belong to Production and must not be added indiscriminately. The allocation cache has no explicit Applied Date or application-event identity. Its stored transaction stream covers an earlier interval, not the requested payroll periods. Vendor documentation distinguishes Applied Date from Transaction Date and permits a revised transaction's Modified Date to coincide with Applied Date; it does not establish a blanket equivalence to the current raw API fields.

The private comparison must finish with exact application/reversal evidence, not a guessed date substitution or a balancing plug. Also required: independent same-measure full-month and relevant month-to-date controls, and verified paid earning-month attribution for any true-up. The open-month cutoff decision is resolved. Source transaction IDs and private financial evidence are not committed here.

Read-only server-side comparison is now authorized and underway; no source transaction evidence was transferred to the Work computer. Existing revision links were read through the authorized source connection and detailed findings retained in an owner-only server directory with hashes and manifests. Two targeted refund records explain the amount and category of an HR charge-adjustment component, but their entry dates differ from original transaction dates; this is not yet proof of Applied Date parity. Provider display names are not sufficient to resolve multiple source identities. The PDF filter also includes an inactive provider with no daily rows in the supplied periods; that selection must remain in the independently requested monthly universe.

The source cache has an additional interpretation risk: `streaming_consumer.py` normalizes payment distribution signs, while `sync.py` copies raw `appliedAmount`. The private focused comparison confirms opposite raw-versus-cache signs. Neither normalization proves the complete signed application/reversal history. No importer, cache row, financial record, or generic KPI definition has been changed.

## Resume boundaries

- Preserve `providerCompensationPeriods.js`, `useCompensationPeriods.js`, the calendar-date helper and current request isolation/permissions.
- Do not alter the generic provider-performance definition for unrelated modules.
- Use the existing protected compensation route/result contract for eventual integration; do not create an unauthenticated global-total endpoint or accept user-supplied evidence assertions.
- Do not return full-provider monthly tiers to callers whose office scope is incomplete.
- Do not change financial records, provider configuration, accounting proposals, paid payroll, or hygienist contracts.
- Before eventual activation, run the full relevant frontend/backend/materializer/security checks; preserve process/config/asset rollback and review API startup behavior. No Collaboration restart is authorized by this task.
- Do not promote this candidate merely because synthetic tests pass. Independent source and monthly controls are release gates.

References: [Dentrix financial-report measures](https://hsps.pro/DentrixAscend/Help/Understanding_the_Financial_reports.htm), [transaction revisions and dates](https://hsps.pro/DentrixAscend/Help/Understanding_transaction_revisions_and_dates.htm).
