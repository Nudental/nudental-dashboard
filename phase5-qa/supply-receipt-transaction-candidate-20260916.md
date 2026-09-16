# Transactional receipt candidate

PH5-SUPPLY-017 — live reproduction confirmed; candidate not yet applied or live verified.

Two QA administrator tabs held the same pending two-unit receipt open. First submission completed the receipt and raised its linked synthetic stock from six to eight. Submitting the stale second form again reported success and raised stock to ten, even though qty_received remained two. Stock history grew from four to six events and receipt audit history from one to three. Evidence is retained in `qa-receipt-replay-20260916.json`; its exact labeled fixture and stock state still require restoration/cleanup.

The current service applies independent receipt, stock, history and request writes, using the full entered quantity each time. It does not lock/read the persisted receipt total, and ignores errors in later stock/history/request operations.

Candidate 037 adds a QA-only SECURITY INVOKER receipt transaction. It retains existing table policies, requires an active supply writer, locks each receipt, treats received quantity as its persisted cumulative total, and applies only the unapplied positive difference. Equal totals are successful no-ops; completed changes, reductions and cancelled receipts fail. Stored links, supplied counts and authenticated actor are authoritative. All linked changes/audits roll back together on failure. The QA service uses one RPC and never falls back to independent writes; production keeps its existing path.

Validation: 69 offline PostgreSQL checks (including all fixture-role denials, no policy changes, full/partial/multi-item replay, linked requests and rollback at history/audit/later-item failures); six routing checks; five retained receipt-error checks; 76 installation checks across 37 candidate migrations; 1,503 frontend regressions, zero skips; QA build passed. These are candidate results, not a claim that any pending migration is applied.

Migrations 032, 034 and 035 remain unapplied pending their existing approval request. This transaction was tested independently of those candidates and does not apply them. Production, main, provider configurations and business records are unchanged. Linked creation-versus-receipt accounting, actual simultaneous clients and final live replay/cleanup remain to verify.
